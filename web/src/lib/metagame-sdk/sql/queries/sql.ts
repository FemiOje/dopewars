import { padAddress, padU64, stringToFelt } from "../../shared/lib";

// Helper function to map sortBy field to SQL column
const getSortColumn = (sortBy: string): string => {
  switch (sortBy) {
    case "score":
      return "score";
    case "minted_at":
      return "minted_at";
    case "player_name":
      return "player_name";
    case "token_id":
      return "o.token_id";
    case "game_over":
      return "game_over";
    case "owner":
      return "o.owner";
    case "game_id":
      return "tm.game_id";
    default:
      return "minted_at";
  }
};

export const miniGamesCountQuery = ({ namespace, gameAddresses }: { namespace: string; gameAddresses?: string[] }) => {
  return `
  SELECT COUNT(*) as count
  FROM '${namespace}-GameMetadataUpdate'
  ${gameAddresses ? `WHERE contract_address IN (${gameAddresses.map((address) => `'${address}'`).join(",")})` : ""}
  `;
};

export const miniGamesQuery = ({
  namespace,
  gameAddresses,
  limit,
  offset = 0,
}: {
  namespace: string;
  gameAddresses?: string[];
  limit?: number;
  offset?: number;
}) => {
  return `
  SELECT *
  FROM '${namespace}-GameMetadataUpdate'
  ${gameAddresses ? `WHERE contract_address IN (${gameAddresses.map((address) => `'${address}'`).join(",")})` : ""}
  ${limit !== undefined ? `LIMIT ${limit}` : ""}
  ${offset !== undefined && offset > 0 ? `OFFSET ${offset}` : ""}
  `;
};

