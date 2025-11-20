import {
  ConfigDocument,
  ConfigQuery,
  Dopewars_DrugConfig as DrugConfig,
  Dopewars_DrugConfigEdge as DrugConfigEdge,
  Dopewars_EncounterStatsConfig as EncounterStatsConfig,
  Dopewars_EncounterStatsConfigEdge as EncounterStatsConfigEdge,
  Dopewars_GameConfig as GameConfig,
  Dopewars_LocationConfig as LocationConfig,
  Dopewars_LocationConfigEdge as LocationConfigEdge,
  Dopewars_RyoAddress as RyoAddress,
  Dopewars_RyoAddressEdge as RyoAddressEdge,
  Dopewars_RyoConfig as RyoConfig,
  Dopewars_RyoConfigEdge as RyoConfigEdge,
  Dopewars_SeasonSettings as SeasonSettings,
  Dopewars_DopewarsItemTier as DopewarsItemTier,
  Dopewars_DopewarsItemTierEdge as DopewarsItemTierEdge,
  Dopewars_DopewarsItemTierConfig as DopewarsItemTierConfig,
  Dopewars_DopewarsItemTierConfigEdge as DopewarsItemTierConfigEdge,
  // Dope_ComponentValueEventEdge as ComponentValueEventEdge,
  // Dope_ComponentValueEvent as ComponentValueEvent,
} from "@/generated/graphql";
import { DojoProvider } from "@dojoengine/core";
import { GraphQLClient } from "graphql-request";
import { flow, makeObservable, observable } from "mobx";
import React, { ReactNode } from "react";
import { Contract, ProviderInterface, shortString } from "starknet";
import { ABI as configAbi } from "../abis/configAbi";
import { drugIcons, drugIconsKeys, locationIcons, locationIconsKeys } from "../helpers";
import { CashMode, DrugsMode, EncountersMode, EncountersOddsMode, HealthMode, ItemSlot, TurnsMode } from "../types";
import { GearItem } from "@/dope/helpers";

// Map ItemSlot enum to dopewars slot_id (matches DW_SLOT_IDS in Cairo: [0, 1, 5, 2])
const DW_SLOT_IDS = [0, 1, 5, 2] as const;

// Hardcoded tier configs from Cairo contract as fallback (matches dopewars_items.cairo)
const HARDCODED_TIER_CONFIGS: Record<number, Record<number, Array<{ stat: number; cost: number }>>> = {
  // slot_id 0 (Weapon)
  0: {
    1: [
      { stat: 10, cost: 0 },
      { stat: 25, cost: 1050 },
      { stat: 50, cost: 17500 },
      { stat: 80, cost: 210000 },
    ],
    2: [
      { stat: 12, cost: 0 },
      { stat: 28, cost: 1120 },
      { stat: 45, cost: 11900 },
      { stat: 70, cost: 175000 },
    ],
    3: [
      { stat: 14, cost: 0 },
      { stat: 30, cost: 1120 },
      { stat: 40, cost: 7000 },
      { stat: 60, cost: 140000 },
    ],
  },
  // slot_id 1 (Clothes)
  1: {
    1: [
      { stat: 10, cost: 0 },
      { stat: 22, cost: 960 },
      { stat: 48, cost: 20800 },
      { stat: 75, cost: 216000 },
    ],
    2: [
      { stat: 12, cost: 0 },
      { stat: 26, cost: 1120 },
      { stat: 45, cost: 15200 },
      { stat: 70, cost: 200000 },
    ],
    3: [
      { stat: 14, cost: 0 },
      { stat: 30, cost: 1280 },
      { stat: 42, cost: 9600 },
      { stat: 65, cost: 184000 },
    ],
  },
  // slot_id 2 (Transport)
  2: {
    1: [
      { stat: 900, cost: 0 },
      { stat: 1300, cost: 800 },
      { stat: 3200, cost: 38000 },
      { stat: 5500, cost: 253000 },
    ],
    2: [
      { stat: 1000, cost: 0 },
      { stat: 1500, cost: 1000 },
      { stat: 3000, cost: 30000 },
      { stat: 5000, cost: 220000 },
    ],
    3: [
      { stat: 1100, cost: 0 },
      { stat: 1700, cost: 1200 },
      { stat: 2800, cost: 22000 },
      { stat: 4500, cost: 187000 },
    ],
  },
  // slot_id 5 (Feet)
  5: {
    1: [
      { stat: 6, cost: 0 },
      { stat: 14, cost: 880 },
      { stat: 36, cost: 24200 },
      { stat: 54, cost: 198000 },
    ],
    2: [
      { stat: 8, cost: 0 },
      { stat: 18, cost: 1100 },
      { stat: 33, cost: 16500 },
      { stat: 50, cost: 187000 },
    ],
    3: [
      { stat: 10, cost: 0 },
      { stat: 22, cost: 1320 },
      { stat: 30, cost: 8800 },
      { stat: 46, cost: 176000 },
    ],
  },
};

