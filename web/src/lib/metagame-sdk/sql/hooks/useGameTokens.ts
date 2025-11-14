"use client";

import { gamesQuery, gamesCountQuery } from "../queries/sql";
import { useSqlQuery, type SqlQueryResult } from "../services/sqlService";
import { feltToString } from "../../shared/lib";
import { useMemo, useState, useCallback, useEffect } from "react";
import { getMetagameClientSafe } from "../../shared/singleton";
import { parseSettingsData, parseContextData } from "../../shared/utils/dataTransformers";
import type { GameTokenData } from "../../shared/types";

interface GameTokensQueryParams {
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
  limit?: number;
  offset?: number;
  sortBy?: "score" | "minted_at" | "player_name" | "token_id" | "game_over" | "owner" | "game_id";
  sortOrder?: "asc" | "desc";
  started?: boolean;
  expired?: boolean;
  playerName?: string;
  pagination?: {
    pageSize?: number;
    initialPage?: number;
  };
  includeMetadata?: boolean;
  fetchCount?: boolean;
}

export interface PaginationControls {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
}

export interface UseGameTokensResult extends Omit<SqlQueryResult<GameTokenData>, "data"> {
  games: GameTokenData[];
  pagination: PaginationControls;
  metadataLoading?: boolean;
  totalCount?: number;
}

