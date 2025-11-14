import { useMemo, useEffect } from "react";
import { GameTokenData } from "../types";
import { useAccount } from "@starknet-react/core";
import { useGameTokens as useMetagameGameTokens, getGameTokens as getMetagameGameTokens } from "@/lib/metagame-sdk";

const transformToGameTokenData = (game: any): GameTokenData => {
  return {
    token_id: game.token_id || 0,
    game_id: game.game_id,
    game_over: game.game_over,
    lifecycle: game.lifecycle
      ? {
          start: game.lifecycle.start,
          end: game.lifecycle.end,
        }
      : { start: undefined, end: undefined },
    minted_at: game.minted_at,
    minted_by: game.minted_by,
    minted_by_address: game.minted_by_address,
    owner: game.owner,
    settings_id: game.settings_id,
    soulbound: game.soulbound,
    completed_all_objectives: game.completed_all_objectives,
    player_name: game.player_name,
    metadata: game.metadata,
    context: game.context,
    settings: game.settings,
    score: game.score || 0,
    objective_ids: game.objective_ids || [],
    renderer: game.renderer,
    client_url: game.client_url,
    gameMetadata: game.gameMetadata,
  };
};

const GAME_TOKEN_ADDRESS = "0x036017E69D21D6D8c13E266EaBB73ef1f1D02722D86BDcAbe5f168f8e549d3cD";

export const useGameTokens = () => {
  const { account } = useAccount();

  const { games: metagameGames, loading: metagameLoading } = useMetagameGameTokens({
    gameAddresses: [GAME_TOKEN_ADDRESS],
    owner: account?.address,
    limit: 1000,
  });

  const gamesData = useMemo(() => {
    if (!metagameGames || metagameGames.length === 0) {
      return [];
    }
    return metagameGames.map(transformToGameTokenData);
  }, [metagameGames]);

  // Log owned games when they're loaded
  useEffect(() => {
    if (!metagameLoading && account?.address) {
      if (gamesData.length > 0) {
        console.log(`🎮 Games owned by ${account.address}:`, {
          totalGames: gamesData.length,
          games: gamesData.map((game) => ({
            game_id: game.game_id,
            token_id: game.token_id,
            player_name: game.player_name,
            game_over: game.game_over,
            score: game.score,
            owner: game.owner,
          })),
        });
      } else {
        console.log(`ℹ️ No games found for owner: ${account.address}`);
      }
    }
  }, [gamesData, metagameLoading, account?.address]);

  return {
    gamesData,
    isLoading: metagameLoading,
    getGameTokens: getMetagameGameTokens,
  };
};
