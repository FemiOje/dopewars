import { useAccount } from "@starknet-react/core";
import { useGameTokens as useMetagameGameTokens, getMetagameClientSafe } from "@/lib/metagame-sdk";
import { useSqlQuery } from "@/lib/metagame-sdk/sql/services/sqlService";
import { useMemo } from "react";
import { padAddress } from "@/lib/metagame-sdk/shared/lib";

const GAME_ADDRESS = "0x12bf5118f03d2bbb8a2a31c72e0020ab85af172dd965ccd55c3132066ad8554";

interface GameTokensProps {
  sortBy: "score" | "token_id";
  limit: number;
}

export const useGameTokens = ({ sortBy, limit }: GameTokensProps) => {
  const { account } = useAccount();
  const client = getMetagameClientSafe();
  const toriiUrl = client?.getConfig().toriiUrl || "";

  const { games: metagameGames, loading: metagameLoading } = useMetagameGameTokens({
    gameAddresses: [GAME_ADDRESS],
    owner: account?.address,
    pagination: {
      pageSize: 100,
    },
    sortBy: sortBy,
    sortOrder: "desc",
  });

  const tokenIds = metagameGames.map((game) => game.token_id);

  // Custom query for dopewars-GameToken
  const dopeTokenQuery = useMemo(() => {
    if (!account?.address || tokenIds.length === 0) return null;
    const tokenIdList = tokenIds.map((id) => `'${id}'`).join(", ");
    return `
      SELECT * FROM 'dopewars-GameToken'
      WHERE player_id = '${padAddress(account.address)}' AND token_id IN (${tokenIdList})
      ORDER BY ${sortBy} DESC
      LIMIT ${limit}
    `;
  }, [account?.address, tokenIds]);

  const { data: dopeTokens, loading: dopeLoading } = useSqlQuery(toriiUrl, dopeTokenQuery, true);

  return {
    metagameGames,
    dopeTokens,
    isLoading: metagameLoading || dopeLoading,
  };
};
