import { padAddress, padU64, stringToFelt } from "../../shared/lib";

const getSortColumn = (sortBy: string): string => {
  switch (sortBy) {
    case "score":
      return "0"; // Simplified - score not available without NewHighScore table structure
    case "minted_at":
      return "gt.internal_created_at";
    case "player_name":
      return "gt.player_id";
    case "token_id":
      return "gt.token_id";
    case "game_over":
      return "0"; // Simplified - game_over not available without GameOver table structure
    case "owner":
      return "gt.player_id";
    case "game_id":
      return "gt.game_id";
    default:
      return "gt.internal_created_at";
  }
};

interface GamesQueryParams {
  namespace: string;
  owner?: string;
  gameAddresses?: string[];
  tokenIds?: number[];
  hasContext?: boolean;
  context?: {
    id?: number;
    name?: string;
    attributes?: Record<string, string>;
  };
  settings_id?: number;
  completed_all_objectives?: boolean;
  soulbound?: boolean;
  objective_id?: string;
  mintedByAddress?: string;
  gameOver?: boolean;
  score?: {
    min?: number;
    max?: number;
    exact?: number;
  };
  started?: boolean;
  expired?: boolean;
  playerName?: string;
  limit?: number;
  offset?: number;
  sortBy?: "score" | "minted_at" | "player_name" | "token_id" | "game_over" | "owner" | "game_id";
  sortOrder?: "asc" | "desc";
}

const buildGameConditions = (
  params: Omit<GamesQueryParams, "namespace" | "limit" | "offset" | "sortBy" | "sortOrder">,
) => {
  const conditions = [];
  const {
    owner,
    gameAddresses,
    tokenIds,
    hasContext,
    context,
    settings_id,
    completed_all_objectives,
    soulbound,
    objective_id,
    mintedByAddress,
    gameOver,
    score,
    started,
    expired,
    playerName,
  } = params;

  if (owner) {
    conditions.push(`gt.player_id = "${padAddress(owner)}"`);
  }

  if (gameAddresses && gameAddresses.length > 0) {
    // For dopewars, we might need to join with Game table if contract_address is there
    // For now, we'll filter by game_id if needed
    console.warn("gameAddresses filter not fully implemented for dopewars schema");
  }

  if (tokenIds && tokenIds.length > 0) {
    const tokenIdConditions = tokenIds.map((id) => `'${id}'`).join(",");
    conditions.push(`gt.token_id IN (${tokenIdConditions})`);
  }

  if (mintedByAddress) {
    conditions.push(`gt.player_id = "${padAddress(mintedByAddress)}"`);
  }

  // Note: gameOver filter removed - GameOver table structure unknown
  // Will need to check actual table structure to implement this filter
  if (gameOver !== undefined) {
    console.warn("gameOver filter not implemented - GameOver table structure needs verification");
  }

  // Note: score filter removed - NewHighScore table structure unknown
  // Will need to check actual table structure to implement this filter
  if (score) {
    console.warn("score filter not implemented - NewHighScore table structure needs verification");
    // Score filtering disabled until table structure is verified
  }

  if (playerName) {
    // In dopewars schema, player_id is the address, so we can't filter by name directly
    // This would need to be handled differently if player names are stored elsewhere
    console.warn("playerName filter not fully implemented for dopewars schema");
  }

  // Note: Many metagame-sdk specific filters (hasContext, settings_id, completed_all_objectives,
  // soulbound, objective_id, started, expired) are not directly applicable to dopewars schema
  // These are kept for API compatibility but may not filter correctly

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
};

export const gamesCountQuery = (params: Omit<GamesQueryParams, "limit" | "offset" | "sortBy" | "sortOrder">) => {
  const { namespace } = params;
  const whereClause = buildGameConditions(params);

  // Simplified query - only use GameToken table
  return `
  SELECT COUNT(DISTINCT gt.token_id) as count
  FROM '${namespace}-GameToken' gt
  ${whereClause}
  `;
};

export const gamesQuery = ({
  namespace,
  owner,
  gameAddresses,
  tokenIds,
  hasContext,
  context,
  settings_id,
  completed_all_objectives,
  soulbound,
  objective_id,
  mintedByAddress,
  gameOver,
  score,
  started,
  expired,
  playerName,
  limit = 100,
  offset = 0,
  sortBy = "minted_at",
  sortOrder = "desc",
}: GamesQueryParams) => {
  const whereClause = buildGameConditions({
    owner,
    gameAddresses,
    tokenIds,
    hasContext,
    context,
    settings_id,
    completed_all_objectives,
    soulbound,
    objective_id,
    mintedByAddress,
    gameOver,
    score,
    started,
    expired,
    playerName,
  });

  // Simplified query - only use GameToken table, remove joins until table structures are verified
  return `
  SELECT
    gt.token_id,
    gt.game_id,
    gt.player_id as owner,
    gt.player_id as minted_by_address,
    gt.internal_created_at as minted_at,
    0 as game_over,
    0 as score,
    gt.player_id as player_name,
    NULL as context,
    NULL as settings_data,
    NULL as objective_ids,
    NULL as objectives_data,
    NULL as renderer,
    NULL as client_url,
    NULL as game_metadata_id,
    NULL as game_metadata_contract_address,
    NULL as game_metadata_name,
    NULL as game_metadata_description,
    NULL as game_metadata_developer,
    NULL as game_metadata_publisher,
    NULL as game_metadata_genre,
    NULL as game_metadata_image,
    NULL as game_metadata_client_url,
    NULL as game_metadata_renderer_address,
    NULL as lifecycle_start,
    NULL as lifecycle_end,
    NULL as settings_id,
    NULL as soulbound,
    NULL as completed_all_objectives
  FROM '${namespace}-GameToken' gt
  ${whereClause}
  GROUP BY 
    gt.token_id
  ORDER BY ${getSortColumn(sortBy)} ${sortOrder.toUpperCase()}
  ${limit !== undefined ? `LIMIT ${limit}` : ""}
  ${offset !== undefined && offset > 0 ? `OFFSET ${offset}` : ""}
  `;
};
