/**
 * Sequential batch tx queue tests — Issue #382
 */

import { describe, it, expect, vi } from "vitest";
import { createBatchTxQueue } from "@/lib/batch/txQueue";

describe("createBatchTxQueue", () => {
  it("processes items sequentially and records success", async () => {
    const queue = createBatchTxQueue();
    const order: string[] = [];
    queue.load([
      { id: "1", tokenId: "1", label: "INV-1", action: "cancel" },
      { id: "2", tokenId: "2", label: "INV-2", action: "cancel" },
    ]);

    await queue.start(async (item) => {
      order.push(item.id);
      return { txHash: `hash-${item.id}` };
    });

    expect(order).toEqual(["1", "2"]);
    const snap = queue.getSnapshot();
    expect(snap.successCount).toBe(2);
    expect(snap.failedCount).toBe(0);
    expect(snap.items.every((i) => i.status === "success")).toBe(true);
  });

  it("continues after a failed transaction", async () => {
    const queue = createBatchTxQueue();
    queue.load([
      { id: "1", tokenId: "1", label: "INV-1", action: "repay" },
      { id: "2", tokenId: "2", label: "INV-2", action: "repay" },
      { id: "3", tokenId: "3", label: "INV-3", action: "repay" },
    ]);

    await queue.start(async (item) => {
      if (item.id === "2") throw new Error("boom");
      return { txHash: `hash-${item.id}` };
    });

    const snap = queue.getSnapshot();
    expect(snap.successCount).toBe(2);
    expect(snap.failedCount).toBe(1);
    expect(snap.items[1].status).toBe("failed");
    expect(snap.items[1].error).toBe("boom");
    expect(snap.items[2].status).toBe("success");
  });

  it("resumeFailed retries only failed items", async () => {
    const queue = createBatchTxQueue();
    queue.load([
      { id: "1", tokenId: "1", label: "INV-1", action: "cancel" },
      { id: "2", tokenId: "2", label: "INV-2", action: "cancel" },
    ]);

    let attempts = 0;
    await queue.start(async (item) => {
      if (item.id === "1") throw new Error("first fail");
      return { txHash: "ok" };
    });

    await queue.resumeFailed(async (item) => {
      attempts += 1;
      expect(item.id).toBe("1");
      return { txHash: "retry-ok" };
    });

    expect(attempts).toBe(1);
    const snap = queue.getSnapshot();
    expect(snap.successCount).toBe(2);
    expect(snap.failedCount).toBe(0);
  });

  it("emits per-item processing status updates", async () => {
    const queue = createBatchTxQueue();
    const statuses: string[][] = [];
    queue.subscribe((snap) => {
      statuses.push(snap.items.map((i) => i.status));
    });

    queue.load([{ id: "1", tokenId: "1", label: "INV-1", action: "cancel" }]);

    await queue.start(async () => {
      await Promise.resolve();
      return { txHash: "h" };
    });

    expect(statuses.some((s) => s.includes("processing"))).toBe(true);
    expect(statuses[statuses.length - 1]).toEqual(["success"]);
  });
});

describe("batch eligibility helpers", () => {
  it("isBatchCancelEligible matches unfunded listed invoices", async () => {
    const { isBatchCancelEligible, isBatchRepayEligible } = await import(
      "@/lib/batch/eligibility"
    );
    expect(
      isBatchCancelEligible({
        status: "listed",
        funding: { totalRaised: 0 },
      } as any)
    ).toBe(true);
    expect(
      isBatchCancelEligible({
        status: "active",
        funding: { totalRaised: 0 },
      } as any)
    ).toBe(false);
    expect(
      isBatchRepayEligible({
        status: "fully_funded",
        terms: { repaymentDate: "2020-01-01T00:00:00.000Z" },
        metadata: { dueDate: "2020-01-01T00:00:00.000Z" },
      } as any)
    ).toBe(true);
  });
});
