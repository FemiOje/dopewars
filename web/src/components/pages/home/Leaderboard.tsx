import { Loader } from "@/components/layout/Loader";
import {
  useDojoContext,
  useRegisteredGamesBySeason,
  useRouterContext,
  useSeasonByVersion,
  useGameTokens,
} from "@/dojo/hooks";
import { getContractByName } from "@dojoengine/core";
import { DW_NS } from "@/dojo/hooks/useSystems";
import colors from "@/theme/colors";
import { formatCash } from "@/utils/ui";
import { Box, HStack, ListItem, Text, UnorderedList, VStack } from "@chakra-ui/react";
import { useAccount } from "@starknet-react/core";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import Countdown from "react-countdown";
import { Arrow, InfosIcon } from "../../icons";
import { Dopewars_Game as Game } from "@/generated/graphql";
import { Config } from "@/dojo/stores/config";
import { HustlerAvatarIcon } from "../profile/HustlerAvatarIcon";
import { useSwipeable } from "react-swipeable";
// import { useGameTokens } from "@/lib/metagame-sdk";

const renderer = ({
  days,
  hours,
  minutes,
  seconds,
  completed,
}: {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  completed: boolean;
}) => {
  if (completed) {
    return <Text>RESETS NEXT GAME</Text>;
  } else {
    if (Number.isNaN(days)) {
      days = 4;
      hours = 20;
      minutes = 4;
      seconds = 20;
    }
    return (
      <HStack textStyle="subheading" fontSize="12px">
        <Text color="neon.500">RESETS IN:</Text>
        <Text>
          {days > 0 ? `${days}D` : ""} {hours.toString().padStart(2, "0")}H {minutes.toString().padStart(2, "0")}m{" "}
          {seconds.toString().padStart(2, "0")}s
        </Text>
      </HStack>
    );
  }
};

