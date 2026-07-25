"use client";

import { useWalletStore } from "@/store";

/**
 * Displays the connected wallet's XLM balance.
 *
 * Subscribes ONLY to `balance` from the wallet store so that balance
 * polling updates do not cause the parent Navbar or WalletButton to
 * re-render — each component owns exactly the slice it needs.
 */
export function WalletBalance() {
  const balance = useWalletStore((s) => s.balance);

  if (!balance) return null;

  return (
    <span className="font-mono text-sm tabular-nums text-muted-foreground">
      {parseFloat(balance.xlm).toFixed(2)}{" "}
      <span className="text-xs">XLM</span>
    </span>
  );
}
