/**
 * Offline query persistence (issue #815).
 *
 * This module decides what a user sees after the connection drops, so the
 * tests pin four claims rather than the implementation:
 *
 *   1. only queries that explicitly opted in are eligible for persistence;
 *   2. a persisted client survives a round trip through IndexedDB, and can be
 *      removed again;
 *   3. the persister degrades to a no-op when IndexedDB is unavailable (SSR,
 *      private browsing) instead of throwing on a marketplace page;
 *   4. a "last updated" reading is null when nothing usable is cached, so the
 *      UI never claims the cache is fresh at the Unix epoch.
 *
 * The IndexedDB fake below implements only the handful of members
 * `queryPersistence` touches, and does so asynchronously the way the real API
 * does — handlers are attached *after* the call returns, so a synchronous fake
 * would let broken code pass.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, type Query } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/query-persist-client-core";

import {
  MARKETPLACE_CACHE_GC_TIME_MS,
  MARKETPLACE_CACHE_MAX_AGE_MS,
  createIndexedDbPersister,
  getLatestMarketplaceDataUpdatedAt,
  shouldPersistMarketplaceQuery,
} from "@/lib/queryPersistence";

type EventHandler = (() => void) | null;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A minimal in-memory stand-in for IndexedDB, covering exactly the surface
 * `openDb`/`withStore` use: `open`, the object store, and `put`/`get`/`delete`.
 */
