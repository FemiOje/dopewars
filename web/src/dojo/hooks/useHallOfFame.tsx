import { useEffect, useMemo } from "react";
import { useDojoContext } from "./useDojoContext";
import { useSql } from "./useSql";
import { shortString } from "starknet";

type HallOfFameResult = ReturnType<typeof useHallOfFame>;

const sqlQuery = () => `SELECT season_version,
game_id,
player_id,
"player_name.value",
final_score,
claimable,
position
FROM "dopewars-Game" 
WHERE position = 1
ORDER BY season_version DESC
LIMIT 1000;`;

export const useHallOfFame = () => {
  const {
    chains: { selectedChain },
  } = useDojoContext();

  const { data, isFetched, isFetching, refetch } = useSql(sqlQuery());

  const hallOfFame = useMemo(() => {
    // Handle different response structures from SQL endpoint
    let gamesData: any[] = [];
    if (Array.isArray(data)) {
      gamesData = data;
    } else if (data && typeof data === "object") {
      // Try common response structures
      gamesData = data.rows || data.data || data.results || [];
    }

    return gamesData.map((i: any) => {
      return {
        ...i,
        player_name: shortString.decodeShortString(BigInt(i["player_name.value"]).toString()),
        // token_id removed - Dope collection integration stripped
      };
    });
  }, [data]);

  return {
    hallOfFame,
    isFetchingHallOfFame: isFetching,
    refetchHallOfFame: refetch,
  };
};
