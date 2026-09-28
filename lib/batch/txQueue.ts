/**
 * Sequential transaction queue for batch cancel/repay (#382).
 *
 * Processes items one-by-one, records per-item status, continues after
 * failures, and supports resume/retry of failed items. Sequence numbers
 * are managed by the existing SequenceManager inside contract builders /
 * submitTransaction paths.
 */

export type BatchActionType = "cancel" | "repay";

export type BatchItemStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "skipped";

export interface BatchQueueItem {
  id: string;
  tokenId: string;
  label: string;
  action: BatchActionType;
  status: BatchItemStatus;
  error?: string;
  txHash?: string;
}

export interface BatchQueueSnapshot {
  items: BatchQueueItem[];
  currentIndex: number;
  isRunning: boolean;
  processed: number;
  successCount: number;
  failedCount: number;
}

export type BatchExecutor = (item: BatchQueueItem) => Promise<{ txHash?: string }>;

export type BatchQueueListener = (snapshot: BatchQueueSnapshot) => void;

function snapshotFrom(items: BatchQueueItem[], currentIndex: number, isRunning: boolean): BatchQueueSnapshot {
  const successCount = items.filter((i) => i.status === "success").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const processed = items.filter((i) =>
    i.status === "success" || i.status === "failed" || i.status === "skipped"
  ).length;
  return {
    items: items.map((i) => ({ ...i })),
    currentIndex,
    isRunning,
    processed,
    successCount,
    failedCount,
  };
}

/**
 * Create a sequential batch queue. Failed items do not permanently block
 * subsequent items; call `resumeFailed` to retry only failures.
 */
export function createBatchTxQueue() {
  let items: BatchQueueItem[] = [];
  let currentIndex = -1;
  let isRunning = false;
  let aborted = false;
  const listeners = new Set<BatchQueueListener>();

  const emit = () => {
    const snap = snapshotFrom(items, currentIndex, isRunning);
    listeners.forEach((l) => l(snap));
  };

  const runFrom = async (startIndex: number, executor: BatchExecutor) => {
    if (isRunning) return snapshotFrom(items, currentIndex, isRunning);
    isRunning = true;
    aborted = false;
    emit();

    for (let i = startIndex; i < items.length; i++) {
      if (aborted) break;
      const item = items[i];
      if (item.status === "success" || item.status === "skipped") continue;

      currentIndex = i;
      items[i] = { ...item, status: "processing", error: undefined };
      emit();

      try {
        const result = await executor(items[i]);
        items[i] = {
          ...items[i],
          status: "success",
          txHash: result.txHash,
          error: undefined,
        };
      } catch (err) {
        // Continue queue — do not permanently block subsequent items
        items[i] = {
          ...items[i],
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
      }
      emit();
    }

    isRunning = false;
    currentIndex = -1;
    emit();
    return snapshotFrom(items, currentIndex, isRunning);
  };

  return {
    subscribe(listener: BatchQueueListener) {
      listeners.add(listener);
      listener(snapshotFrom(items, currentIndex, isRunning));
      return () => listeners.delete(listener);
    },

    load(next: Omit<BatchQueueItem, "status" | "error" | "txHash">[]) {
      items = next.map((item) => ({
        ...item,
        status: "pending" as const,
      }));
      currentIndex = -1;
      emit();
      return snapshotFrom(items, currentIndex, isRunning);
    },

    async start(executor: BatchExecutor) {
      return runFrom(0, executor);
    },

    /** Retry only failed items; successful ones stay done. */
    async resumeFailed(executor: BatchExecutor) {
      items = items.map((item) =>
        item.status === "failed"
          ? { ...item, status: "pending", error: undefined }
          : item
      );
      emit();
      const firstFailed = items.findIndex((i) => i.status === "pending");
      if (firstFailed === -1) return snapshotFrom(items, currentIndex, isRunning);
      return runFrom(firstFailed, executor);
    },

    abort() {
      aborted = true;
    },

    getSnapshot() {
      return snapshotFrom(items, currentIndex, isRunning);
    },

    get progressPercent() {
      if (items.length === 0) return 0;
      const done = items.filter((i) =>
        i.status === "success" || i.status === "failed" || i.status === "skipped"
      ).length;
      return (done / items.length) * 100;
    },
  };
}

export type BatchTxQueue = ReturnType<typeof createBatchTxQueue>;

/** Persist queue state for resume across remounts (session-scoped). */
const STORAGE_KEY = "kora:batch-tx-queue";

export function persistBatchQueue(items: BatchQueueItem[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / private mode
  }
}

export function loadPersistedBatchQueue(): BatchQueueItem[] | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BatchQueueItem[];
  } catch {
    return null;
  }
}

export function clearPersistedBatchQueue(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
