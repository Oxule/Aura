import {atomWithAsyncStorage} from "../atomWithAsyncStorage.ts";

export const channelsAtom = atomWithAsyncStorage<Record<string, string>>("channels", {});