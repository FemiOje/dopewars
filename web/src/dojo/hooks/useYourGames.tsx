import { useMemo } from "react";
import { useGameTokens } from "./useGameTokens";
import { useConfigStore } from "./useConfigStore";
import { EnrichedGame } from "../types";

export const useYourGames = () => {
  const { games: gamesData, isLoading } = useGameTokens({
    sortBy: "token_id",
    limit: 100,
    filterByOwner: true, // Only get games for connected account
  });
  const { config } = useConfigStore();

  console.log("YourGames - gamesData:", gamesData);

  // Filter to active games and transform to EnrichedGame format
  // Note: metagame-sdk provides token data, but we need to map it to EnrichedGame
  // which includes fields from the Game model (season_version, player_id, etc.)
  const yourGames = useMemo(() => {
    if (!gamesData || gamesData.length === 0) {
      return [];
    }

    const currentSeasonVersion = config?.ryo.season_version || 0;

    // Filter out completed games and transform to EnrichedGame format
    return gamesData
      .filter((game) => !game.game_over && game.game_id !== undefined)
      .map(
        (game): EnrichedGame & { hasDopeToken: boolean; context?: any } => ({
          season_version: currentSeasonVersion,
          game_id: game.dopeTokenData?.game_id,
          player_id: "", // metagame-sdk may not provide this
          player_name: game.player_name || "",
          game_mode: "", // metagame-sdk may not provide this
          game_over: game.game_over ? 1 : 0,
          final_score: game.score || 0,
          token_id_type: "",
          token_id: game.token_id,
          "token_id.guestlootid": null,
          "token_id.lootid": null,
          "token_id.hustlerid": null,
          minigame_token_id: game.token_id, // token_id is the minigame_token_id
          equipment_by_slot: "", // metagame-sdk may not provide this
          minted_by: game.minted_by,
          lifecycle: game.lifecycle,
          hasDopeToken: game.hasDopeToken,
          context: game.context,
        }),
      );
  }, [gamesData, config?.ryo.season_version]);

  return {
    yourGames,
    isFetchingYourGames: isLoading,
    refetchYourGames: () => {
      // No-op - metagame-sdk hook handles refetching automatically
      // If manual refetch is needed, it should be handled by the metagame-sdk hook
    },
  };
};
