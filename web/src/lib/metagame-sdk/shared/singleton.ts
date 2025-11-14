"use client";

import { MetagameClient } from "./client";
import { MetagameConfig } from "./types/config";
import { clearAllStores } from "./subscriptions/stores";
import { logger } from "./utils/logger";

let metagameClientInstance: MetagameClient | null = null;
let isInitialized = false;
let currentConfig: MetagameConfig | null = null;
let isInitializing = false;

export async function initMetagame(config: MetagameConfig): Promise<MetagameClient> {
  if (metagameClientInstance && isInitialized && currentConfig) {
    const configChanged =
      currentConfig.toriiUrl !== config.toriiUrl || currentConfig.worldAddress !== config.worldAddress;

    if (configChanged) {
      logger.info("[initMetagame] Config changed, reinitializing SDK");
      logger.info("[initMetagame] Old config:", {
        toriiUrl: currentConfig.toriiUrl,
        worldAddress: currentConfig.worldAddress,
      });
      logger.info("[initMetagame] New config:", { toriiUrl: config.toriiUrl, worldAddress: config.worldAddress });

      isInitializing = true;
      clearAllStores();
      metagameClientInstance = null;
      isInitialized = false;
    } else {
      return metagameClientInstance;
    }
  }

  if (config.logging !== undefined) {
    logger.configure(config.logging);
  }

  isInitializing = true;
  metagameClientInstance = await MetagameClient.create(config);
  isInitialized = true;
  isInitializing = false;
  currentConfig = config;
  logger.info("[initMetagame] SDK initialized successfully", {
    toriiUrl: metagameClientInstance.getToriiUrl(),
    namespace: metagameClientInstance.getNamespace(),
  });
  return metagameClientInstance;
}

export function initMetagameSync(config: MetagameConfig): MetagameClient {
  if (metagameClientInstance && isInitialized && currentConfig) {
    const configChanged =
      currentConfig.toriiUrl !== config.toriiUrl || currentConfig.worldAddress !== config.worldAddress;

    if (configChanged) {
      logger.info("[initMetagameSync] Config changed, reinitializing SDK");
      logger.info("[initMetagameSync] Old config:", {
        toriiUrl: currentConfig.toriiUrl,
        worldAddress: currentConfig.worldAddress,
      });
      logger.info("[initMetagameSync] New config:", { toriiUrl: config.toriiUrl, worldAddress: config.worldAddress });

      clearAllStores();
      metagameClientInstance = null;
      isInitialized = false;
    } else {
      return metagameClientInstance;
    }
  }

  if (config.logging !== undefined) {
    logger.configure(config.logging);
  }

  metagameClientInstance = new MetagameClient(config);
  isInitialized = true;
  currentConfig = config;
  return metagameClientInstance;
}

export function getMetagameClient(): MetagameClient {
  if (!metagameClientInstance || !isInitialized) {
    throw new Error("Metagame SDK is not initialized. Call initMetagame() before using getMetagameClient().");
  }
  logger.debug("[getMetagameClient] Returning singleton instance with toriiUrl:", metagameClientInstance.getToriiUrl());
  return metagameClientInstance;
}

export function getMetagameClientSafe(): MetagameClient | null {
  if (!metagameClientInstance || !isInitialized || isInitializing) {
    logger.debug("[getMetagameClientSafe] SDK not ready:", {
      hasInstance: !!metagameClientInstance,
      isInitialized,
      isInitializing,
    });
    return null;
  }
  return metagameClientInstance;
}

export function isMetagameReady(): boolean {
  return !!metagameClientInstance && isInitialized && !isInitializing;
}

export function resetMetagame(): void {
  logger.info("[resetMetagame] Resetting SDK instance and clearing stores");
  clearAllStores();
  metagameClientInstance = null;
  isInitialized = false;
  isInitializing = false;
  currentConfig = null;
}