export const useGameTokens = ({
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
  limit,
  offset = 0,
  sortBy = "minted_at",
  sortOrder,
  pagination,
  includeMetadata = false,
  fetchCount = false,
}: GameTokensQueryParams): UseGameTokensResult => {
  const client = getMetagameClientSafe();
  const toriiUrl = client?.getConfig().toriiUrl || "";

  const isPaginationEnabled = !!pagination;
  const pageSize = pagination?.pageSize ?? 100;
  const [currentPage, setCurrentPage] = useState(pagination?.initialPage ?? 0);

  const defaultSortOrder = sortBy === "score" || sortBy === "minted_at" ? "desc" : "asc";
  const finalSortOrder = sortOrder ?? defaultSortOrder;

  const query = useMemo(() => {
    if (!client) {
      console.warn("⚠️ Metagame client not available for query");
      return null;
    }
    const generatedQuery = gamesQuery({
      namespace: client.getNamespace(),
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
      limit: isPaginationEnabled ? pageSize : limit,
      offset: isPaginationEnabled ? currentPage * pageSize : offset,
      sortBy,
      sortOrder: finalSortOrder,
    });
    console.log("📝 Generated SQL query for games:", {
      namespace: client.getNamespace(),
      owner,
      gameAddresses,
      queryPreview: generatedQuery.substring(0, 300) + "...",
    });
    return generatedQuery;
  }, [
    client,
    owner,
    JSON.stringify(gameAddresses),
    JSON.stringify(tokenIds),
    hasContext,
    JSON.stringify(context),
    settings_id,
    completed_all_objectives,
    soulbound,
    objective_id,
    mintedByAddress,
    gameOver,
    JSON.stringify(score),
    started,
    expired,
    playerName,
    isPaginationEnabled,
    pageSize,
    currentPage,
    limit,
    offset,
    sortBy,
    finalSortOrder,
  ]);

  const countQuery = useMemo(() => {
    if (!client || (!isPaginationEnabled && !fetchCount)) return null;
    return gamesCountQuery({
      namespace: client.getNamespace(),
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
  }, [
    client,
    isPaginationEnabled,
    fetchCount,
    owner,
    JSON.stringify(gameAddresses),
    JSON.stringify(tokenIds),
    hasContext,
    JSON.stringify(context),
    settings_id,
    completed_all_objectives,
    soulbound,
    objective_id,
    mintedByAddress,
    gameOver,
    JSON.stringify(score),
    started,
    expired,
    playerName,
  ]);

  const { data: rawGameData, loading, error: queryError, refetch: refetchMain } = useSqlQuery(toriiUrl, query, true);

  const {
    data: countData,
    loading: countLoading,
    error: countError,
    refetch: refetchCount,
  } = useSqlQuery(toriiUrl, countQuery, true);

  // Log query results for debugging
  useEffect(() => {
    if (!loading && query) {
      if (queryError) {
        console.error("❌ SQL query error in useGameTokens:", {
          error: queryError,
          toriiUrl,
          queryPreview: query.substring(0, 200),
        });
      } else {
        console.log("📊 Raw game data received:", {
          count: rawGameData?.length || 0,
          data: rawGameData,
          toriiUrl,
        });
      }
    }
  }, [rawGameData, loading, queryError, query, toriiUrl]);

  const error = queryError || countError;
  const isLoading = loading || countLoading;

  const totalCount = useMemo(() => {
    if (!isPaginationEnabled && !fetchCount) return undefined;
    if (!countData || !countData.length) return 0;
    return Number((countData[0] as any).count) || 0;
  }, [isPaginationEnabled, fetchCount, countData]);

  const totalPages = isPaginationEnabled && totalCount !== undefined ? Math.ceil(totalCount / pageSize) : 1;

  const gameScores = useMemo(() => {
    if (!rawGameData || !rawGameData.length) return [];

    return rawGameData.map((game: any) => {
      const parsedContext = game.context ? parseContextData(game.context) : undefined;
      const parsedSettings = game.settings_data ? parseSettingsData(game.settings_data) : undefined;

      const gameMetadata = game.game_metadata_id
        ? {
            game_id: Number(game.game_metadata_id) || 0,
            contract_address: game.game_metadata_contract_address || "",
            name: game.game_metadata_name || "",
            description: game.game_metadata_description || "",
            developer: game.game_metadata_developer || "",
            publisher: game.game_metadata_publisher || "",
            genre: game.game_metadata_genre || "",
            image: game.game_metadata_image || "",
            color: game.game_metadata_color,
            client_url: game.game_metadata_client_url,
            renderer_address: game.game_metadata_renderer_address,
          }
        : undefined;

      // Convert token_id from hex string to number if needed
      let tokenId = 0;
      if (game.token_id) {
        const tokenIdStr = game.token_id.toString().replace(/["']/g, "").replace(/^0x/, "");
        tokenId = parseInt(tokenIdStr, 16) || parseInt(tokenIdStr, 10) || 0;
      }

      const filteredGame: GameTokenData = {
        game_id: Number(game.game_id) || 0,
        game_over: Boolean(game.game_over),
        lifecycle: {
          start: game.lifecycle_start ? Number(game.lifecycle_start) : undefined,
          end: game.lifecycle_end ? Number(game.lifecycle_end) : undefined,
        },
        minted_at: game.minted_at
          ? typeof game.minted_at === "string"
            ? Math.floor(new Date(game.minted_at).getTime() / 1000)
            : Number(game.minted_at)
          : undefined,
        minted_by: game.minted_by ? Number(game.minted_by) : undefined,
        minted_by_address: game.minted_by_address || game.owner,
        owner: game.owner,
        settings_id: game.settings_id == null ? undefined : Number(game.settings_id),
        soulbound: Boolean(game.soulbound),
        completed_all_objectives: Boolean(game.completed_all_objectives),
        token_id: tokenId,
        player_name: game.player_name
          ? typeof game.player_name === "string"
            ? game.player_name
            : feltToString(game.player_name)
          : undefined,
        metadata: undefined,
        context: parsedContext
          ? {
              name: parsedContext.name,
              description: parsedContext.description,
              contexts: parsedContext.contexts,
            }
          : undefined,
        settings: parsedSettings
          ? {
              name: parsedSettings.name,
              description: parsedSettings.description,
              data: parsedSettings.data,
            }
          : undefined,
        score: Number(game.score) || 0,
        objective_ids: game.objective_ids
          ? game.objective_ids
              .split(",")
              .map((id: string) => id.toString())
              .filter((id: string) => id && id.trim() !== "" && id !== "0")
          : [],
        renderer: game.renderer,
        client_url: game.client_url,
        gameMetadata,
      };
      return filteredGame;
    });
  }, [rawGameData]);

  const hasNextPage = isPaginationEnabled ? currentPage < totalPages - 1 : false;
  const hasPreviousPage = isPaginationEnabled ? currentPage > 0 : false;

  const goToPage = useCallback(
    (page: number) => {
      const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
      setCurrentPage(clampedPage);
    },
    [totalPages],
  );

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [hasPreviousPage]);

  const firstPage = useCallback(() => {
    setCurrentPage(0);
  }, []);

  const lastPage = useCallback(() => {
    setCurrentPage(Math.max(0, totalPages - 1));
  }, [totalPages]);

  const refetch = useCallback(async () => {
    const promises: Promise<void>[] = [];

    if (refetchMain) {
      promises.push(refetchMain());
    }

    if ((isPaginationEnabled || fetchCount) && refetchCount) {
      promises.push(refetchCount());
    }

    await Promise.all(promises);
  }, [refetchMain, refetchCount, isPaginationEnabled, fetchCount]);

  const paginationControls: PaginationControls = useMemo(
    () => ({
      currentPage,
      pageSize,
      totalCount: totalCount ?? 0,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      goToPage,
      nextPage,
      previousPage,
      firstPage,
      lastPage,
    }),
    [
      currentPage,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      goToPage,
      nextPage,
      previousPage,
      firstPage,
      lastPage,
    ],
  );

  return {
    games: gameScores,
    loading: isLoading,
    error,
    refetch,
    pagination: paginationControls,
    metadataLoading: false,
    totalCount,
  };
};
