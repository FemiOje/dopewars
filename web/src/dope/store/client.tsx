import { ToriiClient } from "@dojoengine/torii-client";
import { StateCreator } from "zustand";

import { DopeState } from "./store";

type State = {
  toriiClient?: ToriiClient;
  worldAddress?: string;
};

type Action = {
  setToriiClient: (toriiClient: ToriiClient) => void;
  setWorldAddress: (worldAddress: string) => void;
  // getClient: () => ToriiClient;
};

export type ClientState = State & Action;
// export type ClientStore = StoreApi<ClientState>;
//
//
//

export const createClientStore: StateCreator<DopeState, [], [], ClientState> = (set, _get) => ({
  toriiClient: undefined,
  worldAddress: undefined,
  setToriiClient: (toriiClient: ToriiClient) => {
    set({ toriiClient });
  },
  setWorldAddress: (worldAddress: string) => {
    set({ worldAddress });
  },
  // getClient: () => {
  //   return get().toriiClient!;
  // },
});
