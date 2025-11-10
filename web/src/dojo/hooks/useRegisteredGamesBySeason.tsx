import {
  Dopewars_Game as Game,
  Dopewars_GameEdge as GameEdge,
  useGameByIdQuery,
  useRegisteredGamesBySeasonQuery,
} from "@/generated/graphql";
import { useEffect, useMemo, useState } from "react";
import { useSql } from "./useSql";
import { shortString } from "starknet";

interface RegisteredGamesBySeasonInterface {
  registeredGames: Game[];
  isFetched: boolean;
  isFetching: boolean;
  refetch: any;
}

const sqlQuery = (season_version: string) => `SELECT season_version,
game_id,
player_id,
"player_name.value",
final_score,
registered,
claimed,
claimable,
position,
multiplier,
minigame_token_id
FROM "dopewars-Game" 
where season_version = ${season_version} and registered = true
ORDER BY final_score DESC
LIMIT 1000;`;

export const useRegisteredGamesBySeason = (version: number): RegisteredGamesBySeasonInterface => {
  // const { data, isFetched, isFetching, refetch } = useRegisteredGamesBySeasonQuery({
  //   version,
  // });

  const { data, isFetched, isFetching, refetch } = useSql(sqlQuery((version || 0).toString()));

  const registeredGames = useMemo(() => {
    // Handle different response structures from SQL endpoint
    let gamesData: any[] = [];
    if (Array.isArray(data)) {
      gamesData = data;
    } else if (data && typeof data === "object") {
      // Try common response structures
      gamesData = data.rows || data.data || data.results || [];
    }

    const games = gamesData.map((i: any) => {
      return {
        ...i,
        player_name: shortString.decodeShortString(BigInt(i["player_name.value"]).toString()),
        // token_id removed - Dope collection integration stripped
        minigame_token_id: Number(i.minigame_token_id),
      };
    });

    return games.sort((a: Game, b: Game) => {
      const bPos = b.position > 0 ? (9999 - b.position) * 1_000_000_000 : 0;
      const aPos = a.position > 0 ? (9999 - a.position) * 1_000_000_000 : 0;
      return bPos + b.final_score - (aPos + a.final_score);
    });
  }, [data]);

  return {
    registeredGames,
    isFetched,
    isFetching,
    refetch,
  };
};
