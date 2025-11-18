import { useDojoContext, useGameStore, useRouterContext } from "@/dojo/hooks";
import { Button, HStack, Modal, ModalBody, ModalContent, ModalHeader, ModalOverlay, VStack } from "@chakra-ui/react";
import { observer } from "mobx-react-lite";

export const RefreshGameModal = observer(() => {
  const { router, gameId } = useRouterContext();
  const { uiStore } = useDojoContext();
  const gameStore = useGameStore();
  const { game } = gameStore;

  return (
    <Modal motionPreset="slideInBottom" isCentered isOpen={uiStore.modals.refreshGame !== undefined} onClose={() => {}}>
      <ModalOverlay />
      <ModalContent bg="bg.dark" maxW="360px">
        <ModalHeader textAlign="center">Im lost</ModalHeader>
        <ModalBody p={6}>
          <VStack w="full" gap={6}>
            <HStack w="full" justifyContent="center">
              <Button
                onClick={() => {
                  game?.clearPendingCalls();
                  uiStore.closeRefreshGame();

                  const tokenId = gameStore.tokenId;
                  if (tokenId) {
                    router.push(`/${tokenId}`);
                  } else {
                    router.push("/");
                  }
                }}
              >
                REFRESH PLZ
              </Button>
              <Button onClick={() => uiStore.closeRefreshGame()}>CANCEL</Button>
            </HStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
});
