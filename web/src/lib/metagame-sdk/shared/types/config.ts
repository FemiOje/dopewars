import { LoggerConfig } from "../utils/logger";

export interface MetagameConfig {
  toriiUrl: string;
  dojoSDK?: any; // Optional, not used for SQL queries
  toriiClient?: any; // Optional, not used for SQL queries
  namespace?: string;
  tokenAddress?: string;
  worldAddress?: string;
  relayUrl?: string;
  domain?: {
    name: string;
    version: string;
    chainId: string;
    revision: string;
  };
  logging?: Partial<LoggerConfig>;
}