function createFakeIndexedDb() {
  const records = new Map<string, unknown>();

  const makeRequest = <T>(produce: () => T) => {
    const request: {
      result: T;
      error: unknown;
      onsuccess: EventHandler;
      onerror: EventHandler;
      onupgradeneeded: EventHandler;
    } = {
      result: undefined as T,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    queueMicrotask(() => {
      request.result = produce();
      request.onsuccess?.();
    });
    return request;
  };

  const makeStore = () => ({
    put: (value: unknown, key: string) =>
      makeRequest(() => {
        records.set(key, structuredClone(value));
        return key;
      }),
    get: (key: string) => makeRequest(() => records.get(key)),
    delete: (key: string) =>
      makeRequest(() => {
        records.delete(key);
        return undefined;
      }),
  });

  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => makeStore(),
    transaction: () => {
      const tx: {
        error: unknown;
        oncomplete: EventHandler;
        onerror: EventHandler;
        objectStore: () => ReturnType<typeof makeStore>;
      } = {
        error: null,
        oncomplete: null,
        onerror: null,
        objectStore: () => makeStore(),
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
  };

  const open = () => {
    const request: {
      result: typeof database;
      error: unknown;
      onsuccess: EventHandler;
      onerror: EventHandler;
      onupgradeneeded: EventHandler;
    } = {
      result: database,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    queueMicrotask(() => {
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  };

  return { factory: { open }, records };
}

/**
 * A dehydrated client as `@tanstack/query-persist-client-core` writes it:
 * plain JSON, no functions (IndexedDB structured-clones, so a function member
 * would be a `DataCloneError` in a real browser too).
 */
const SAMPLE_CLIENT: PersistedClient = {
  timestamp: 1_700_000_000_000,
  buster: "",
  clientState: {
    mutations: [],
    queries: [
      {
        queryKey: ["invoices", "list"],
        queryHash: '["invoices","list"]',
        state: {
          data: { data: [{ id: "inv-1" }] },
          dataUpdateCount: 1,
          dataUpdatedAt: 1_700_000_000_000,
          error: null,
          errorUpdateCount: 0,
          errorUpdatedAt: 0,
          fetchFailureCount: 0,
          fetchFailureReason: null,
          fetchMeta: null,
          isInvalidated: false,
          status: "success",
          fetchStatus: "idle",
        },
        queryKeyHash: '["invoices","list"]',
        observers: [],
      },
    ],
  },
} as unknown as PersistedClient;

/** Build a cache entry, optionally with data, optionally opted into persistence. */
function seedQuery(
  client: QueryClient,
  key: string,
  persistOffline: boolean,
  dataUpdatedAt: number | null,
): Query {
  const query = client.getQueryCache().build(client, {
    queryKey: [key],
    queryFn: async () => `${key}-data`,
    meta: { persistOffline },
  });

  if (dataUpdatedAt !== null) {
    query.setState({ data: `${key}-data`, dataUpdatedAt });
  }

  return query;
}

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
}

describe("queryPersistence", () => {
  let fake: ReturnType<typeof createFakeIndexedDb>;

  beforeEach(() => {
    fake = createFakeIndexedDb();
    vi.stubGlobal("indexedDB", fake.factory);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("shouldPersistMarketplaceQuery", () => {
    it("persists a query that opted in", () => {
      const query = { meta: { persistOffline: true } } as unknown as Query;
      expect(shouldPersistMarketplaceQuery(query)).toBe(true);
    });

    it("does not persist a query that did not opt in", () => {
      expect(
        shouldPersistMarketplaceQuery({ meta: { persistOffline: false } } as unknown as Query)
      ).toBe(false);
    });

    it("does not persist a query with no meta at all", () => {
      expect(shouldPersistMarketplaceQuery({} as unknown as Query)).toBe(false);
    });

    it("does not persist on a truthy non-boolean meta value", () => {
      // The contract is an explicit opt-in, not mere truthiness: a meta field
      // set to a string by some other feature must not pull a query into the
      // offline cache.
      expect(
        shouldPersistMarketplaceQuery({
          meta: { persistOffline: "yes" },
        } as unknown as Query)
      ).toBe(false);
    });
  });

  describe("createIndexedDbPersister", () => {
    it("round-trips a persisted client through IndexedDB", async () => {
      const persister = createIndexedDbPersister();

      await persister.persistClient(SAMPLE_CLIENT);
      const restored = await persister.restoreClient();

      expect(restored).toEqual(SAMPLE_CLIENT);
    });

    it("stores a copy rather than a live reference", async () => {
      // IndexedDB structured-clones on write; a live reference would let a later
      // mutation of the in-memory cache silently rewrite what is "on disk".
      const persister = createIndexedDbPersister();

      await persister.persistClient(SAMPLE_CLIENT);
      const restored = await persister.restoreClient();

      expect(restored).not.toBe(SAMPLE_CLIENT);
      expect(restored!.clientState).not.toBe(SAMPLE_CLIENT.clientState);
    });

    it("restores nothing when the store is empty", async () => {
      expect(await createIndexedDbPersister().restoreClient()).toBeUndefined();
    });

    it("stops restoring the previous snapshot after removeClient", async () => {
      const persister = createIndexedDbPersister();

      await persister.persistClient(SAMPLE_CLIENT);
      await expect(persister.restoreClient()).resolves.toBeDefined();

      await persister.removeClient();

      expect(await persister.restoreClient()).toBeUndefined();
    });

    it("degrades to a no-op when IndexedDB is unavailable", async () => {
      // SSR and private-browsing modes have no IndexedDB. A marketplace page
      // must still render, so every persister method has to resolve quietly.
      vi.stubGlobal("indexedDB", undefined);
      const persister = createIndexedDbPersister();

      await expect(persister.persistClient(SAMPLE_CLIENT)).resolves.toBeUndefined();
      await expect(persister.removeClient()).resolves.toBeUndefined();
      await expect(persister.restoreClient()).resolves.toBeUndefined();
      expect(fake.records.size).toBe(0);
    });
  });

  describe("cache lifetime", () => {
    it("keeps marketplace data for a day", () => {
      expect(MARKETPLACE_CACHE_MAX_AGE_MS).toBe(DAY_MS);
    });

    it("does not garbage-collect the cache before it reaches max age", () => {
      // If gcTime were shorter than maxAge, data could be evicted while still
      // counting as fresh — the badge would claim freshness with nothing to show.
      expect(MARKETPLACE_CACHE_GC_TIME_MS).toBeGreaterThanOrEqual(
        MARKETPLACE_CACHE_MAX_AGE_MS
      );
    });
  });

  describe("getLatestMarketplaceDataUpdatedAt", () => {
    it("returns null for an empty cache", () => {
      expect(getLatestMarketplaceDataUpdatedAt(createClient())).toBeNull();
    });

    it("returns null when no query opted into persistence", () => {
      const client = createClient();
      seedQuery(client, "session", false, 5_000);

      expect(getLatestMarketplaceDataUpdatedAt(client)).toBeNull();
    });

    it("returns the newest opted-in timestamp", () => {
      const client = createClient();
      seedQuery(client, "older", true, 1_000);
      seedQuery(client, "newest", true, 9_000);

      expect(getLatestMarketplaceDataUpdatedAt(client)).toBe(9_000);
    });

    it("ignores timestamps from queries that are not persisted", () => {
      const client = createClient();
      seedQuery(client, "persisted", true, 4_000);
      seedQuery(client, "transient", false, 99_999);

      expect(getLatestMarketplaceDataUpdatedAt(client)).toBe(4_000);
    });

    it("ignores opted-in queries that have not resolved yet", () => {
      const client = createClient();
      seedQuery(client, "pending", true, null);
      seedQuery(client, "resolved", true, 4_000);

      expect(getLatestMarketplaceDataUpdatedAt(client)).toBe(4_000);
    });

    it("returns null rather than 0 when nothing resolved yet", () => {
      const client = createClient();
      seedQuery(client, "pending", true, null);

      expect(getLatestMarketplaceDataUpdatedAt(client)).toBeNull();
    });
  });
});