export type DrugConfigFull = Omit<DrugConfig, "name"> & { icon: React.FC; name: string };
export type LocationConfigFull = Omit<LocationConfig, "name"> & { icon: React.FC; name: string };

export type LayoutItem = {
  name: string;
  bits: bigint;
  idx: bigint;
};

// export type HustlerItemConfig = {
//   slot: ItemSlot;
//   level: number;
//   base: HustlerItemBaseConfig;
//   tier: HustlerItemTiersConfig;
// };

// export type HustlerItemConfigFull = HustlerItemConfig & {
//   icon: React.FC;
//   upgradeName: string;
// };

// export type HustlerItemBaseConfigFull = HustlerItemBaseConfig & {
//   icon: React.FC;
// };

export type GearItemFull = {
  gearItem: GearItem;
  name: string;
  tier: number;
  levels: {
    cost: number;
    stat: number;
  }[];
};

// export type HustlerConfig = {
//   hustler_id: number;
//   weapon: HustlerItemConfig;
//   clothes: HustlerItemConfig;
//   feet: HustlerItemConfig;
//   transport: HustlerItemConfig;
// };

export type SeasonSettingsModes = {
  cash_modes: Array<CashMode>;
  health_modes: Array<HealthMode>;
  turns_modes: Array<TurnsMode>;
  //
  encounters_modes: Array<EncountersMode>;
  encounters_odds_modes: Array<EncountersOddsMode>;
  drugs_modes: Array<DrugsMode>;
};

export type GetConfig = {
  layouts: {
    game_store: Array<LayoutItem>;
    player: Array<LayoutItem>;
  };
  // hustlers: Array<HustlerConfig>;
  ryo_config: RyoConfig;
  season_settings_modes: SeasonSettingsModes;
};

export type Config = {
  ryo: RyoConfig;
  ryoAddress: RyoAddress;
  drug: DrugConfigFull[];
  location: LocationConfigFull[];
  // items: HustlerItemBaseConfigFull[];
  // tiers: HustlerItemTiersConfig[];
  encounterStats: EncounterStatsConfig[];
  config: GetConfig;

  // componentValues: ComponentValueEvent[];
  dopewarsItemsTiers: DopewarsItemTier[];
  dopewarsItemsTierConfigs: DopewarsItemTierConfig[];
};

type ConfigStoreProps = {
  client: GraphQLClient;
  dojoProvider: DojoProvider;
  manifest: any;
};

export class ConfigStoreClass {
  client: GraphQLClient;
  dojoProvider: DojoProvider;
  manifest: any;

  config: Config | undefined = undefined;

  isLoading = false;
  isInitialized = false;
  error: any | undefined = undefined;

  constructor({ client, dojoProvider, manifest }: ConfigStoreProps) {
    // console.log("new ConfigStoreClass");

    this.client = client;
    this.dojoProvider = dojoProvider;
    this.manifest = manifest;

    makeObservable(this, {
      config: observable,
      isLoading: observable,
      init: flow,
    });
  }

