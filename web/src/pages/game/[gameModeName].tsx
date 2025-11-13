import { Button, Input } from "@/components/common";
import { Footer, Layout } from "@/components/layout";
import { ChildrenOrConnect } from "@/components/wallet";
import { gameModeFromName, gameModeFromNameKeys } from "@/dojo/helpers";
import { useConfigStore, useRouterContext, useSeasonByVersion, useSystems } from "@/dojo/hooks";
import { GameMode } from "@/dojo/types";
import { play } from "@/hooks/media";
import { Sounds, playSound } from "@/hooks/sound";
import { useToast } from "@/hooks/toast";
import { IsMobile } from "@/utils/ui";
import { Box, Card, HStack, Heading, Text, VStack } from "@chakra-ui/react";
import { useAccount, useConnect } from "@starknet-react/core";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { ControllerConnector } from "@cartridge/connector";

// TokenIdType enum removed - Dope collection integration stripped
// All games now use default equipment

const New = observer(() => {
  const { router, isRyoDotGame, isLocalhost, gameModeName } = useRouterContext();
  const gameMode = gameModeFromName[gameModeName as gameModeFromNameKeys] as GameMode;
  const { connector } = useConnect();

  const { account } = useAccount();
  const { mintGameToken, createGame, isPending } = useSystems();
  const configStore = useConfigStore();
  const { config } = configStore;
  const { season } = useSeasonByVersion(config?.ryo.season_version);

  const { toast } = useToast();

  // Dope collection integration removed - no token selection needed
  // All games use default equipment

  const inputRef = useRef<null | HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const isMobile = IsMobile();

  useEffect(() => {
    const initAsync = async () => {
      const username = await (connector as unknown as ControllerConnector).controller.username();
      setName(username?.substring(0, 16) || "");
    };
    if (connector) {
      initAsync();
    }
  }, [connector, account?.address]);

  // Dope collection integration removed - no equipment stats or token selection needed
  // All games use default equipment

  const create = async (gameMode: GameMode) => {
    setError("");
    if (name === "" || name.length > 16 || name.length < 3) {
      setError("Invalid name, at least 3 chars, max 16!");
      inputRef.current && inputRef.current.scrollIntoView();
      return;
    }

    try {
      if (!isLocalhost) {
        play();
      }

      // mint game token
      const { tokenId: minigameTokenId } = await mintGameToken(name);

      if (!minigameTokenId) {
        setError("Failed to mint game token");
        toast({ message: "Failed to mint game token", isError: true, duration: 5000 });
        return;
      }

      // create the game with minted token (no token selection needed - uses default equipment)
      // Multiplier is always 1 for budokan tournament
      await createGame(gameMode, name, 1, minigameTokenId);
    } catch (e) {
      console.log(e);
      setError("Game creation failed");
    }
  };

  // Character selection removed - no swiping/cycling needed

  if (!configStore || !season) return null;

  return (
    <Layout
      isSinglePanel
      footer={
        <Footer>
          <Button
            w={["full", "auto"]}
            px={["auto", "20px"]}
            onClick={() => {
              playSound(Sounds.Ooo, 0.3);
              router.push("/");
            }}
          >
            Im scared
          </Button>

          <ChildrenOrConnect variant="primary" h="35px">
            {gameMode == GameMode.Ranked && (
              <Button w={["full", "auto"]} px={["auto", "20px"]} isLoading={isPending} onClick={() => create(gameMode)}>
                Play
              </Button>
            )}
            {gameMode == GameMode.Noob && (
              <Button w={["full", "auto"]} px={["auto", "20px"]} isLoading={isPending} onClick={() => create(gameMode)}>
                Play
              </Button>
            )}
          </ChildrenOrConnect>
          {/* <Button
              w={["full", "auto"]}
              px={["auto", "20px"]}
              isLoading={isPending}
              onClick={() => create(GameMode.Warrior)}
            >
              Play Warrior
            </Button> */}
        </Footer>
      }
    >
      <VStack w={["full", "700px"]} margin="auto">
        <VStack w="full" gap={[3, 6]} overflowX="hidden">
          <VStack>
            <Text textStyle="subheading" fontSize={["11px", "11px"]} my={["10px", "0"]} letterSpacing="0.25em">
              Create Your Game
            </Text>
            {!isMobile && (
              <Heading fontSize={["30px", "48px"]} fontWeight="400" textAlign="center">
                Dope Wars
              </Heading>
            )}
          </VStack>

          <VStack w="full" ref={inputRef}>
            <Input
              display="flex"
              mx="auto"
              maxW="260px"
              maxLength={16}
              placeholder="Enter your name"
              autoFocus
              value={name}
              onChange={(e) => {
                setError("");
                setName(e.target.value);
              }}
            />

            <VStack w="full" h="30px">
              {/* <Text w="full" align="center" color="red" display={name.length === 20 ? "block" : "none"}>
                Max 20 characters
              </Text> */}
              <Text w="full" align="center" color="red" display={error !== "" ? "block" : "none"}>
                {error}
              </Text>
            </VStack>
          </VStack>

          <Box minH="80px" />
        </VStack>
      </VStack>
    </Layout>
  );
});

export default New;
