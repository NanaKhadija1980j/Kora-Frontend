"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ChevronRight, Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUIStore } from "@/store";
import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";
import { safeExternalUrl } from "@/lib/security";
import { getWalletIconSvg, sanitizeSvg } from "@/lib/svgHelper";

const WALLETS = [
  {
    id: "freighter",
    name: "Freighter",
    description: "Browser extension by Stellar Development Foundation",
    icon: "/wallets/freighter.svg",
    popular: true,
    installUrl: "https://www.freighter.app/",
    isAvailable: () =>
      typeof window !== "undefined" &&
      !!(window as Window & { freighter?: unknown }).freighter,
  },
  {
    id: "xbull",
    name: "xBull Wallet",
    description: "Feature-rich Stellar wallet",
    icon: "/wallets/xbull.svg",
    popular: false,
    installUrl: "https://xbull.app/",
    isAvailable: () =>
      typeof window !== "undefined" &&
      !!(window as Window & { xBullSDK?: unknown }).xBullSDK,
  },
  {
    id: "lobstr",
    name: "LOBSTR",
    description: "Simple and secure Stellar wallet",
    icon: "/wallets/lobstr.svg",
    popular: false,
    installUrl: "https://lobstr.co/",
    isAvailable: () =>
      typeof window !== "undefined" &&
      !!(window as Window & { lobstr?: unknown }).lobstr,
  },
  {
    id: "albedo",
    name: "Albedo",
    description: "Web-based Stellar signer — no extension needed",
    icon: "/wallets/albedo.svg",
    popular: false,
    installUrl: "https://albedo.link/",
    isAvailable: () => true,
  },
];

type WalletState = "idle" | "connecting" | "success" | "error";

