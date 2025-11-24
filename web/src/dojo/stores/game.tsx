import { GraphQLClient } from "graphql-request";

import {
  Dopewars_Game as Game,
  Dopewars_GameConfig as GameConfig,
  Dopewars_GameStorePacked as GameStorePacked,
  Dopewars_SeasonSettings as SeasonSettings,
} from "@/generated/graphql";
import { action, flow, makeObservable, observable } from "mobx";
import { EventClass } from "../class/Events";
import { GameClass } from "../class/Game";
import { ConfigStoreClass } from "./config";
import { Entities, Entity, Subscription, ToriiClient, Ty } from "@dojoengine/torii-client";
import { parseStruct } from "../utils";
import { num } from "starknet";
import { NextRouter } from "next/router";
import { PlayerStatus } from "../types";
import { parseModels } from "@/dope/toriiUtils";
import { GameCreated } from "@/components/layout/GlobalEvents";

type GameStoreProps = {
  toriiClient: ToriiClient;
  client: GraphQLClient;
  configStore: ConfigStoreClass;
  router: NextRouter;
  worldAddress: string;
};

// const HISTORICAL_EVENT_MODELS = [
//   "dopewars-GameCreated",
//   "dopewars-Traveled",
//   "dopewars-GameOver",
//   "dopewars-TradeDrug",
//   "dopewars-HighVolatility",
//   "dopewars-UpgradeItem",
//   "dopewars-TravelEncounter",
//   "dopewars-TravelEncounterResult",
//   "dopewars-NewSeason",
//   "dopewars-NewHighScore",
//   "dopewars-Claimed",
//   "dopewars-TrophyCreation",
//   "dopewars-TrophyProgression",
// ] as const;

// export type GameWithTokenId = {
//   game_id: number;
//   player_id: bigint;
//   token_id: number;
//   token_id_type: string;
//   equipment_by_slot: number[];
// };

export class GameStoreClass {
  toriiClient: ToriiClient;
  client: GraphQLClient;
  configStore: ConfigStoreClass;
  router: NextRouter;
  worldAddress: string;

  isInitialized = false;
  isCreatingGame = false;
  game: GameClass | null = null;
  gameEvents: EventClass | null = null;
  gameInfos: Game | null = null;
  gameStorePacked: GameStorePacked | null = null;
  gameConfig: GameConfig | null = null;
  seasonSettings: SeasonSettings | null = null;
  subscriptions: Array<Subscription> = [];
  tokenId: string | undefined = undefined;
  tournamentId: string | undefined = undefined;

  allGamesCreated: GameCreated[] = [];

  constructor({ toriiClient, client, configStore, router, worldAddress }: GameStoreProps) {
    this.toriiClient = toriiClient;
    this.client = client;
    this.configStore = configStore;
    this.router = router;
    this.worldAddress = worldAddress;

    makeObservable(this, {
      game: observable,
      gameEvents: observable,
      gameInfos: observable,
      gameConfig: observable,
      seasonSettings: observable,
      tournamentId: observable,
      isCreatingGame: observable,
      setIsCreatingGame: action,
      setTournamentId: action,
      reset: action,
      cleanSubscriptions: action,
      init: flow,
      loadGameInfos: flow,
      loadGameEvents: flow,
      loadSeasonSettings: flow,
      subscribe: flow,
      initGameStore: action,
      onEntityUpdated: action,
      onEventMessage: action,
      getGameCreated: flow,
    });
  }

  setIsCreatingGame(value: boolean) {
    this.isCreatingGame = value;
  }

  setTournamentId(value: string) {
    this.tournamentId = value;
  }

  reset() {
    this.cleanSubscriptions();

    this.game = null;
    this.gameInfos = null;
    this.gameConfig = null;
    this.gameEvents = null;
    this.seasonSettings = null;
    this.subscriptions = [];
    this.tokenId = undefined;
    this.tournamentId = undefined;
    this.isInitialized = false;
    this.isCreatingGame = false;
  }