  *init() {
    this.isInitialized = false;
    this.config = undefined;
    let data: ConfigQuery;

    try {
      data = (yield this.client.request(ConfigDocument, {})) as ConfigQuery;
      console.log("init successfully. data:", data);
    } catch (error: any) {
      console.log("error", error);
      throw error;
    }

    /*************************************************** */

    const ryoConfigEdges = data!.dopewarsRyoConfigModels!.edges as RyoConfigEdge[];
    const ryoConfig = ryoConfigEdges[0]!.node as RyoConfig;

    const ryoAddressEdges = data!.dopewarsRyoAddressModels!.edges as RyoAddressEdge[];
    const ryoAddress = ryoAddressEdges[0]!.node as RyoAddress;

    /*************************************************** */

    const drugConfigEdges = data!.dopewarsDrugConfigModels!.edges as DrugConfigEdge[];
    const drugConfig = drugConfigEdges.map((i) => i.node as DrugConfig);

    //

    const locationConfigEdges = data!.dopewarsLocationConfigModels!.edges as LocationConfigEdge[];
    const locationConfig = locationConfigEdges.map((i) => i.node as LocationConfig);

    //

    //

    const encounterStatsConfigEdges = data!.dopewarsEncounterStatsConfigModels!.edges as EncounterStatsConfigEdge[];
    const encounterStatsConfig = encounterStatsConfigEdges.map((i) => i.node as EncounterStatsConfig);

    /*************************************************** */

    const drugConfigFull = drugConfig.map((i) => {
      return {
        ...i,
        name: shortString.decodeShortString(i?.name?.value),
        icon: drugIcons[i.drug as drugIconsKeys],
      } as DrugConfigFull;
    });

    const locationConfigFull = locationConfig.flatMap((i) => {
      if (i.location === "Home") return [];

      return [
        {
          ...i,
          name: shortString.decodeShortString(i?.name?.value),
          icon: locationIcons[i.location as locationIconsKeys],
        },
      ] as LocationConfigFull[];
    });

    /*************************************************** */
    const dopewarsItemsTiersEdges = data!.dopewarsDopewarsItemTierModels?.edges as DopewarsItemTierEdge[];
    const dopewarsItemsTiers = dopewarsItemsTiersEdges.map((i) => i.node as DopewarsItemTier);

    const dopewarsItemsTierConfigsEdges = data!.dopewarsDopewarsItemTierConfigModels
      ?.edges as DopewarsItemTierConfigEdge[];
    const dopewarsItemsTierConfigs = dopewarsItemsTierConfigsEdges.map((i) => i.node as DopewarsItemTierConfig);




    /*************************************************** */

    const configContractAddress = this.manifest.contracts.find((c: any) => c.tag === "dopewars-config")?.address;
    if (!configContractAddress) {
      throw new Error("Config contract address not found in manifest");
    }

    const provider = this.dojoProvider.provider as unknown as ProviderInterface;
    let getConfigRaw: any;
    try {
      getConfigRaw = yield this.fetchConfigWithLatestBlock(provider, configContractAddress);
    } catch (error: any) {
      // If enum parsing fails, use parseResponse: false and manually parse layouts
      if (error?.message?.includes("Enum must have exactly one active variant")) {
        console.warn(
          "Enum parsing error in SeasonSettingsModes, using raw response and manually parsing layouts only",
          error,
        );
        const configContract = new Contract({abi: configAbi, address: configContractAddress, providerOrAccount: provider});
        const rawResponse: string[] = yield configContract.call("get_config", [], {
          blockIdentifier: "latest",
          parseResponse: false,
        });

        // Manually parse only the layouts we need from the raw Cairo serialized response
        // Structure: Config { layouts: LayoutsConfig { game_store: Array<LayoutItem>, player: Array<LayoutItem> }, ryo_config, season_settings_modes }
        // Each LayoutItem is: { name: bytes31 (1 felt), idx: u8 (1 felt), bits: u8 (1 felt) }
        let idx = 0;

        // Parse layouts.game_store array
        const gameStoreLen = Number(BigInt(rawResponse[idx++]));
        const gameStore: LayoutItem[] = [];
        for (let i = 0; i < gameStoreLen; i++) {
          const name = shortString.decodeShortString(rawResponse[idx++]);
          const idx_val = Number(BigInt(rawResponse[idx++]));
          const bits = Number(BigInt(rawResponse[idx++]));
          gameStore.push({ name, idx: BigInt(idx_val), bits: BigInt(bits) });
        }

        // Parse layouts.player array
        const playerLen = Number(BigInt(rawResponse[idx++]));
        const player: LayoutItem[] = [];
        for (let i = 0; i < playerLen; i++) {
          const name = shortString.decodeShortString(rawResponse[idx++]);
          const idx_val = Number(BigInt(rawResponse[idx++]));
          const bits = Number(BigInt(rawResponse[idx++]));
          player.push({ name, idx: BigInt(idx_val), bits: BigInt(bits) });
        }

        // Create a minimal getConfigRaw with only layouts (we get ryo_config from GraphQL)
        getConfigRaw = {
          layouts: {
            game_store: gameStore,
            player: player,
          },
          // We'll use ryo_config from GraphQL (ryoConfig variable)
          ryo_config: {},
          // Set empty season_settings_modes (not critical for initialization)
          season_settings_modes: {},
        };
      } else {
        throw error;
      }
    }

    const toBigInt = (value: any): bigint => {
      if (typeof value === "bigint") {
        return value;
      }
      if (typeof value === "number") {
        return BigInt(value);
      }
      if (typeof value === "string") {
        if (value.startsWith("0x")) {
          return BigInt(value);
        }
        const parsed = Number(value);
        if (Number.isNaN(parsed)) {
          return BigInt(0);
        }
        return BigInt(parsed);
      }
      return BigInt(value ?? 0);
    };

    const decodeLayoutName = (value: any): string => {
      if (typeof value === "string" && !value.startsWith("0x")) {
        return value;
      }

      const hex =
        typeof value === "string"
          ? value.startsWith("0x")
            ? value
            : `0x${toBigInt(value).toString(16)}`
          : `0x${toBigInt(value).toString(16)}`;

      try {
        return shortString.decodeShortString(hex);
      } catch {
        return hex;
      }
    };

    const mapLayout = (items: Array<any>): Array<LayoutItem> =>
      items.map((item) => ({
        name: decodeLayoutName(item.name),
        idx: toBigInt(item.idx),
        bits: toBigInt(item.bits),
      }));

    const toBool = (value: any): boolean => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        return value === "0x1" || value === "1";
      }
      return Boolean(Number(value ?? 0));
    };

    const toNumber = (value: any): number => Number(value ?? 0);

    const mapModes = <T extends Record<string, string>>(
      values: Array<any> | undefined,
      enumObj: T,
    ): Array<T[keyof T]> => {
      const options = Object.values(enumObj) as Array<T[keyof T]>;

      return (values ?? []).map((value) => {
        if (typeof value === "string" && !value.startsWith("0x")) {
          return value as T[keyof T];
        }
        const index = Number(value);
        return options[index] ?? (options[0] as T[keyof T]);
      });
    };

    // Use ryo_config from GraphQL if contract parsing failed (manual parsing case)
    const rawRyoConfig = Object.keys(getConfigRaw.ryo_config || {}).length > 0 ? getConfigRaw.ryo_config : ryoConfig;

    // Get all enum values as defaults for season_settings_modes if parsing failed
    const getDefaultModes = <T extends Record<string, string>>(enumObj: T): Array<T[keyof T]> => {
      return Object.values(enumObj) as Array<T[keyof T]>;
    };

    const getConfig: GetConfig = {
      layouts: {
        game_store: mapLayout(getConfigRaw.layouts?.game_store ?? []),
        player: mapLayout(getConfigRaw.layouts?.player ?? []),
      },
      ryo_config:
        Object.keys(rawRyoConfig).length > 0 && rawRyoConfig !== ryoConfig
          ? {
              ...rawRyoConfig,
              key: toNumber(rawRyoConfig.key),
              initialized: toBool(rawRyoConfig.initialized),
              paused: toBool(rawRyoConfig.paused),
              season_version: toNumber(rawRyoConfig.season_version),
              season_duration: toNumber(rawRyoConfig.season_duration),
              season_time_limit: toNumber(rawRyoConfig.season_time_limit),
              paper_fee: toNumber(rawRyoConfig.paper_fee),
              paper_reward_launderer: toNumber(rawRyoConfig.paper_reward_launderer),
              treasury_fee_pct: toNumber(rawRyoConfig.treasury_fee_pct),
              treasury_balance: toNumber(rawRyoConfig.treasury_balance),
            }
          : (ryoConfig as RyoConfig),
      season_settings_modes:
        Object.keys(getConfigRaw.season_settings_modes || {}).length > 0
          ? {
              cash_modes: mapModes(getConfigRaw.season_settings_modes?.cash_modes, CashMode),
              health_modes: mapModes(getConfigRaw.season_settings_modes?.health_modes, HealthMode),
              turns_modes: mapModes(getConfigRaw.season_settings_modes?.turns_modes, TurnsMode),
              encounters_modes: mapModes(getConfigRaw.season_settings_modes?.encounters_modes, EncountersMode),
              encounters_odds_modes: mapModes(
                getConfigRaw.season_settings_modes?.encounters_odds_modes,
                EncountersOddsMode,
              ),
              drugs_modes: mapModes(getConfigRaw.season_settings_modes?.drugs_modes, DrugsMode),
            }
          : {
              // Use all enum values as defaults when parsing failed
              cash_modes: getDefaultModes(CashMode),
              health_modes: getDefaultModes(HealthMode),
              turns_modes: getDefaultModes(TurnsMode),
              encounters_modes: getDefaultModes(EncountersMode),
              encounters_odds_modes: getDefaultModes(EncountersOddsMode),
              drugs_modes: getDefaultModes(DrugsMode),
            },
    };

    /*************************************************** */

    this.config = {
      ryo: ryoConfig,
      ryoAddress: ryoAddress,
      drug: drugConfigFull,
      location: locationConfigFull,

      // componentValues,
      dopewarsItemsTiers,
      dopewarsItemsTierConfigs,

      encounterStats: encounterStatsConfig,
      /// @ts-ignore
      config: getConfig as GetConfig,
    };

    this.isInitialized = true;
    // console.log("config:", this.config);
  }

  /**
   * @dev
   * Dojo's typed `call` helper defaults to `block_id: "pending"`, which my RPC gateway
   * currently rejects. To stay aligned with upstream data
   * structures while avoiding the `block_id` failure we issue the call manually with
   * `blockIdentifier: "latest"`.
   *
   * NOTE: When the upstream gateway accepts `pending` again we can revert to the
   * original `dojoProvider.call` path (see commented block below) and delete this helper.
   */
  private async fetchConfigWithLatestBlock(provider: ProviderInterface, configContractAddress: string): Promise<any> {
    const configContract = new Contract({abi: configAbi, address: configContractAddress, providerOrAccount: provider});
    return configContract.call("get_config", [], { blockIdentifier: "latest" });
  }

  // Legacy approach kept for reviewers/context:
  // const getConfig = await this.dojoProvider.call("dopewars", {
  //   contractName: "config",
  //   entrypoint: "get_config",
  //   calldata: [],
  // });

  getDrug(drugs_mode: string, drug: string): DrugConfigFull {
    return this.config?.drug.find((i) => i.drugs_mode === drugs_mode && i.drug.toLowerCase() === drug.toLowerCase())!;
  }

  getDrugById(drugs_mode: string, drug_id: number): DrugConfigFull {
    return this.config?.drug.find((i) => i.drugs_mode === drugs_mode && Number(i.drug_id) === Number(drug_id))!;
  }

  getLocation(location: string): LocationConfigFull {
    return this.config?.location.find((i) => i.location.toLowerCase() === location.toLowerCase())!;
  }

  getLocationById(location_id: number): LocationConfigFull {
    return this.config?.location.find((i) => Number(i.location_id) === Number(location_id))!;
  }

  // layout

  getGameStoreLayoutItem(name: string): LayoutItem {
    if (!this.config?.config?.layouts?.game_store) {
      throw new Error(
        `Config layouts not loaded. Cannot get game_store layout item: ${name}. Make sure config store is initialized.`,
      );
    }
    const item = this.config.config.layouts.game_store.find((i) => i.name === name);
    if (!item) {
      throw new Error(`Game store layout item not found: ${name}`);
    }
    return item;
  }
  getPlayerLayoutItem(name: string): LayoutItem {
    if (!this.config?.config?.layouts?.player) {
      throw new Error(
        `Config layouts not loaded. Cannot get player layout item: ${name}. Make sure config store is initialized.`,
      );
    }
    const item = this.config.config.layouts.player.find((i) => i.name === name);
    if (!item) {
      throw new Error(`Player layout item not found: ${name}`);
    }
    return item;
  }

  // loot

  getGearItemFull(gearItem: GearItem): GearItemFull {
    if (!gearItem) {
      console.error("[ConfigStore] getGearItemFull called with undefined gearItem!");
      // Return a default transport item as fallback
      return {
        gearItem: { slot: 3, item: 0 } as GearItem,
        name: "",
        tier: 1,
        levels: [
          { stat: 900, cost: 0 },
          { stat: 1300, cost: 800 },
          { stat: 3200, cost: 38000 },
          { stat: 5500, cost: 253000 },
        ],
      };
    }

    // Map ItemSlot enum to dopewars slot_id (DW_SLOT_IDS: [0, 1, 5, 2])
    const dwSlotId = DW_SLOT_IDS[gearItem.slot] ?? gearItem.slot;

    // Get tier from GraphQL or fallback to hardcoded lookup
    const tierData = this.getGearItemTier(gearItem);
    const tier = tierData?.tier;

    // Try to get tier config from GraphQL first
    let tierConfig = this.config?.dopewarsItemsTierConfigs.find((i) => i.slot_id === dwSlotId && i.tier === tier);

    // If not found in GraphQL, use hardcoded fallback from Cairo contract
    let levels: Array<{ stat: number; cost: number }>;
    if (tierConfig?.levels && tierConfig.levels.length > 0) {
      levels = tierConfig.levels.map((i) => {
        return { cost: Number(i?.cost ?? 0), stat: Number(i?.stat ?? 0) };
      });
    } else if (tier && HARDCODED_TIER_CONFIGS[dwSlotId]?.[tier]) {
      // Use hardcoded tier configs as fallback (no Dope collection dependency)
      levels = HARDCODED_TIER_CONFIGS[dwSlotId][tier];
    } else {
      // Last resort: use tier 1 config for the slot (most common/default)
      const defaultTier = 1;
      if (HARDCODED_TIER_CONFIGS[dwSlotId]?.[defaultTier]) {
        levels = HARDCODED_TIER_CONFIGS[dwSlotId][defaultTier];
      } else {
        // Absolute fallback - use reasonable defaults based on slot type
        levels =
          dwSlotId === 2
            ? [
                { stat: 900, cost: 0 },
                { stat: 1300, cost: 800 },
                { stat: 3200, cost: 38000 },
                { stat: 5500, cost: 253000 },
              ]
            : [
                { stat: 10, cost: 0 },
                { stat: 25, cost: 1000 },
                { stat: 50, cost: 15000 },
                { stat: 80, cost: 200000 },
              ];
      }
    }

    return {
      gearItem,
      name: "", // No longer using Dope collection for names
      tier: tier ?? 1,
      levels,
    };
  }

  getGearItemTier(gearItem: GearItem) {
    // Map ItemSlot enum to dopewars slot_id
    const dwSlotId = DW_SLOT_IDS[gearItem.slot] ?? gearItem.slot;
    return this.config?.dopewarsItemsTiers.find((i) => i.slot_id === dwSlotId && i.item_id === gearItem.item);
  }
}
