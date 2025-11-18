import { Loader } from "@/components/layout/Loader";
import { useRouterContext } from "@/dojo/hooks";
import { useYourGames } from "@/dojo/hooks/useYourGames";
import colors from "@/theme/colors";
import { Card, HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { useAccount } from "@starknet-react/core";
import { observer } from "mobx-react-lite";
import { AccountInterface } from "starknet";
import { HustlerAvatarIcon } from "../profile/HustlerAvatarIcon";

const truncateAddress = (address: string, startLength: number = 6, endLength: number = 4): string => {
  if (!address || address.length <= startLength + endLength) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};

export const YourGames = observer(() => {
  const { account } = useAccount();
  const { yourGames, isFetchingYourGames } = useYourGames();

  if (!account) {
    return (
      <VStack boxSize="full" maxH={["calc(100dvh - 320px)", "calc(100dvh - 380px)"]} justifyContent="center">
        <Text opacity={0.7}>Connect your wallet to see your games</Text>
      </VStack>
    );
  }

  return (
    <>
      <VStack
        boxSize="full"
        maxH={["calc(100dvh - 320px)", "calc(100dvh - 380px)"]}
        sx={{
          overflowY: "scroll",
        }}
        __css={{
          "scrollbar-width": "none",
        }}
      >
        {isFetchingYourGames && <Loader />}
        {!isFetchingYourGames && yourGames.length === 0 && (
          <VStack boxSize="full" justifyContent="center">
            <Text opacity={0.7}>No active games found</Text>
            <Text fontSize="sm" opacity={0.5}>
              Start a new game to see it here
            </Text>
          </VStack>
        )}
        {!isFetchingYourGames && yourGames.length > 0 && (
          <SimpleGrid columns={[1, 2]} w="full" gap={4}>
            {yourGames.map((game: any, index: number) => {
              return <YourGameEntry game={game} key={index} account={account} />;
            })}
          </SimpleGrid>
        )}
      </VStack>
    </>
  );
});

const YourGameEntry = ({ game }: { game: any; account: AccountInterface | undefined }) => {
  const { router } = useRouterContext();

  const color = colors.yellow["400"].toString();

  const handleClick = () => {
    if (!game.minigame_token_id || game.minigame_token_id === 0) {
      console.warn("[YourGames] Cannot navigate: minigame_token_id is missing for game", game.game_id);
      return;
    }
    router.push(`/0x${game.minigame_token_id.toString(16)}`);
  };

  // Check if there's a tournament context
  const tournamentId = game.context?.contexts?.["Tournament ID"];
  const displayLabel = tournamentId ? `TOURNAMENT ${tournamentId}` : `SEASON ${game.season_version}`;

  return (
    <Card position="relative" h="100px" p={2} color={color} cursor="pointer" onClick={handleClick}>
      <VStack h="100%" justifyContent="space-between" gap={0}>
        <HStack w="full" gap={3}>
          <HustlerAvatarIcon
            gameId={game.game_id}
            tokenIdType={undefined}
            tokenId={undefined}
            width="48px"
            height="48px"
            display="flex"
            flexShrink={0}
          />

          <VStack w="full" alignItems="flex-start" gap={0}>
            <Text fontSize="sm" opacity={0.7}>
              {game.hasDopeToken ? `Game #${game.game_id}` : "Not Started"}
            </Text>
            <Text fontSize="sm" opacity={0.7}>
              Token #{game.minigame_token_id}
            </Text>
            <Text color={colors.neon["400"].toString()} fontWeight="bold">
              {truncateAddress(game.player_name as string)}
            </Text>
          </VStack>
        </HStack>

        <HStack w="full" justifyContent="space-between" borderTop="solid 1px" borderColor="neon.700" pt={1} mt={1}>
          <Text opacity={0.7}>{displayLabel}</Text>
          <Text color={colors.neon["400"].toString()} fontWeight="bold">
            {game.hasDopeToken ? "RESUME →" : "BEGIN →"}
          </Text>
        </HStack>
      </VStack>
    </Card>
  );
};
