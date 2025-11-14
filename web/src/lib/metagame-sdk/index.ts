"use client";

export { useGameTokens } from "./sql/hooks/useGameTokens";
export {
  initMetagame,
  getMetagameClientSafe,
  getMetagameClient,
  isMetagameReady,
  resetMetagame,
} from "./shared/singleton";
export { MetagameClient } from "./shared/client";
export { MetagameProvider } from "./shared/provider";
export { executeSqlQuery } from "./sql/services/sqlService";
export { gamesQuery } from "./sql/queries/sql";
import { padAddress } from "./shared/lib";
import { getMetagameClientSafe } from "./shared/singleton";

/**
 * Get token IDs owned by a specific address
 * Used by Leaderboard to check ownership
 * @param ownerAddress - The address to check ownership for
 * @param tokenAddress - The token contract address (optional, not used in query but kept for API compatibility)
 */
export async function getGameTokens(ownerAddress: string, tokenAddress?: string): Promise<number[]> {
  if (!ownerAddress) {
    return [];
  }

  const client = getMetagameClientSafe();
  if (!client) {
    console.warn("Metagame client not initialized");
    return [];
  }

  const toriiUrl = client.getToriiUrl();
  const namespace = client.getNamespace();

  if (!toriiUrl || !namespace) {
    return [];
  }

  const paddedOwner = padAddress(ownerAddress);
  const query = `
    SELECT DISTINCT gt.token_id
    FROM '${namespace}-GameToken' gt
    WHERE gt.player_id = "${paddedOwner}"
  `;

  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`${toriiUrl}/sql?query=${encodedQuery}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch owned tokens:", response.statusText);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    // Extract token IDs and convert from hex/U256 format to numbers
    return data
      .map((row: any) => {
        if (row.token_id) {
          // Handle hex string format
          const tokenIdStr = row.token_id.toString().replace(/["']/g, "").replace(/^0x/, "");
          const tokenId = parseInt(tokenIdStr, 16);
          return isNaN(tokenId) ? null : tokenId;
        }
        return null;
      })
      .filter((id: number | null): id is number => id !== null);
  } catch (error) {
    console.error("Error fetching owned tokens:", error);
    return [];
  }
}
