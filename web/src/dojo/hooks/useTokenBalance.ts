import { useCallback, useEffect, useMemo, useState } from "react";
import { Abi, Contract, ProviderInterface } from "starknet";
import { ABI as paperAbi } from "../abis/paperAbi";
import { useDojoContext } from "./useDojoContext";

type ManifestContractEntry = {
  address: string;
  abi?: Abi;
};

export const useTokenBalance = ({
  address,
  token,
  refetchInterval,
}: {
  address?: string;
  token?: string;
  refetchInterval?: number;
}) => {
  const {
    clients: { dojoProvider },
  } = useDojoContext();
  const [balance, setBalance] = useState(0n);
  const [isInitializing, setIsInitializing] = useState(true);

  const contract = useMemo(() => {
    if (!token || !dojoProvider) return undefined;

    const contracts = dojoProvider.manifest.contracts as ManifestContractEntry[] | undefined;
    const manifestAbi = contracts?.find(
      (manifestContract) => manifestContract.address?.toLowerCase() === token.toLowerCase(),
    )?.abi as Abi | undefined;

    const resolvedAbi = manifestAbi ?? (paperAbi as Abi);

    if (!resolvedAbi) {
      console.warn("[useTokenBalance] Missing ABI for token contract", token);
      return undefined;
    }

    const starknetContract = new Contract({
      abi: resolvedAbi,
      address: token!,
      providerOrAccount: dojoProvider.provider as unknown as ProviderInterface,
    });

    return starknetContract;
  }, [dojoProvider, token]);

  const refresh = useCallback(async () => {
    if (!contract || !address) return;

    try {
      const bal = await contract.call("balance_of", [address]);
      //@ts-ignore   returns a bigint
      setBalance(bal);
      setIsInitializing(false);
    } catch (e) {
      console.error("Failed to fetch token balance:", e);
      setBalance(0n);
      setIsInitializing(false);
    }
  }, [contract, address]);

  useEffect(() => {
    if (!contract) return;

    if (refetchInterval) {
      refresh();
      let handle = setInterval(refresh, refetchInterval);

      return () => {
        clearInterval(handle);
      };
    } else {
      refresh();
    }
  }, [address, token, contract, refetchInterval, refresh]);

  return {
    balance,
    isInitializing,
    refresh,
  };
};
