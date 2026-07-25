"use client";

import { AlertCircle, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { useWallet } from "@/hooks/useWallet";
import { useWalletStore } from "@/store";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function WrongNetworkBanner() {
  const t = useTranslations("wrongNetwork");
  const { isConnected, switchNetwork } = useWallet();
  const { isWrongNetwork, hasPassphraseMismatch, network } = useWalletStore();
  const [dismissed, setDismissed] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const networkMismatch = isWrongNetwork();
  const passphraseMismatch = hasPassphraseMismatch();

  // Reset dismissal when navigating or network state changes
  useEffect(() => {
    setDismissed(false);
  }, [isConnected, networkMismatch, passphraseMismatch]);

  const isWrongNetworkState = (networkMismatch || passphraseMismatch) && !dismissed;

  if (!isWrongNetworkState) return null;

  const networkLabel: Record<string, string> = {
    testnet: "Testnet",
    mainnet: "Mainnet",
    futurenet: "Futurenet",
  };

  const expectedNetwork = (env.NEXT_PUBLIC_STELLAR_NETWORK as typeof network) || "testnet";

  const handleSwitchNetwork = async () => {
    setIsSwitching(true);
    try {
      await switchNetwork();
    } catch {
      // ignore errors
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-destructive/10 px-4 py-3 text-sm text-destructive border-b border-destructive/20"
      >
        <div className="flex items-center gap-2 flex-1">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            {t("message", {
              current: networkLabel[network] || network,
              expected: networkLabel[expectedNetwork] || expectedNetwork,
              passphrase: passphraseMismatch ? t("passphraseMismatch") : "",
            })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={handleSwitchNetwork}
            isLoading={isSwitching}
          >
            Switch Network
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={t("dismiss")}
            className="shrink-0 rounded-md p-1 hover:bg-destructive/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