export const metaGamesQuery = (limit: number, offset: number) => `
  SELECT namespace 
  FROM models 
  WHERE name = 'MetaGameMetadata'
  LIMIT ${limit}
  OFFSET ${offset}
`;

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
  // Lifecycle filters
  started?: boolean; // Filter for games that have started (current time >= lifecycle_start)
  expired?: boolean; // Filter for games that have expired (current time >= lifecycle_end)
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
    conditions.push(`o.owner = "${padAddress(owner)}"`);
  }

  if (gameAddresses && gameAddresses.length > 0) {
    conditions.push(`gr.contract_address IN (${gameAddresses.map((address) => `'${padAddress(address)}'`).join(",")})`);
  }

  if (tokenIds && tokenIds.length > 0) {
    conditions.push(`tm.id IN (${tokenIds.map((id) => `'${padU64(BigInt(id))}'`).join(",")})`);
  }

  if (hasContext) {
    conditions.push(`tm.has_context = 1`);
  }

  if (mintedByAddress) {
    conditions.push(`mr.minter_address = "${padAddress(mintedByAddress)}"`);
  }

  if (settings_id !== undefined) {
    conditions.push(`tm.settings_id = '${Number(settings_id)}'`);
  }

  if (completed_all_objectives !== undefined) {
    conditions.push(`tm.completed_all_objectives = ${completed_all_objectives ? 1 : 0}`);
  }

  if (soulbound !== undefined) {
    conditions.push(`tm.soulbound = ${soulbound ? 1 : 0}`);
  }

  if (objective_id) {
    conditions.push(`tobj.objective_id = '${objective_id}'`);
  }

  if (gameOver !== undefined) {
    conditions.push(`tm.game_over = ${gameOver ? 1 : 0}`);
  }

  if (score) {
    if (score.exact !== undefined) {
      conditions.push(`COALESCE(s.score, 0) = ${score.exact}`);
    } else {
      if (score.min !== undefined) {
        conditions.push(`COALESCE(s.score, 0) >= ${score.min}`);
      }
      if (score.max !== undefined) {
        conditions.push(`COALESCE(s.score, 0) <= ${score.max}`);
      }
    }
  }

  // Lifecycle filters - use current timestamp
  const currentTime = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

  if (started !== undefined) {
    if (started) {
      // Game has started: current time >= lifecycle_start (or lifecycle_start is 0x0000000000000000)
      conditions.push(
        `(tm.lifecycle_start = '0x0000000000000000' OR ${currentTime} >= CAST(tm.lifecycle_start AS INTEGER))`,
      );
    } else {
      // Game has not started: current time < lifecycle_start (and lifecycle_start is not 0x0000000000000000)
      conditions.push(
        `(tm.lifecycle_start != '0x0000000000000000' AND ${currentTime} < CAST(tm.lifecycle_start AS INTEGER))`,
      );
    }
  }

  if (expired !== undefined) {
    if (expired) {
      // Game has expired: current time >= lifecycle_end (and lifecycle_end is not 0x0000000000000000)
      conditions.push(
        `(tm.lifecycle_end != '0x0000000000000000' AND ${currentTime} >= CAST(tm.lifecycle_end AS INTEGER))`,
      );
    } else {
      // Game has not expired: current time < lifecycle_end (or lifecycle_end is 0x0000000000000000)
      conditions.push(
        `(tm.lifecycle_end = '0x0000000000000000' OR ${currentTime} < CAST(tm.lifecycle_end AS INTEGER))`,
      );
    }
  }

  if (context) {
    if (context.id) {
      conditions.push(`JSON_EXTRACT(tc.context_data, '$.Context Id') = '${context.id}'`);
    }

    if (context.name) {
      conditions.push(`JSON_EXTRACT(tc.context_data, '$.Name') = '${context.name}'`);
    }

    if (context.attributes) {
      for (const [key, value] of Object.entries(context.attributes)) {
        conditions.push(`JSON_EXTRACT(tc.context_data, '$.Contexts."${key}"') = '${value}'`);
      }
    }
  }

  if (playerName) {
    const playerNameFelt = stringToFelt(playerName);
    const paddedPlayerName = padAddress(playerNameFelt.toString());
    conditions.push(`pn.player_name = "${paddedPlayerName}"`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
};

export const gamesCountQuery = (params: Omit<GamesQueryParams, "limit" | "offset" | "sortBy" | "sortOrder">) => {
  const { namespace } = params;
  const whereClause = buildGameConditions(params);

  return `
  SELECT COUNT(DISTINCT tm.id) as count
  FROM '${namespace}-TokenMetadataUpdate' tm
  LEFT JOIN '${namespace}-OwnersUpdate' o ON o.token_id = tm.id
  LEFT JOIN '${namespace}-GameRegistryUpdate' gr on gr.id = tm.game_id
  LEFT JOIN '${namespace}-TokenScoreUpdate' s on s.id = tm.id
  LEFT JOIN '${namespace}-TokenPlayerNameUpdate' pn on pn.id = tm.id
  LEFT JOIN '${namespace}-TokenContextUpdate' tc on tc.id = tm.id
  LEFT JOIN '${namespace}-SettingsCreated' sd on sd.settings_id = tm.settings_id
  LEFT JOIN '${namespace}-ObjectiveUpdate' tobj ON tobj.token_id = tm.id
  LEFT JOIN '${namespace}-ObjectiveCreated' od ON od.objective_id = tobj.objective_id
  LEFT JOIN '${namespace}-GameMetadataUpdate' gm on gm.id = tm.game_id
  LEFT JOIN '${namespace}-TokenRendererUpdate' tr on tr.id = tm.id
  LEFT JOIN '${namespace}-TokenClientUrlUpdate' tcu on tcu.id = tm.id
  LEFT JOIN '${namespace}-MinterRegistryUpdate' mr on mr.id = tm.minted_by
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

  return `
  SELECT
    gr.contract_address, 
    tm.game_id, 
    game_over,
    tm.lifecycle_end,
    tm.lifecycle_start,
    minted_at,
    minted_by,
    mr.minter_address as minted_by_address,
    o.owner,
    tm.settings_id,
    soulbound,
    completed_all_objectives,
    o.token_id,
    pn.player_name,
    tc.context_data as context,
    sd.settings_data as settings_data,
    COALESCE(s.score, 0) as score,
    COALESCE(GROUP_CONCAT(DISTINCT tobj.objective_id), '') as objective_ids,
    COALESCE(GROUP_CONCAT(DISTINCT od.objective_data), '') as objectives_data,
    tr.renderer_address as renderer,
    tcu.client_url as client_url,
    -- GameMetadata fields
    gm.id as game_metadata_id,
    gm.contract_address as game_metadata_contract_address,
    gm.name as game_metadata_name,
    gm.description as game_metadata_description,
    gm.developer as game_metadata_developer,
    gm.publisher as game_metadata_publisher,
    gm.genre as game_metadata_genre,
    gm.image as game_metadata_image,
    gm.client_url as game_metadata_client_url,
    gm.renderer_address as game_metadata_renderer_address
  FROM '${namespace}-TokenMetadataUpdate' tm
  LEFT JOIN '${namespace}-OwnersUpdate' o ON o.token_id = tm.id
  LEFT JOIN '${namespace}-GameRegistryUpdate' gr on gr.id = tm.game_id
  LEFT JOIN '${namespace}-TokenScoreUpdate' s on s.id = tm.id
  LEFT JOIN '${namespace}-TokenPlayerNameUpdate' pn on pn.id = tm.id
  LEFT JOIN '${namespace}-TokenContextUpdate' tc on tc.id = tm.id
  LEFT JOIN '${namespace}-SettingsCreated' sd on sd.settings_id = tm.settings_id
  LEFT JOIN '${namespace}-ObjectiveUpdate' tobj ON tobj.token_id = tm.id
  LEFT JOIN '${namespace}-ObjectiveCreated' od ON od.objective_id = tobj.objective_id
  LEFT JOIN '${namespace}-GameMetadataUpdate' gm on gm.id = tm.game_id
  LEFT JOIN '${namespace}-TokenRendererUpdate' tr on tr.id = tm.id
  LEFT JOIN '${namespace}-TokenClientUrlUpdate' tcu on tcu.id = tm.id
  LEFT JOIN '${namespace}-MinterRegistryUpdate' mr on mr.id = tm.minted_by
  ${whereClause}
  GROUP BY 
    tm.id
  ORDER BY ${getSortColumn(sortBy)} ${sortOrder.toUpperCase()}
  ${limit !== undefined ? `LIMIT ${limit}` : ""}
  ${offset !== undefined && offset > 0 ? `OFFSET ${offset}` : ""}
  `;
};

interface GameSettingsQueryParams {
  namespace: string;
  gameAddresses?: string[];
  settingsIds?: number[];
  limit?: number;
  offset?: number;
}

const buildSettingsConditions = (params: Omit<GameSettingsQueryParams, "namespace" | "limit" | "offset">) => {
  const conditions = [];
  const { gameAddresses, settingsIds } = params;

  if (gameAddresses && gameAddresses.length > 0) {
    const addressList = gameAddresses.map((addr) => `'${padAddress(addr)}'`).join(", ");
    conditions.push(`gr.contract_address IN (${addressList})`);
  }

  if (settingsIds && settingsIds.length > 0) {
    const idList = settingsIds.map((id) => `'${id}'`).join(", ");
    conditions.push(`sd.settings_id IN (${idList})`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
};

export const gameSettingsCountQuery = (params: Omit<GameSettingsQueryParams, "limit" | "offset">) => {
  const { namespace } = params;
  const whereClause = buildSettingsConditions(params);

  return `
  SELECT COUNT(*) as count
  FROM '${namespace}-SettingsCreated' sd
  LEFT JOIN '${namespace}-GameRegistryUpdate' gr on gr.contract_address = sd.game_address
  LEFT JOIN '${namespace}-GameMetadataUpdate' gm on gm.id = gr.id
  ${whereClause}
  `;
};

export const gameSettingsQuery = ({
  namespace,
  gameAddresses,
  settingsIds,
  limit,
  offset = 0,
}: GameSettingsQueryParams) => {
  const whereClause = buildSettingsConditions({ gameAddresses, settingsIds });

  let query = `
  SELECT *
  FROM '${namespace}-SettingsCreated' sd
  LEFT JOIN '${namespace}-GameRegistryUpdate' gr on gr.contract_address = sd.game_address
  LEFT JOIN '${namespace}-GameMetadataUpdate' gm on gm.id = gr.id
  ${whereClause}
  `;

  if (limit !== undefined) {
    query += ` LIMIT ${limit}`;
  }
  if (offset !== undefined && offset > 0) {
    query += ` OFFSET ${offset}`;
  }

  return query;
};

interface ObjectivesQueryParams {
  namespace: string;
  gameAddresses?: string[];
  objectiveIds?: number[];
  limit?: number;
  offset?: number;
}

const buildObjectivesConditions = (params: Omit<ObjectivesQueryParams, "namespace" | "limit" | "offset">) => {
  const conditions = [];
  const { gameAddresses, objectiveIds } = params;

  if (gameAddresses && gameAddresses.length > 0) {
    const addressList = gameAddresses.map((addr) => `'${padAddress(addr)}'`).join(", ");
    conditions.push(`gr.contract_address IN (${addressList})`);
  }

  if (objectiveIds && objectiveIds.length > 0) {
    const idList = objectiveIds.map((id) => `'${id}'`).join(", ");
    conditions.push(`od.objective_id IN (${idList})`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
};

export const objectivesCountQuery = (params: Omit<ObjectivesQueryParams, "limit" | "offset">) => {
  const { namespace } = params;
  const whereClause = buildObjectivesConditions(params);

  return `
  SELECT COUNT(*) as count
  FROM '${namespace}-ObjectiveCreated' od
  LEFT JOIN '${namespace}-GameRegistryUpdate' gr on gr.contract_address = od.game_address
  LEFT JOIN '${namespace}-GameMetadataUpdate' gm on gm.id = gr.id
  ${whereClause}
  `;
};

export const objectivesQuery = ({
  namespace,
  gameAddresses,
  objectiveIds,
  limit,
  offset = 0,
}: ObjectivesQueryParams) => {
  const whereClause = buildObjectivesConditions({ gameAddresses, objectiveIds });

  let query = `
  SELECT *
  FROM '${namespace}-ObjectiveCreated' od
  LEFT JOIN '${namespace}-GameRegistryUpdate' gr on gr.contract_address = od.game_address
  LEFT JOIN '${namespace}-GameMetadataUpdate' gm on gm.id = gr.id
  ${whereClause}
  `;

  if (limit !== undefined) {
    query += ` LIMIT ${limit}`;
  }
  if (offset !== undefined && offset > 0) {
    query += ` OFFSET ${offset}`;
  }

  return query;
};
