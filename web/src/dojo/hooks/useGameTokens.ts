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
}

export const useGameTokens = ({ sortBy, limit, tokenIds: filterTokenIds }: GameTokensProps) => {
  const { address } = useAccount();
  const { chains } = useDojoContext();
  const toriiUrl = chains.selectedChain.toriiUrl || "";

  const { games: metagameGames, loading: metagameLoading } = useMetagameGameTokens({
    gameAddresses: [GAME_ADDRESS],
    owner: address,
    tokenIds: filterTokenIds, // Pass through token ID filter
    pagination: {
      pageSize: 100,
    },
    sortBy: sortBy,
    sortOrder: "desc",
  });

  const tokenIds = metagameGames.map((game) => padU64(BigInt(game.token_id)));

  // Custom query for dopewars-GameToken
  const dopeTokenQuery = useMemo(() => {
    if (!address || tokenIds.length === 0) return null;
    const tokenIdList = tokenIds.map((id) => `'${id}'`).join(", ");
    return `
      SELECT * FROM 'dopewars-GameToken'
      WHERE player_id = '${padAddress(address)}' AND token_id IN (${tokenIdList})
      LIMIT ${limit}
    `;
  }, [address, tokenIds]);

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
  };
};
