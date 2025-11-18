import { useGameStore, useRouterContext, useSystems } from "@/dojo/hooks";
import { useGameTokens } from "@/dojo/hooks/useGameTokens";
import { GameMode } from "@/dojo/types";
import { observer } from "mobx-react-lite";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { feltToString } from "@/lib/metagame-sdk/shared/lib";

const RegisterEntities = observer(() => {
  const { gameId } = useRouterContext();
  const gameStore = useGameStore();
  const router = useRouter();
  const { createGame } = useSystems();

  const [retry, setRetry] = useState(200);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [tokenIdToCheck, setTokenIdToCheck] = useState<number | undefined>(undefined);
  const hasHandledCreation = useRef(false);

  // Fetch game token data for the current gameId to get tournament info
  const gameIdNumber = gameId ? (gameId.startsWith("0x") ? parseInt(gameId, 16) : parseInt(gameId, 10)) : undefined;

  console.log(gameIdNumber, gameId);

  // Only fetch game tokens when we have a gameId or need to check a specific token
  const { games } = useGameTokens({
    sortBy: "token_id",
    limit: 1,
    tokenIds: tokenIdToCheck !== undefined ? [tokenIdToCheck] : gameIdNumber !== undefined ? [gameIdNumber] : undefined,
  });

  // Set tournament ID whenever we have game data
  useEffect(() => {
    if (games.length > 0) {
      const metagameToken = games[0];
      const tournamentId = metagameToken?.context?.contexts?.["Tournament ID"];
      if (tournamentId) {
        gameStore.tournamentId = tournamentId;
        console.log("Tournament ID set:", gameStore.tournamentId);
      } else if (gameStore.tournamentId) {
        // Clear tournament ID if it was previously set but no longer exists
        gameStore.tournamentId = undefined;
      }
    }
  }, [games, gameStore]);

  useEffect(() => {
    const init = async () => {
      try {
        if (gameStore && gameId) {
          await gameStore.init(gameId);
          setTokenIdToCheck(undefined); // Clear token check on successful init
          hasHandledCreation.current = false; // Reset flag on successful init
        } else {
          gameStore.reset();
        }
        setRetry(200);
      } catch (e: any) {
        console.log(e);

        // Check if this is a "game not started" error
        const errorMessage = e?.message || "";
        if (errorMessage.startsWith("GAME_NOT_STARTED:")) {
          const tokenId = errorMessage.replace("GAME_NOT_STARTED:", "");
          const tokenIdNumber = tokenId.startsWith("0x") ? parseInt(tokenId, 16) : parseInt(tokenId, 10);

          // Set the token ID to check, which will trigger the useGameTokens hook
          // The second useEffect will handle game creation
          if (!hasHandledCreation.current) {
            setTokenIdToCheck(tokenIdNumber);
          }
          return;
        }

        // For other errors, retry with exponential backoff
        if (!isCreatingGame) {
          setTimeout(() => {
            setRetry(retry * 2);
          }, retry);
        }
      }
    };

    init();
  }, [gameId, gameStore, retry, isCreatingGame]);

  // Separate effect to handle game creation when metagame token data is loaded
  useEffect(() => {
    if (tokenIdToCheck === undefined || isCreatingGame || games.length === 0 || hasHandledCreation.current) return;

    const metagameToken = games[0]; // We filtered by specific token ID, so should be first result

    if (metagameToken && !metagameToken.hasDopeToken) {
      console.log(`Token ${tokenIdToCheck} found in metagame but not started. Creating game...`);
      hasHandledCreation.current = true; // Prevent duplicate creation
      setIsCreatingGame(true);

      const createGameAsync = async () => {
        try {
          // Convert player name from felt to string
          const playerNameRaw = metagameToken.player_name || "Player";
          const playerName =
            typeof playerNameRaw === "string"
              ? feltToString(playerNameRaw) || playerNameRaw
              : feltToString(playerNameRaw) || "Player";

          console.log("Creating game with player name:", playerName, "from:", playerNameRaw);

          const gameMode = GameMode.Ranked;
          const multiplier = 1;

          await createGame(gameMode, playerName, multiplier, tokenIdToCheck);

          console.log(`Game created successfully for token ${tokenIdToCheck}`);

          // Wait for indexer to sync, then retry init
          setTimeout(() => {
            setIsCreatingGame(false);
            setTokenIdToCheck(undefined);
            setRetry(200);
          }, 3000); // Increased wait time for indexer
        } catch (createError) {
          console.error("Failed to create game:", createError);
          setIsCreatingGame(false);
          hasHandledCreation.current = false; // Reset on error
          router.push("/");
        }
      };

      createGameAsync();
    } else if (metagameToken && metagameToken.hasDopeToken) {
      // Token already has dope token, something went wrong
      console.error(`Token ${tokenIdToCheck} already has dope token. Redirecting to home.`);
      hasHandledCreation.current = true;
      router.push("/");
    } else if (!metagameToken) {
      // Token not found in metagame
      console.error(`Token ${tokenIdToCheck} not found in metagame. Redirecting to home.`);
      hasHandledCreation.current = true;
      router.push("/");
    }
  }, [games, tokenIdToCheck, isCreatingGame, createGame, router, gameStore]);

  return null;
});

export default RegisterEntities;
