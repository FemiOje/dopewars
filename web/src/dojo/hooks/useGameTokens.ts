import { useAccount } from "@starknet-react/core";
import { useGameTokens as useMetagameGameTokens } from "@/lib/metagame-sdk";
import { useSqlQuery } from "@/lib/metagame-sdk/sql/services/sqlService";
import { useMemo } from "react";
import { padAddress, padU64 } from "@/lib/metagame-sdk/shared/lib";
import { useDojoContext } from "./useDojoContext";

const GAME_ADDRESS = "0x12bf5118f03d2bbb8a2a31c72e0020ab85af172dd965ccd55c3132066ad8554";

interface GameTokensProps {
  sortBy: "score" | "token_id";
  limit: number;
  tokenIds?: number[]; // Optional filter by specific token IDs
  filterByOwner?: boolean; // Optional flag to filter by connected account
  pagination?: {
    pageSize?: number;
    initialPage?: number;
  };
}

export const useGameTokens = ({
  sortBy,
  limit,
  tokenIds: filterTokenIds,
  filterByOwner = false,
  pagination,
}: GameTokensProps) => {
  const { address } = useAccount();
  const { chains } = useDojoContext();
  const toriiUrl = chains.selectedChain.toriiUrl || "";

  console.log("useGameTokens - filterByOwner:", filterByOwner, "address:", address);

  const {
    games: metagameGames,
    loading: metagameLoading,
    pagination: paginationControls,
  } = useMetagameGameTokens({
    gameAddresses: [GAME_ADDRESS],
    owner: filterByOwner ? address : undefined, // Only filter by owner if explicitly requested
    tokenIds: filterTokenIds,
    pagination: pagination || {
      pageSize: limit,
    },
    sortBy: sortBy,
    sortOrder: "desc",
  });

  console.log("useGameTokens - metagameGames count:", metagameGames.length);

  const tokenIds = metagameGames.map((game) => padU64(BigInt(game.token_id)));

  // Custom query for dopewars-GameToken
  const dopeTokenQuery = useMemo(() => {
    if (tokenIds.length === 0) return null;
    const tokenIdList = tokenIds.map((id) => `'${id}'`).join(", ");

    // If filtering by owner, include player_id filter
    if (filterByOwner && address) {
      return `
        SELECT * FROM 'dopewars-GameToken'
        WHERE player_id = '${padAddress(address)}' AND token_id IN (${tokenIdList})
        LIMIT ${limit}
      `;
    }

    // Otherwise, just filter by token IDs
    return `
      SELECT * FROM 'dopewars-GameToken'
      WHERE token_id IN (${tokenIdList})
      LIMIT ${limit}
    `;
  }, [address, tokenIds, filterByOwner, limit]);

  const { data: dopeTokens, loading: dopeLoading } = useSqlQuery(toriiUrl, dopeTokenQuery, true);

  // Merge metagame games with dope tokens data
  const mergedGames = useMemo(() => {
    if (!dopeTokens) return metagameGames.map((game) => ({ ...game, hasDopeToken: false, dopeTokenData: null }));

    // Create a map of dope tokens by token_id for quick lookup
    const dopeTokenMap = new Map(dopeTokens.map((token: any) => [token.token_id, token]));

    return metagameGames.map((game) => {
      const paddedTokenId = padU64(BigInt(game.token_id));
      const dopeToken = dopeTokenMap.get(paddedTokenId);

      return {
        ...game,
        hasDopeToken: !!dopeToken,
        dopeTokenData: dopeToken || null,
      };
    });
  }, [metagameGames, dopeTokens]);

  return {
    games: mergedGames,
    isLoading: metagameLoading || dopeLoading,
    pagination: paginationControls,
  };
};
