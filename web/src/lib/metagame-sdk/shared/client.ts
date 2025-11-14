"use client";

import { MetagameConfig } from "./types/config";

export class MetagameClient {
  private config: MetagameConfig;
  private namespace: string;
  private tokenAddress: string;

  constructor(config: MetagameConfig) {
    this.config = {
      ...config,
    };

    this.namespace = config.namespace || "dopewars";
    this.tokenAddress = config.tokenAddress || "0x036017e69d21d6d8c13e266eabb73ef1f1d02722d86bdcabe5f168f8e549d3cd";
  }

  static async create(config: MetagameConfig): Promise<MetagameClient> {
    // For SQL queries only, we don't need dojoSDK
    // Just return the client instance
    return new MetagameClient(config);
  }

  getConfig(): MetagameConfig {
    console.log("[MetagameClient.getConfig] Returning config with toriiUrl:", this.config.toriiUrl);
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