  *init(tokenId: string) {
    if (!this.configStore.isInitialized) {
      throw new Error("Config store not initialized yet, will retry");
    }

    if (!tokenId || tokenId.trim() === "") {
      throw new Error("Invalid tokenId: tokenId is required but was empty or undefined");
    }

    const trimmedTokenId = tokenId.trim();
    let tokenIdNumber: number;

    const hasHexPrefix = /^0x/i.test(trimmedTokenId);
    const tokenDigits = hasHexPrefix ? trimmedTokenId.slice(2) : trimmedTokenId;
    const isDecimalWithHexPrefix = hasHexPrefix && /^[0-9]+$/.test(tokenDigits);

    if (isDecimalWithHexPrefix) {
      // Token was incorrectly prefixed with 0x even though it is decimal
      tokenIdNumber = parseInt(tokenDigits, 10);
    } else if (hasHexPrefix) {
      tokenIdNumber = parseInt(tokenDigits, 16);
    } else {
      tokenIdNumber = parseInt(trimmedTokenId, 10);
    }

    // Validate tokenId is a valid number
    if (isNaN(tokenIdNumber) || tokenIdNumber <= 0) {
      throw new Error(`Invalid tokenId: "${tokenId}" is not a valid token ID`);
    }

    // Normalize to clean hex format (single 0x prefix)
    this.tokenId = `0x${tokenIdNumber.toString(16)}`;

    yield this.loadGameInfos(this.tokenId);
    yield this.loadSeasonSettings(this.gameInfos?.season_version);
    yield this.loadGameEvents();

    // Ensure all required data is loaded before initializing game store
    if (!this.gameInfos || !this.gameStorePacked || !this.seasonSettings || !this.gameConfig) {
      throw new Error("Required game data is missing. Cannot initialize game store.");
    }

    this.initGameStore();

    yield this.subscribe();

    this.isInitialized = true;
  }

  cleanSubscriptions() {
    for (let subscription of this.subscriptions) {
      // cancel subscription
      subscription.cancel();
    }
    // clean subscriptions array
    this.subscriptions = [];
  }

  *subscribe() {
    yield this.cleanSubscriptions();

    const subEntities: Subscription = yield this.toriiClient.onEntityUpdated(
      {
        Keys: {
          keys: [num.toHexString(this.gameInfos?.game_id), this.gameInfos?.player_id],
          models: ["dopewars-GameStorePacked"],
          pattern_matching: "VariableLen",
        },
      },
      [this.worldAddress],
      (entity: any, update: any) => this.onEntityUpdated(entity, update),
    );
    this.subscriptions.push(subEntities);

    const subEvent: Subscription = yield this.toriiClient.onEventMessageUpdated(
      {
        Keys: {
          keys: [num.toHexString(this.gameInfos?.game_id), this.gameInfos?.player_id],
          models: ["dopewars-*"],
          pattern_matching: "VariableLen",
        },
      },
      [this.worldAddress],
      (entity: any, update: any) => this.onEventMessage(entity, update),
    );
    this.subscriptions.push(subEvent);
  }

  initGameStore() {
    const game = new GameClass(
      this.configStore,
      this.gameInfos!,
      this.seasonSettings!,
      this.gameConfig!,
      this.gameStorePacked!,
    );

    this.game = game;
  }
  //////////////////////////////////////////////
  // *loadGameEvents() {
  //   try {
  //     const eventModels = [...HISTORICAL_EVENT_MODELS];

  //     const entities: Entities = yield this.toriiClient.getEventMessages({
  //       world_addresses: [this.worldAddress],
  //       clause: {
  //         Keys: {
  //           keys: [num.toHexString(this.gameInfos?.game_id), this.gameInfos?.player_id],
  //           models: eventModels,
  //           pattern_matching: "VariableLen",
  //         },
  //       },
  //       pagination: {
  //         limit: 10_000,
  //         cursor: undefined,
  //         direction: "Forward",
  //         order_by: [],
  //       },
  //       no_hashed_keys: false,
  //       models: eventModels, // Explicit models list instead of empty array
  //       historical: true,
  //     });

  //     if (entities.items.length === 0) {
  //       this.gameEvents = new EventClass(this.configStore, this.gameInfos!, []);
  //       return;
  //     }

  //     this.gameEvents = new EventClass(this.configStore, this.gameInfos!, entities.items);
  //   } catch (error: any) {
  //     // Log error but don't block game initialization
  //     const errorMessage = error?.message || String(error);
  //     console.warn(
  //       `[GameStore] Failed to load game events for gameId: ${this.gameInfos?.game_id}. Error: ${errorMessage}. Continuing without events.`,
  //     );
  //     this.gameEvents = null;
  //   }
  // }

