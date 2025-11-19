"use client";

import { initMetagame, MetagameProvider as MetagameSDKProvider } from "@/lib/metagame-sdk";
import { ReactNode, useEffect, useState } from "react";
import { Flex, VStack } from "@chakra-ui/react";
import { useDojoContext } from "../hooks/useDojoContext";
import { Loader } from "@/components/layout/Loader";

interface MetagameProviderProps {
  children: ReactNode;
}

export const MetagameProvider = ({ children }: MetagameProviderProps) => {
  const [metagameClient, setMetagameClient] = useState<any>(undefined);
  const {
    chains: { selectedChain },
  } = useDojoContext();

  useEffect(() => {
    if (!selectedChain) {
      setMetagameClient(undefined);
      return;
    }

    // Only initialize if metagame config is available
    if (!selectedChain.metagameToriiUrl || !selectedChain.metagameWorldAddress) {
      console.warn(`⚠️ Metagame SDK not configured for chain ${selectedChain.name}`);
      setMetagameClient(null); // Set to null to indicate no metagame support
      return;
    }

    // Initialize Metagame SDK with config from selectedChain
    initMetagame({
      toriiUrl: selectedChain.metagameToriiUrl,
      worldAddress: selectedChain.metagameWorldAddress,
    })
      .then((client) => {
        console.log("✅ Metagame SDK setup complete!");
        console.log("📊 SDK Configuration:", {
          toriiUrl: client.getToriiUrl(),
          namespace: client.getNamespace(),
          tokenAddress: client.getTokenAddress(),
          chain: selectedChain.name,
        });
        setMetagameClient(client);
      })
      .catch((error) => {
        console.error(`❌ Failed to initialize Metagame SDK for chain ${selectedChain.name}:`, error);
        setMetagameClient(undefined);
      });
  }, [selectedChain]);

  if (!metagameClient) {
    return (
      <Flex minH="100dvh" alignItems="center" justifyContent="center">
        <VStack>
          <Loader text="Initializing Metagame SDK..." />
        </VStack>
      </Flex>
    );
  }
  // @ts-ignore
  return <MetagameSDKProvider metagameClient={metagameClient}>{children}</MetagameSDKProvider>;
};
