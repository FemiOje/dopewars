import { Layout } from "@/components/layout";
import { Loader, OGLoader } from "@/components/layout/Loader";
import { useGameStore, useRouterContext } from "@/dojo/hooks";
import { PlayerStatus } from "@/dojo/types";
import { HStack } from "@chakra-ui/react";
import { useAccount } from "@starknet-react/core";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

const Redirector = observer(() => {
  const { router, gameId } = useRouterContext();

  const { account } = useAccount();

  const gameStore = useGameStore();
  const { game } = gameStore;

  useEffect(() => {
    // Don't set timeout if game is being created
    if (gameStore.isCreatingGame) {
      return;
    }

    if (!game) {
      const handle = setTimeout(() => {
        router.push(`/`);
      }, 10000); // temp fix for slow indexer

      return () => clearTimeout(handle);
    }

    // Game exists, redirect to appropriate page
    // Use tokenId from gameStore if available (correct value), otherwise fall back to gameId from router
    const tokenId = gameStore.tokenId || gameId;

    if (game.gameInfos.game_over) {
      router.push(`/${tokenId}/end`);
    } else if (game.player.status === PlayerStatus.Normal) {
      if (game.player.location) {
        router.push(`/${tokenId}/${game.player.location.location}`);
      } else {
        router.push(`/${tokenId}/travel`);
      }
    } else if (game.player.status === PlayerStatus.BeingArrested || game.player.status === PlayerStatus.BeingMugged) {
      router.push(`/${tokenId}/event/decision`);
    }
  }, [game, game?.player.status, game?.player.location, router, gameId, gameStore.tokenId, gameStore.isCreatingGame]);

  return (
    <Layout isSinglePanel>
      <HStack h="full" alignItems="center" justifyContent="center">
        {/* <OGLoader /> */}
        <Loader text={gameStore.isCreatingGame ? "STARTING GAME ..." : "LOADING ..."} />
      </HStack>
    </Layout>
  );
});

export default Redirector;
