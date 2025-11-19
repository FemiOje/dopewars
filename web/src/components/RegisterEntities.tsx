import { useGameStore, useRouterContext, useSystems, useConfigStore, useDojoContext } from "@/dojo/hooks";
import { GameMode } from "@/dojo/types";
import { observer } from "mobx-react-lite";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { feltToString } from "@/lib/metagame-sdk/shared/lib";
import { useAccount, useConnect } from "@starknet-react/core";
import { useGameTokens as useMetagameGameTokens, isMetagameReady } from "@/lib/metagame-sdk";

const GAME_ADDRESS = "0x12bf5118f03d2bbb8a2a31c72e0020ab85af172dd965ccd55c3132066ad8554";

const RegisterEntities = observer(() => {
  const startTime = useRef(performance.now());
  const { gameId } = useRouterContext();
  const gameStore = useGameStore();
  const configStore = useConfigStore();
  const router = useRouter();
  const { createGame } = useSystems();
  const { account } = useAccount();
  const { uiStore, clients } = useDojoContext();
  const { connect, connectAsync, connectors } = useConnect();

  const [retry, setRetry] = useState(200);
  const [tokenIdToCheck, setTokenIdToCheck] = useState<number | undefined>(undefined);
  const [isConnecting, setIsConnecting] = useState(false);
  const [queryStableCount, setQueryStableCount] = useState(0);
  const hasHandledCreation = useRef(false);
  const hasNormalizedUrl = useRef(false);
  const isInitializing = useRef(false);

  // Fetch game token data for the current gameId to get tournament info
  const gameIdNumber = gameId ? (gameId.startsWith("0x") ? parseInt(gameId, 16) : parseInt(gameId, 10)) : undefined;

  // Only fetch metagame tokens when we need to check if game needs to be started
  // After game is initialized and tournament ID is set, stop fetching
  const shouldFetchMetagame =
    tokenIdToCheck !== undefined || (gameIdNumber !== undefined && gameStore.isInitialized && !gameStore.tournamentId);

  const { games, loading: metagameLoading, error: metagameError } = useMetagameGameTokens({
    gameAddresses: [GAME_ADDRESS],
    tokenIds: shouldFetchMetagame ? (tokenIdToCheck !== undefined ? [tokenIdToCheck] : [gameIdNumber!]) : undefined,
    sortBy: "token_id",
    sortOrder: "desc",
    pagination: {
      pageSize: 1,
    },
  });


  // Set tournament ID whenever we have game data (lazy loaded after game initializes)
  useEffect(() => {
    if (games.length > 0 && gameStore.isInitialized && !gameStore.tournamentId) {
      const metagameToken = games[0];
      const tournamentId = metagameToken?.context?.contexts?.["Tournament ID"];

      // Only update if tournament ID exists and is different
      if (tournamentId && gameStore.tournamentId !== tournamentId) {
        gameStore.setTournamentId(tournamentId);
      }
    }
  }, [games, gameStore, gameStore.isInitialized]);

  useEffect(() => {
    const init = async () => {

      // Normalize gameId for comparison (could be decimal like "95048" or hex like "0x17348")
      let normalizedGameId = gameId;
      if (gameId && !gameId.startsWith("0x")) {
        const tokenIdNumber = parseInt(gameId, 10);
        if (!isNaN(tokenIdNumber) && tokenIdNumber > 0) {
          normalizedGameId = `0x${tokenIdNumber.toString(16)}`;
        }
      }

      // Skip if already initialized for this gameId (e.g., when navigating between pages)
      if (gameStore.isInitialized && gameStore.tokenId === normalizedGameId) {
        return;
      }

      // Wait for config store to be initialized before attempting to load game
      if (!configStore.isInitialized) {
        return;
      }

      // Prevent duplicate initialization
      if (isInitializing.current) {
        return;
      }

      try {
        if (gameStore && gameId) {
          isInitializing.current = true;

          await gameStore.init(gameId);

          // Game successfully loaded! Clear creation flag if it was set
          if (gameStore.isCreatingGame) {
            gameStore.setIsCreatingGame(false);
          }

          setTokenIdToCheck(undefined); // Clear token check on successful init
          hasHandledCreation.current = false; // Reset flag on successful init
          isInitializing.current = false;
        } else {
          gameStore.reset();
        }
        setRetry(200);
      } catch (e: any) {
        isInitializing.current = false;

        // Check if this is a "game not started" error
        const errorMessage = e?.message || "";
        if (errorMessage.startsWith("GAME_NOT_STARTED:")) {
          const tokenId = errorMessage.replace("GAME_NOT_STARTED:", "");
          const tokenIdNumber = tokenId.startsWith("0x") ? parseInt(tokenId, 16) : parseInt(tokenId, 10);

          // If we're currently creating a game, keep retrying instead of going through creation flow again
          if (gameStore.isCreatingGame) {
            setTimeout(() => {
              setRetry(retry * 2);
            }, retry);
            return;
          }

          // Set the token ID to check, which will trigger the useGameTokens hook
          // The second useEffect will handle game creation
          if (!hasHandledCreation.current) {
            setTokenIdToCheck(tokenIdNumber);
          }
          return;
        }

        // For other errors, retry with exponential backoff
        setTimeout(() => {
          setRetry(retry * 2);
        }, retry);
      }
    };

    init();
  }, [gameId, gameStore, retry, gameStore.isCreatingGame, configStore.isInitialized, router]);

  // Separate effect to handle game creation when metagame token data is loaded
  useEffect(() => {
    const metagameClientReady = isMetagameReady();

    if (tokenIdToCheck === undefined) {
      setQueryStableCount(0);
      return;
    }

    if (hasHandledCreation.current) {
      setQueryStableCount(0);
      return;
    }

    // If we're creating but don't have an account yet, wait for connection
    if (gameStore.isCreatingGame && !account) {
      setQueryStableCount(0);
      return;
    }

    // Wait for metagame client to be ready before checking query results
    if (!metagameClientReady) {
      setQueryStableCount(0);
      return;
    }

    // Wait for metagame query to complete - don't redirect while still loading
    if (metagameLoading) {
      setQueryStableCount(0);
      return;
    }

    // Query finished loading - wait for data to stabilize (2 render cycles after loading completes)
    if (queryStableCount < 2) {
      setQueryStableCount(prev => prev + 1);
      return;
    }

    // Query completed - check if token exists
    const metagameToken = games[0]; // We filtered by specific token ID, so should be first result

    if (!metagameToken) {
      // Token not found in metagame at all - invalid token
      hasHandledCreation.current = true;
      router.push("/");
      return;
    }

    // Token exists in metagame - need to create dopewars game
    // Check if user is connected before trying to create game
    if (!account && !isConnecting) {
      setIsConnecting(true);

      // Set isCreatingGame flag to prevent redirect during wallet connection
      gameStore.setIsCreatingGame(true);

      // Auto-connect with the first connector (usually Cartridge)
      const attemptConnection = async () => {
        try {
          if (connectors.length > 0) {
            await connectAsync({ connector: connectors[0] });
          } else {
            uiStore.openConnectModal();
          }
        } catch (connectionError) {
          // User cancelled wallet connection - reset flags and redirect
          gameStore.setIsCreatingGame(false);
          setIsConnecting(false);
          hasHandledCreation.current = false;
          router.push("/");
        }
      };

      attemptConnection();
      // Don't redirect, wait for user to connect. The effect will re-run when account changes
      return;
    }

    // Still waiting for connection to complete
    if (!account && isConnecting) {
      return;
    }

    // Connection successful, reset flag
    if (account && isConnecting) {
      setIsConnecting(false);
    }

    // Set isCreatingGame flag if not already set (for when account is already connected)
    if (!gameStore.isCreatingGame) {
      gameStore.setIsCreatingGame(true);
    }

    hasHandledCreation.current = true; // Prevent duplicate creation

    const createGameAsync = async () => {
      try {
        // Convert player name from felt to string
        const playerNameRaw = metagameToken.player_name || "Player";
        const playerName =
          typeof playerNameRaw === "string"
            ? feltToString(playerNameRaw) || playerNameRaw
            : feltToString(playerNameRaw) || "Player";

        const gameMode = GameMode.Ranked;
        const multiplier = 1;

        await createGame(gameMode, playerName, multiplier, tokenIdToCheck);

        // Game transaction complete, now trigger retry with polling until indexer syncs
        // Keep isCreatingGame = true to prevent redirect timeout while waiting for indexer
        setTokenIdToCheck(undefined);
        setRetry(200); // Will trigger the first useEffect to retry gameStore.init()
      } catch (createError) {
        gameStore.setIsCreatingGame(false);
        setIsConnecting(false);
        hasHandledCreation.current = false; // Reset on error
        router.push("/");
      }
    };

    createGameAsync();
  }, [games, tokenIdToCheck, gameStore, gameStore.isCreatingGame, createGame, router, account, retry, uiStore, connect, connectors, isConnecting, metagameLoading, queryStableCount]);

  return null;
});

export default RegisterEntities;
