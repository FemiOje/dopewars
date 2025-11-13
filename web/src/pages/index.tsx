import { Button } from "@/components/common";
import { CopsIcon, Flipflop, Warning } from "@/components/icons";
import { Layout } from "@/components/layout";
import { HomeLeftPanel, Leaderboard, Tutorial, YourGames } from "@/components/pages/home";
import { useConfigStore, useDojoContext, useRouterContext, useSeasonByVersion } from "@/dojo/hooks";
import { Card, HStack, Tab, TabList, TabPanel, TabPanels, Tabs, Text, VStack } from "@chakra-ui/react";
import { useAccount, useConnect } from "@starknet-react/core";
import { useState } from "react";
import { GameMode } from "@/dojo/types";
import { Glock } from "@/components/icons/items";
import { gameModeName } from "@/dojo/helpers";

export default function Home() {
  const { router, isLocalhost } = useRouterContext();
  const { account } = useAccount();
  const { uiStore } = useDojoContext();
  const { connectors, connect } = useConnect();

  const configStore = useConfigStore();
  const { config } = configStore;
  const { season, isSeasonOpen, canCreateGame } = useSeasonByVersion(config?.ryo.season_version);

  const isPaused = config?.ryo.paused;

  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  const onHustle = async (gameMode: GameMode) => {
    const mode = gameModeName[gameMode];
    if (!account) {
      if (connectors.length > 1) {
        uiStore.openConnectModal();
      } else {
        connect({ connector: connectors[0] });

        if (connectors[0].id !== "controller") {
          router.push(`/game/${mode}`);
        }
      }
    }

    if (account) {
      router.push(`/game/${mode}`);
    }
  };

  return (
    <Layout
      customLeftPanel={<HomeLeftPanel />}
      rigthPanelScrollable={false}
      // rigthPanelMaxH="calc(100dvh - 230px)"
    >
      <VStack boxSize="full" gap="10px">
        <Card variant="pixelated">
          <HStack w="full" p={["10px", "20px"]} gap="10px" justify="center">
            {isPaused && (
              <HStack w="full" color="yellow.400" justifyContent="center" alignItems="center" gap={6}>
                <CopsIcon color="yellow.400" />
                <VStack flexDirection={["column", "row"]}>
                  <Text>Game under arrest.</Text>
                  <Text>The streets are silent...</Text>
                </VStack>
              </HStack>
            )}
            {/* {!isPaused && isSeasonOpen && canCreateGame && (
              <Button flex="1" onClick={() => onHustle(GameMode.Noob)}>
                <Flipflop /> Play guest
              </Button>
            )} */}
            {!isPaused && isSeasonOpen && canCreateGame && (
              <Button flex="1" onClick={() => onHustle(GameMode.Ranked)}>
                <Glock /> Hustle
              </Button>
            )}

            {!isPaused && isSeasonOpen && !canCreateGame && (
              <HStack w="full" color="yellow.400" justifyContent="center" gap={3}>
                {/* <Button flex="1" onClick={() => onHustle(GameMode.Noob)}>
                  <Flipflop /> Play guest
                </Button> */}

                <HStack flex="1" h="full" alignItems="center" justifyContent="center">
                  <Warning color="yellow.400" />
                  <Text>Waiting for season end</Text>
                </HStack>
              </HStack>
            )}
          </HStack>
        </Card>

        <Tabs variant="unstyled" w="full">
          <TabList pb={6}>
            <Tab>LEADERBOARD</Tab>
            <Tab>YOUR GAMES</Tab>
          </TabList>

          <TabPanels mt={0} maxH={["100%", "calc(100dvh - 380px)"]} overflowY="scroll">
            <TabPanel p={0}>
              <Leaderboard config={config} />
            </TabPanel>
            <TabPanel p={0}>
              <YourGames />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>

      <Tutorial isOpen={isTutorialOpen} close={() => setIsTutorialOpen(false)} />
    </Layout>
  );
}