  *loadGameEvents() {
    const entities: Entities = yield this.toriiClient.getEventMessages({
      world_addresses: [this.worldAddress],
      clause: {
        Keys: {
          keys: [num.toHexString(this.gameInfos?.game_id), this.gameInfos?.player_id],
          models: [],
          pattern_matching: "VariableLen",
        },
      },

      pagination: {
        limit: 10_000,
        cursor: undefined,
        direction: "Forward",
        order_by: [],
      },
      no_hashed_keys: true,
      models: [],
      historical: false,
    });
    console.log("loadGameEvents: entities: ", entities);

    if (entities.items.length === 0) {
      console.log("No game events found for gameId: ", this.gameInfos?.game_id);
      return;
    }

    this.gameEvents = new EventClass(this.configStore, this.gameInfos!, entities.items);
  }

  *loadGameInfos(tokenId: string) {
    const tokenIdNumber = tokenId.startsWith("0x") ? parseInt(tokenId, 16) : parseInt(tokenId, 10);

    // query GameToken by token_id
    let gameTokenEntities: Entities = yield this.toriiClient.getEntities({
      world_addresses: [this.worldAddress],
      clause: {
        Keys: {
          keys: [tokenIdNumber.toString()],
          models: ["dopewars-GameToken"],
          pattern_matching: "FixedLen",
        },
      },
      pagination: {
        limit: 1,
        cursor: undefined,
        direction: "Forward",
        order_by: [],
      },
      no_hashed_keys: true,
      models: ["dopewars-GameToken"],
      historical: false,
    });

    let gameToken = parseModels(gameTokenEntities, "dopewars-GameToken")[0] as {
      token_id: number;
      game_id: number;
      player_id: string;
    };
    console.log("gameToken", tokenId, gameToken);

    if (!gameToken || !gameToken.game_id) {
      // Game hasn't been started yet - check if this token exists in metagame
      // This will be handled by a custom error that the UI can catch
      throw new Error(`GAME_NOT_STARTED:${tokenId}`);
    }

    const gameIdNumber = gameToken.game_id;
    const entities: Entities = yield this.toriiClient.getEntities({
      world_addresses: [this.worldAddress],
      clause: {
        Member: {
          member: "game_id",
          model: "dopewars-Game",
          operator: "Eq",
          value: { Primitive: { U32: gameIdNumber } },
        },
      },
      pagination: {
        limit: 10,
        cursor: undefined,
        direction: "Forward",
        order_by: [],
      },
      no_hashed_keys: true,
      models: ["dopewars-Game", "dopewars-GameStorePacked"],
      historical: false,
    });

    const gameInfos = parseModels(entities, "dopewars-Game")[0] as Game;
    const gameStorePacked = parseModels(entities, "dopewars-GameStorePacked")[0] as GameStorePacked;

    if (!gameInfos || !gameStorePacked) {
      throw new Error(
        `Game data not found for tokenId: ${tokenId} (game_id: ${gameIdNumber}). The game may not exist or the indexer may not have synced yet.`,
      );
    }

    // @ts-ignore
    gameInfos.game_mode = gameInfos.game_mode.activeVariant();
    gameInfos.equipment_by_slot = gameInfos.equipment_by_slot?.map((i: string) => Number(i));
    // token_id, token_id_type removed from Game model - Dope collection integration stripped

    this.gameInfos = gameInfos;
    this.gameStorePacked = gameStorePacked;
  }

  *loadSeasonSettings(season_version: string) {
    const entities: Entities = yield this.toriiClient.getEntities({
      world_addresses: [this.worldAddress],
      clause: {
        Keys: {
          keys: [num.toHexString(season_version)],
          models: ["dopewars-SeasonSettings", "dopewars-GameConfig"],
          pattern_matching: "VariableLen",
        },
      },
      pagination: {
        limit: 100,
        cursor: undefined,
        direction: "Forward",
        order_by: [],
      },
      no_hashed_keys: true,
      models: ["dopewars-SeasonSettings", "dopewars-GameConfig"],
      historical: false,
    });

    if (!entities.items[0]) {
      throw new Error(`Season settings not found for season_version: ${season_version}`);
    }

    const seasonSettings = parseStruct(entities.items[0].models["dopewars-SeasonSettings"]) as SeasonSettings;
    const gameConfig = parseStruct(entities.items[0].models["dopewars-GameConfig"]) as GameConfig;

    if (!gameConfig || !seasonSettings) {
      throw new Error(`Game config or season settings missing for season_version: ${season_version}`);
    }

    this.seasonSettings = seasonSettings;
    this.gameConfig = gameConfig;
  }

