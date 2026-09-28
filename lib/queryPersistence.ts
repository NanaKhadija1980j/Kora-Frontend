import type { Query, QueryClient } from "@tanstack/react-query";
import type { PersistedClient, Persister } from "@tanstack/query-persist-client-core";

const DB_NAME = "kora-query-cache";
const STORE_NAME = "queries";
const CACHE_KEY = "marketplace-query-cache";

export const MARKETPLACE_CACHE_GC_TIME_MS = 24 * 60 * 60 * 1000;
export const MARKETPLACE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface OfflineQueryMeta {
  persistOffline?: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  if (typeof indexedDB === "undefined") return undefined;

  const db = await openDb();
  const tx = db.transaction(STORE_NAME, mode);
  const store = tx.objectStore(STORE_NAME);
  const request = run(store);

  return new Promise((resolve, reject) => {
    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      return;
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function shouldPersistMarketplaceQuery(query: Query): boolean {
  const meta = query.meta as OfflineQueryMeta | undefined;
  return meta?.persistOffline === true;
}

export function createIndexedDbPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await withStore("readwrite", (store) => {
        store.put(client, CACHE_KEY);
      });
    },
    restoreClient: async () => {
      const result = await withStore<PersistedClient | undefined>("readonly", (store) =>
        store.get(CACHE_KEY),
      );
      return (result as PersistedClient | undefined) ?? undefined;
    },
    removeClient: async () => {
      await withStore("readwrite", (store) => {
        store.delete(CACHE_KEY);
      });
    },
  };
}

export function getLatestMarketplaceDataUpdatedAt(queryClient: QueryClient): number | null {
  const queries = queryClient.getQueryCache().findAll({
    predicate: shouldPersistMarketplaceQuery,
  });

  const latest = queries.reduce((maxUpdatedAt, query) => {
    if (query.state.data === undefined) {
      return maxUpdatedAt;
    }

    return Math.max(maxUpdatedAt, query.state.dataUpdatedAt ?? 0);
  }, 0);

  return latest > 0 ? latest : null;
}