export const Leaderboard = observer(({ config }: { config?: Config }) => {
  const { router } = useRouterContext();

  const {
    uiStore,
    chains: { selectedChain },
    clients: { rpcProvider },
  } = useDojoContext();
  const { account } = useAccount();
  const { metagameGames, dopeTokens } = useGameTokens({
    sortBy: "score",
    limit: 10,
  });

  console.log(metagameGames, dopeTokens);

  const [currentVersion, setCurrentVersion] = useState(config?.ryo.season_version || 0);
  const [selectedVersion, setSelectedVersion] = useState(config?.ryo.season_version || 0);
  const [ownedTokenIds, setOwnedTokenIds] = useState<Set<number>>(new Set());
  const [isLoadingOwnedTokens, setIsLoadingOwnedTokens] = useState(true);
  const tokenAddressRef = useRef<string | null>(null);

  const { season } = useSeasonByVersion(selectedVersion);

  const {
    registeredGames,
    isFetching: isFetchingRegisteredGames,
    refetch: refetchRegisteredGames,
  } = useRegisteredGamesBySeason(selectedVersion);

  useEffect(() => {
    if (!config) return;

    setCurrentVersion(config?.ryo.season_version || 0);
    refetchRegisteredGames();
  }, [config, refetchRegisteredGames]);

  // Memoize token address fetching to avoid unnecessary re-renders
  const fetchTokenAddress = useCallback(async () => {
    if (tokenAddressRef.current) {
      return tokenAddressRef.current;
    }

    const gameTokenContract = getContractByName(selectedChain.manifest, DW_NS, "game_token_system_v0");
    if (!gameTokenContract?.address) {
      throw new Error("game_token_system contract not found");
    }

    const result = await rpcProvider.callContract(
      {
        contractAddress: gameTokenContract.address,
        entrypoint: "token_address",
      },
      "latest",
    );

    if (result && result.length > 0) {
      const tokenAddress = result[0];
      tokenAddressRef.current = tokenAddress;
      return tokenAddress;
    }

    throw new Error("No token address found");
  }, [selectedChain.manifest, rpcProvider]);

  // Fetch owned tokens for current account
  useEffect(() => {
    const fetchOwnedTokens = async () => {
      if (!account?.address) {
        setOwnedTokenIds(new Set());
        setIsLoadingOwnedTokens(false);
        return;
      }

      try {
        setIsLoadingOwnedTokens(true);
        const tokenAddress = await fetchTokenAddress();
        // const tokenIds = await getGameTokens(account.address, tokenAddress);
        // setOwnedTokenIds(new Set(tokenIds));
      } catch (error) {
        console.error("Error fetching owned tokens:", error);
        setOwnedTokenIds(new Set());
      } finally {
        setIsLoadingOwnedTokens(false);
      }
    };

    fetchOwnedTokens();
  }, [account?.address, fetchTokenAddress, selectedChain.manifest, rpcProvider]);

  // Reset token address when account changes
  useEffect(() => {
    tokenAddressRef.current = null;
  }, [account?.address]);

  const onPrev = async () => {
    if (selectedVersion > 1) {
      setSelectedVersion(selectedVersion - 1);
    }
  };

  const onNext = async () => {
    if (selectedVersion < currentVersion) {
      setSelectedVersion(selectedVersion + 1);
    }
  };

  const onDetails = (version: any) => {
    router.push(`/season/${version}`);
  };

  const { ref: swipeableRef } = useSwipeable({ delta: 50, onSwipedLeft: onNext, onSwipedRight: onPrev });

  if (!config || !registeredGames || !season) {
    return <></>;
  }

  return (
    <VStack w="full" h="100%" ref={swipeableRef}>
      <VStack my="15px" w="full">
        <HStack w="full" justifyContent="space-between">
          <Arrow
            direction="left"
            cursor="pointer"
            opacity={selectedVersion > 1 ? "1" : "0.25"}
            onClick={onPrev}
          ></Arrow>
          <HStack textStyle="subheading" fontSize="12px" w="full" justifyContent="center" position="relative">
            <Text cursor="pointer" onClick={() => onDetails(selectedVersion)}>
              SEASON {selectedVersion} LEADERBOARD
            </Text>
          </HStack>
          <Arrow
            direction="right"
            cursor="pointer"
            opacity={selectedVersion < currentVersion ? "1" : "0.25"}
            onClick={onNext}
          ></Arrow>
        </HStack>
        {selectedVersion === currentVersion && (
          <HStack>
            <Countdown date={new Date(season.next_version_timestamp * 1_000)} renderer={renderer}></Countdown>
            <Box cursor="pointer" onClick={() => uiStore.openSeasonDetails()}>
              <InfosIcon />
            </Box>
          </HStack>
        )}
      </VStack>
      <VStack
        boxSize="full"
        gap="20px"
        maxH={["calc(100dvh - 350px)", "calc(100dvh - 380px)"]}
        sx={{
          overflowY: "scroll",
        }}
        __css={{
          "scrollbar-width": "none",
        }}
      >
        {isFetchingRegisteredGames && <Loader />}
        {!isFetchingRegisteredGames && (
          <UnorderedList boxSize="full" variant="dotted" h="auto">
            {registeredGames && registeredGames.length > 0 ? (
              registeredGames.map((game: Game, index: number) => {
                // Check if player currently owns the token (not just if they are original owner)
                const tokenId = Number(game.minigame_token_id);

                // check if current owner of token
                const isOwn = ownedTokenIds.has(tokenId);
                const color = isOwn ? colors.yellow["400"].toString() : colors.neon["200"].toString();
                const displayName = game.player_name ? `${game.player_name}${isOwn ? " (you)" : ""}` : "Anonymous";

                return (
                  <ListItem color={color} key={game.game_id}>
                    <HStack mr={3}>
                      <Text
                        w={["10px", "30px"]}
                        fontSize={["10px", "16px"]}
                        flexShrink={0}
                        // display={["none", "block"]}
                        whiteSpace="nowrap"
                      >
                        {index + 1}.
                      </Text>
                      <Box
                        flexShrink={0}
                        style={{ marginTop: "-8px" }}
                        cursor="pointer"
                        onClick={() => {
                          if (!game.minigame_token_id || game.minigame_token_id === 0) {
                            console.warn(
                              "[Leaderboard] Cannot navigate: minigame_token_id is missing for game",
                              game.game_id,
                            );
                            return;
                          }
                          router.push(`/0x${game.minigame_token_id.toString(16)}/logs`);
                        }}
                      >
                        <HustlerAvatarIcon
                          gameId={game.game_id}
                          // token_id removed - Dope collection integration stripped
                          // HustlerAvatarIcon will return null when tokenIdType/tokenId are undefined
                          tokenIdType={undefined}
                          tokenId={undefined}
                        />
                      </Box>

                      <HStack>
                        <Text
                          flexShrink={0}
                          maxWidth={["150px", "350px"]}
                          whiteSpace="nowrap"
                          overflow="hidden"
                          fontSize={["12px", "16px"]}
                          cursor="pointer"
                          onClick={() => {
                            if (!game.minigame_token_id || game.minigame_token_id === 0) {
                              console.warn(
                                "[Leaderboard] Cannot navigate: minigame_token_id is missing for game",
                                game.game_id,
                              );
                              return;
                            }
                            router.push(`/0x${game.minigame_token_id.toString(16)}/logs`);
                          }}
                        >
                          {displayName}
                        </Text>
                      </HStack>

                      <Text
                        backgroundImage={`radial-gradient(${color} 20%, transparent 20%)`}
                        backgroundSize="10px 10px"
                        backgroundPosition="left center"
                        backgroundRepeat="repeat-x"
                        flexGrow={1}
                        color="transparent"
                      >
                        {"."}
                      </Text>

                      <Text flexShrink={0} fontSize={["12px", "16px"]}>
                        {formatCash(game.final_score)}
                      </Text>
                    </HStack>
                  </ListItem>
                );
              })
            ) : (
              <Text textAlign="center" color="neon.500">
                No scores submitted yet
              </Text>
            )}
          </UnorderedList>
        )}
      </VStack>
    </VStack>
  );
});