export function WalletConnectModal() {
  const t = useTranslations("wallet");
  const { walletModalOpen, setWalletModalOpen } = useUIStore();
  const { connectWallet, isConnected } = useWallet();
  const [walletState, setWalletState] = useState<WalletState>("idle");
  const [activeWallet, setActiveWallet] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  const wallet = activeWallet ? WALLETS.find((w) => w.id === activeWallet) : null;
  const isConnecting = walletState === "connecting";
  const isSuccess = walletState === "success";
  const isError = walletState === "error";
  const installed = wallet ? wallet.isAvailable() : false;
  const i = 0;

  useEffect(() => {
    if (walletModalOpen) {
      setTimeout(() => firstFocusRef.current?.focus(), 50);
    } else {
      setWalletState("idle");
      setActiveWallet(null);
      setErrorMsg(null);
    }
  }, [walletModalOpen]);

  const handleConnect = async (walletId: string) => {
    setActiveWallet(walletId);
    setWalletState("connecting");
    setErrorMsg(null);
    try {
      await connectWallet(walletId);
      setWalletState("success");
      setTimeout(() => setWalletModalOpen(false), 1500);
    } catch (err) {
      setWalletState("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Connection failed. Please try again."
      );
    }
  };

  const handleRetry = () => {
    if (activeWallet) handleConnect(activeWallet);
  };

  if (isConnected) return null;

  return (
    <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
      <DialogContent
        className="max-w-sm"
        aria-busy={walletState === "connecting"}
        onKeyDown={(e) => { if (e.key === "Escape" && walletState !== "connecting") setWalletModalOpen(false); }}
      >
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-kora-muted text-primary">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>{t("connectTitle")}</DialogTitle>
          <DialogDescription>{t("connectToAccess")}</DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {walletState === "success" ? (() => {
            const wallet = WALLETS.find((w) => w.id === activeWallet);
            if (!wallet) return null;
            const installed = wallet.isAvailable();
            const i = WALLETS.indexOf(wallet);
            const isConnecting = false;
            const isSuccess = true;
            const isError = false;

            return (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-8 gap-4"
              >
                <motion.div
                  key={wallet.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={cn(
                    "relative flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-all",
                    isConnecting && "border-primary/30 bg-kora-muted",
                    isSuccess && "border-green-500/40 bg-green-500/5",
                    isError && "border-destructive/40 bg-destructive/5"
                  )}
                >
                  {(() => {
                    const svg = getWalletIconSvg(wallet.id);
                    if (svg) {
                      return (
                        <div
                          className="shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                          style={{ width: 32, height: 32 }}
                          dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
                        />
                      );
                    }
                    return (
                      <Image
                        src={wallet.icon}
                        alt={wallet.name}
                        width={32}
                        height={32}
                        className="shrink-0 rounded-lg"
                      />
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {wallet.name}
                      </span>
                      {wallet.popular && (
                        <span className="rounded bg-kora-muted px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {t("popular")}
                        </span>
                      )}
                      {!installed && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {t("notInstalled")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {wallet.description}
                    </p>
                    <AnimatePresence>
                      {isError && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-1 text-xs text-destructive"
                        >
                          {errorMsg}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {isConnecting && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {isSuccess && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </motion.div>
                    )}
                    {isError && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20"
                      >
                        <AlertCircle className="h-3 w-3" /> {t("retry")}
                      </button>
                    )}
                    {!isConnecting && !isSuccess && !isError &&
                      (installed ? (
                        <button
                          ref={i === 0 ? firstFocusRef : undefined}
                          type="button"
                          onClick={() => handleConnect(wallet.id)}
                          disabled={isConnecting}
                          aria-label={`Connect ${wallet.name}`}
                          className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Connect <ChevronRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <a
                          href={safeExternalUrl(wallet.installUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Install ${wallet.name} extension`}
                          className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {t("install")} <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                  </div>

                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-center"
                >
                  <p className="font-medium text-foreground">Wallet Connected!</p>
                  <p className="text-sm text-muted-foreground mt-1">Redirecting…</p>
                </motion.div>
              </motion.div>
            );
          })() : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2 space-y-2"
            >
              {WALLETS.map((wallet, i) => {
                const installed = wallet.isAvailable();
                const isActive = activeWallet === wallet.id;
                const isConnecting = isActive && walletState === "connecting";
                const isError = isActive && walletState === "error";

                return (
                  <motion.div
                    key={wallet.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3.5",
                      "transition-all",
                      isConnecting && "border-primary/30 bg-kora-muted",
                      isError && "border-destructive/40 bg-destructive/5",
                    )}
                  >
                    {(() => {
                      const svg = getWalletIconSvg(wallet.id);
                      if (svg) {
                        return (
                          <div
                            className="shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                            style={{ width: 32, height: 32 }}
                            dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
                          />
                        );
                      }
                      return (
                        <Image
                          src={wallet.icon}
                          alt={wallet.name}
                          width={32}
                          height={32}
                          className="shrink-0 rounded-lg"
                        />
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{wallet.name}</span>
                        {wallet.popular && (
                          <span className="rounded bg-kora-muted px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {t("popular")}
                          </span>
                        )}
                        {!installed && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {t("notInstalled")}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{wallet.description}</p>
                      <AnimatePresence>
                        {isError && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-1 text-xs text-destructive line-clamp-2"
                          >
                            {errorMsg}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isConnecting && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Loader2 className="h-4 w-4 text-primary" aria-hidden="true" />
                        </motion.div>
                      )}
                      {isError && (
                        <button
                          type="button"
                          onClick={handleRetry}
                          className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20 transition-colors"
                        >
                          <AlertCircle className="h-3 w-3" aria-hidden="true" /> {t("retry")}
                        </button>
                      )}
                      {!isConnecting && !isError && (
                        installed ? (
                          <button
                            ref={i === 0 ? firstFocusRef : undefined}
                            type="button"
                            onClick={() => handleConnect(wallet.id)}
                            disabled={walletState === "connecting"}
                            aria-label={`Connect ${wallet.name}`}
                            className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                          >
                            Connect <ChevronRight className="h-3 w-3" aria-hidden="true" />
                          </button>
                        ) : (
                          <a
                            href={safeExternalUrl(wallet.installUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Install ${wallet.name} extension`}
                            className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {t("install")} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("termsPrefix")}{" "}
          <a href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
            {t("termsLink")}
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
