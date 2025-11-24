"use client";

import { MetagameConfig } from "./types/config";

export class MetagameClient {
  private config: MetagameConfig;
  private namespace: string;
  private tokenAddress: string;

  constructor(config: MetagameConfig, discoveredNamespace?: string) {
    // remove /graphql suffix if present
    let normalizedToriiUrl = config.toriiUrl;
    if (normalizedToriiUrl.endsWith("/graphql")) {
      normalizedToriiUrl = normalizedToriiUrl.replace("/graphql", "");
    }
    if (normalizedToriiUrl.endsWith("/graphql/")) {
      normalizedToriiUrl = normalizedToriiUrl.replace("/graphql/", "");
    }

    this.config = {
      ...config,
      toriiUrl: normalizedToriiUrl,
    };

    this.namespace = discoveredNamespace || config.namespace || "dopewars";
    this.tokenAddress = config.tokenAddress || "0x02334dc9c950c74c3228e2a343d495ae36f0b4edf06767a679569e9f9de08776"; // sepolia token address
    // this.tokenAddress = config.tokenAddress || "0x036017e69d21d6d8c13e266eabb73ef1f1d02722d86bdcabe5f168f8e549d3cd"; // mainnet token address
  }

  static async create(config: MetagameConfig): Promise<MetagameClient> {
    // For SQL queries only, we don't need dojoSDK
    // If namespace is not provided, try to discover it
    let finalConfig = { ...config };

    let discoveredNamespace: string | undefined;
    if (!finalConfig.namespace) {
      try {
        discoveredNamespace = (await MetagameClient.discoverNamespace(finalConfig.toriiUrl)) || undefined;
        if (discoveredNamespace) {
          console.log(`🔍 Discovered namespace: ${discoveredNamespace}`);
        } else {
          console.warn("⚠️ Could not discover namespace, will use default: dopewars");
        }
      } catch (error) {
        console.warn("⚠️ Failed to discover namespace, using default:", error);
      }
    } else {
      console.log(`📌 Using provided namespace: ${finalConfig.namespace}`);
    }

    return new MetagameClient(finalConfig, discoveredNamespace);
  }

  /**
   * Discover the namespace by querying available tables
   */
  static async discoverNamespace(toriiUrl: string): Promise<string | null> {
    try {
      let normalizedUrl = toriiUrl;
      if (normalizedUrl.endsWith("/graphql")) {
        normalizedUrl = normalizedUrl.replace("/graphql", "");
      }
      if (normalizedUrl.endsWith("/graphql/")) {
        normalizedUrl = normalizedUrl.replace("/graphql/", "");
      }

      // Query SQLite to get all table names - look for dopewars-GameToken or similar patterns
      const query =
        "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'dopewars-%' OR name LIKE '%-GameToken' OR name LIKE '%-TokenMetadataUpdate') LIMIT 1";
      const encodedQuery = encodeURIComponent(query);
      const sqlUrl = `${normalizedUrl}/sql`;
      const fullUrl = `${sqlUrl}?query=${encodedQuery}`;

      const response = await fetch(fullUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn("Failed to discover namespace, status:", response.status);
        return null;
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        // Extract namespace from table name
        const tableName = data[0].name as string;
        let namespace: string;
        if (tableName.includes("-GameToken")) {
          namespace = tableName.replace("-GameToken", "");
        } else if (tableName.includes("-TokenMetadataUpdate")) {
          namespace = tableName.replace("-TokenMetadataUpdate", "");
        } else if (tableName.startsWith("dopewars-")) {
          namespace = "dopewars";
        } else {
          // Extract namespace prefix (everything before first dash)
          const parts = tableName.split("-");
          namespace = parts[0] || "dopewars";
        }
        console.log(`✅ Found namespace from table: ${tableName} -> ${namespace}`);
        return namespace;
      }

      return null;
    } catch (error) {
      console.warn("Error discovering namespace:", error);
      return null;
    }
  }

  getConfig(): MetagameConfig {
    return this.config;
  }

  getNamespace(): string {
    return this.namespace;
  }

  getTokenAddress(): string {
    return this.tokenAddress;
  }

  getToriiUrl(): string {
    return this.config.toriiUrl;
  }
}