  onEventMessage(key: string, entity: Entity) {
    if (key === "0x0") return;
    // console.log("onEventMessage", entity, update);

    // Initialize gameEvents if loadGameEvents failed
    if (!this.gameEvents) {
      this.gameEvents = new EventClass(this.configStore, this.gameInfos!, []);
    }

    const wasGameOver = this.gameEvents?.isGameOver ?? false;
    this.gameEvents.addEvent(entity);

    if (!wasGameOver && this.gameEvents?.isGameOver) {
      if (!this.tokenId) {
        console.warn("[GameStore] Cannot navigate: tokenId is missing");
        return;
      }

      // Ensure tokenId is in hex format for router
      const tokenIdHex = this.tokenId.startsWith("0x") ? this.tokenId : `0x${parseInt(this.tokenId, 10).toString(16)}`;

      // Only redirect to /event/consequence if there's a pending encounter result to show
      // Otherwise, redirect directly to /end
      const hasPendingEncounter = this.gameEvents?.lastEncounter && this.gameEvents?.lastEncounterResult;

      if (hasPendingEncounter) {
        this.router.push(`/${tokenIdHex}/event/consequence`);
      } else {
        this.router.push(`/${tokenIdHex}/end`);
      }
    }
  }

  onEntityUpdated(key: string, entity: Entity) {
    // console.log("onEntityUpdated", key, entity);

    if (!this.tokenId) {
      console.warn("[GameStore] Cannot navigate: tokenId is missing");
      return;
    }

    // Ensure tokenId is in hex format for router (like gameId was with num.toHexString)
    const tokenId = this.tokenId.startsWith("0x") ? this.tokenId : `0x${parseInt(this.tokenId, 10).toString(16)}`;
    const currentPath = this.router.asPath;

    const prevState = this.game?.player;

    if (entity.models["dopewars-GameStorePacked"]) {
      this.gameStorePacked = parseStruct(entity.models["dopewars-GameStorePacked"]);
      this.initGameStore();

      // Don't redirect if already on the end page (e.g., when registering score)
      const isOnEndPage = currentPath === `/${tokenId}/end`;

      // if dead, handled in /event/consequence
      if (this.gameEvents?.isGameOver && this.game!.player!.health > 0) {
        if (!isOnEndPage) {
          return this.router.push(`/${tokenId}/end`);
        }
        return;
      }

      // Don't redirect from end page when game is over
      if (this.game?.gameInfos.game_over && isOnEndPage) {
        return;
      }

      if (this.game?.player.status === PlayerStatus.Normal) {
        const location = this.configStore
          .getLocationById(this.game.player.location.location_id)!
          .location.toLowerCase();
        if (prevState?.status !== PlayerStatus.Normal) {
          // decision -> consequence
          this.router.push(`/${tokenId}/event/consequence`);
        } else {
          // normal travel
          this.router.push(`/${tokenId}/${location}`);
        }
      } else {
        if (this.gameEvents?.isGameOver) {
          // Only redirect to consequence if there's a pending encounter and not already on end page
          const hasPendingEncounter = this.gameEvents?.lastEncounter && this.gameEvents?.lastEncounterResult;
          if (!isOnEndPage) {
            if (hasPendingEncounter) {
              this.router.push(`/${tokenId}/event/consequence`);
            } else {
              this.router.push(`/${tokenId}/end`);
            }
          }
        } else {
          this.router.push(`/${tokenId}/event/decision`);
        }
      }
    }
  }

  *getGameCreated(gameId: number) {
    const loaded = this.allGamesCreated.find((i) => i.game_id === gameId);
    if (loaded) return loaded;

    const entities: Entities = yield this.toriiClient.getEventMessages({
      world_addresses: [this.worldAddress],
      clause: {
        Member: {
          member: "game_id",
          model: "dopewars-GameCreated",
          operator: "Eq",
          value: { Primitive: { U32: gameId } },
        },
      },
      pagination: {
        limit: 10,
        cursor: undefined,
        direction: "Forward",
        order_by: [],
      },
      no_hashed_keys: true,
      models: [],
      historical: false,
    });

    const gameCreated = parseModels(entities, "dopewars-GameCreated")[0];
    if (gameCreated) {
      this.allGamesCreated.push(gameCreated);
    }
    return gameCreated;
  }
}
