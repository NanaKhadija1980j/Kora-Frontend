/**
 * Offline queue for already-signed XDR transaction envelopes.
 *
 * The PWA caches pages for offline use, but signing a transaction requires
 * wallet connectivity. This queue stores XDR envelopes that were *already
 * signed while online* so submission can be retried once the connection
 * returns — it never stores private keys or unsigned payloads that would
 * require re-prompting the wallet.
 */

const DB_NAME = "kora-xdr-queue";
const STORE_NAME = "drafts";

export interface QueuedXdrDraft {
  id: string;
  /** Signed XDR envelope (base64) — never a private key or seed phrase. */
  signedXdr: string;
  /** Free-form context for the UI, e.g. { type: "fundInvoice", invoiceId } */
  meta: Record<string, unknown>;
  queuedAt: number;
  attempts: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueSignedXdr(
  signedXdr: string,
  meta: Record<string, unknown> = {}
): Promise<QueuedXdrDraft> {
  const db = await openDb();
  const draft: QueuedXdrDraft = {
    id: crypto.randomUUID(),
    signedXdr,
    meta,
    queuedAt: Date.now(),
    attempts: 0,
  };
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(draft);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(draft);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listQueuedXdrDrafts(): Promise<QueuedXdrDraft[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const req = tx.objectStore(STORE_NAME).getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as QueuedXdrDraft[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueuedXdrDraft(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Resubmits every queued draft using the provided submit function, removing
 * each draft on success and leaving it queued (with attempts incremented)
 * on failure so it can be retried on the next reconnect.
 */
export async function flushQueuedXdrDrafts(
  submit: (draft: QueuedXdrDraft) => Promise<void>
): Promise<{ succeeded: string[]; failed: string[] }> {
  const drafts = await listQueuedXdrDrafts();
  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const draft of drafts) {
    try {
      await submit(draft);
      await removeQueuedXdrDraft(draft.id);
      succeeded.push(draft.id);
    } catch {
      failed.push(draft.id);
    }
  }

  return { succeeded, failed };
}

/** Convenience: call from a `window.addEventListener("online", ...)` handler. */
export function registerXdrQueueOnlineFlush(submit: (draft: QueuedXdrDraft) => Promise<void>): () => void {
  const handler = () => {
    void flushQueuedXdrDrafts(submit);
  };
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
