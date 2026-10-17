/**
 * TanStack Query with an offline cache. Successful reads are persisted
 * (Preferences on native, localStorage in the browser) for 24 h, so a cold
 * start without network still shows the last Today and Mail it saw — with the
 * offline banner — instead of a blank screen. The cache is keyed to the
 * signed-in user (`buster`) and wiped on sign-out.
 */
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import { APP_VERSION } from "../config";
import { kv } from "../platform/kv";
import { isApiError } from "./client";

export const CACHE_KEY = "klorn-query-cache-v1";
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: CACHE_MAX_AGE_MS,
        // Show the cache first and fetch in the background; a dead network
        // never blocks rendering what we already have.
        networkMode: "offlineFirst",
        retry: (count, err) => {
          if (isApiError(err) && (err.kind === "unauthorized" || err.status === 404)) return false;
          // No network: one quick retry, then show the cache with the offline banner.
          if (isApiError(err) && err.isOffline) return count < 1;
          return count < 2;
        },
        refetchOnWindowFocus: true,
      },
    },
  });
}

export const persister = createAsyncStoragePersister({
  storage: kv,
  key: CACHE_KEY,
  throttleTime: 1000,
});

export function persistOptions(userKey: string): Omit<PersistQueryClientOptions, "queryClient"> {
  return {
    persister,
    maxAge: CACHE_MAX_AGE_MS,
    buster: `${APP_VERSION}:${userKey}`,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) =>
        query.state.status === "success" && query.meta?.persist !== false,
    },
  };
}

export async function clearPersistedCache(): Promise<void> {
  await kv.removeItem(CACHE_KEY);
}
