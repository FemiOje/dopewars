import { Hustler, Hustlers } from "@/components/hustlers";
import { PowerMeter } from "@/components/player";
import { useConfigStore, useGameStore, useRouterContext } from "@/dojo/hooks";
import { ItemSlot } from "@/dojo/types";
import { useToast } from "@/hooks/toast";
import { Box, Button, HStack, VStack } from "@chakra-ui/react";
import { observer } from "mobx-react-lite";
import { useEffect, useMemo, useState } from "react";
import ShareButton from "./ShareButton";
import { HustlerPreviewFromLoot, HustlerPreviewFromHustler } from "@/dope/components";
import { HustlerAvatarIcon } from "./HustlerAvatarIcon";
import { HustlerPreviewFromGame } from "./HustlerPreviewFromGame";

export const HustlerProfile = observer(() => {
  const { gameId } = useRouterContext();
  const { game, gameInfos, gameEvents } = useGameStore();
  const configStore = useConfigStore();
  const { toast } = useToast();

  if (!configStore || !game) return null;

  return (
    <VStack w="full" gap={6}>
      <HStack w="full" p="20px" justifyContent="center" gap={6}>
        <Box
          alignItems="center"
          h={["190px", "260px"]}
          w={["190px", "260px"]}
          position="relative"
          transform={"scale(2)"}
          zIndex={99}
          pointerEvents="none"
          overflow="hidden"
        >
          {/* token_id removed from Game model - Dope collection integration stripped */}
          {/* Hustler preview components removed as they required token_id */}
        </Box>
      </HStack>

      {/* <Card>
        <HustlerStats />
      </Card> */}

      <HStack w="100%" maxW={["260px", "360px"]}>
        <Button
          variant="pixelated"
          w="full"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/${gameId}/logs`);

            toast({
              message: "Copied to clipboard",
            });
          }}
        >
          Game Link
        </Button>
        <ShareButton variant="pixelated" />
      </HStack>
    </VStack>
  );
});
