import { useState, useCallback, useEffect, useRef } from "react";
import { logger } from "../../shared/utils/logger";

interface ErrorResponse {
  error?: string;
  message?: string;
}

export interface SqlQueryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSqlQuery<T>(
  toriiUrl: string | undefined,
  query: string | null | undefined,
  logging: boolean = false,
): SqlQueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const lastQueryRef = useRef<string | null | undefined>();
  const lastToriiUrlRef = useRef<string | undefined>();
  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!toriiUrl) {
      setError("Torii URL is not configured");
      setLoading(false);
      return;
    }

    if (!query) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (logging) {
        logger.debug("[useSqlQuery] Executing query with toriiUrl:", toriiUrl);
      }
      const result = await executeSqlQuery<T>(toriiUrl, query, logging);
      setData(result.data);
      setError(result.error);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      if (logging) {
        logger.error("SQL query error:", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [toriiUrl, query, logging]);

  useEffect(() => {
    const queryChanged = lastQueryRef.current !== query;
    const toriiUrlChanged = lastToriiUrlRef.current !== toriiUrl;

    if (queryChanged || toriiUrlChanged || !hasFetchedRef.current) {
      lastQueryRef.current = query;
      lastToriiUrlRef.current = toriiUrl;
      hasFetchedRef.current = true;
      fetchData();
    }
  }, [query, toriiUrl, fetchData]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}

export async function executeSqlQuery<T>(
  toriiUrl: string,
  query: string | null | undefined,
  logging: boolean = false,
): Promise<{ data: T[]; error: string | null }> {
  if (!toriiUrl) {
    return { data: [], error: "Torii URL is not configured" };
  }

  if (!query) {
    return { data: [], error: null };
  }

  try {
    // Normalize URL - ensure it doesn't have /graphql suffix
    let normalizedUrl = toriiUrl;
    if (normalizedUrl.endsWith("/graphql")) {
      normalizedUrl = normalizedUrl.replace("/graphql", "");
    }
    if (normalizedUrl.endsWith("/graphql/")) {
      normalizedUrl = normalizedUrl.replace("/graphql/", "");
    }

    const sqlUrl = `${normalizedUrl}/sql`;
    const encodedQuery = encodeURIComponent(query);
    const fullUrl = `${sqlUrl}?query=${encodedQuery}`;

    if (logging) {
      console.log("🔍 Executing SQL query:", {
        url: sqlUrl,
        queryPreview: query.substring(0, 200) + "...",
        fullQuery: query,
      });
    }

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorData = responseData as ErrorResponse;
      const errorMessage = errorData.error || errorData.message || "Failed to execute query";
      console.error("❌ SQL query error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
        response: responseData,
      });
      if (logging) {
        logger.error("SQL query error:", errorMessage);
      }
      return { data: [], error: errorMessage };
    }

    const result = responseData as T[];
    if (logging) {
      console.log("✅ SQL query result:", {
        resultCount: result.length,
        data: result,
      });
      logger.debug("SQL query result:", result);
    }
    return { data: result, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    console.error("❌ SQL query exception:", {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
    });
    if (logging) {
      logger.error("SQL query error:", errorMessage);
    }
    return { data: [], error: errorMessage };
  }
}
