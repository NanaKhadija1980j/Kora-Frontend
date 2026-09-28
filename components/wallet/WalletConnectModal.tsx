"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ChevronRight, Loader2, CheckCircle2, AlertCircle, ExternalLink, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUIStore } from "@/store";
import { useWallet, probeWalletProviderHealth, type WalletProviderHealth } from "@/hooks/useWallet";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";
import { safeExternalUrl } from "@/lib/security";
import { getWalletIconSvg, sanitizeSvg } from "@/lib/svgHelper";
import { preloadWalletKit } from "@/lib/lazyModules";
import { env } from "@/lib/env";
import { useWalletStore } from "@/store/walletStore";

const WALLETS = [
  {
    id: "freighter",
    name: "Freighter",
    description: "Browser extension by Stellar Development Foundation",
    icon: "/wallets/freighter.svg",
    popular: true,
    installUrl: "https://www.freighter.app/",
    deepLink: "https://freighter.app/connect",
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
    description: "Web-based Stellar signer - no extension needed",
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
  const { isMobile } = useBreakpoint();
  const [walletState, setWalletState] = useState<WalletState>("idle");
  const [activeWallet, setActiveWallet] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerHealth, setProviderHealth] = useState<Record<string, WalletProviderHealth>>({});
  const [waitingForDeepLink, setWaitingForDeepLink] = useState(false);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wallet = activeWallet ? WALLETS.find((w) => w.id === activeWallet) : null;
  const isConnecting = walletState === "connecting";
  const isSuccess = walletState === "success";
  const isError = walletState === "error";
  const installed = wallet ? wallet.isAvailable() : false;

  useEffect(() => {
    if (walletModalOpen) {
      if (typeof window !== "undefined") {
        preloadWalletKit();
      }
      setTimeout(() => firstFocusRef.current?.focus(), 50);
      void Promise.all(
        WALLETS.map(async (entry) => [entry.id, await probeWalletProviderHealth(entry.id)] as const)
      ).then((entries) => {
        setProviderHealth(Object.fromEntries(entries));
      });
    } else {
      setWalletState("idle");
      setActiveWallet(null);
      setErrorMsg(null);
      setProviderHealth({});
      setWaitingForDeepLink(false);
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
        visibilityTimerRef.current = null;
      }
    }
  }, [walletModalOpen]);

  const getHealthBadge = (walletId: string) => {
    const health = providerHealth[walletId];
    if (!health) return null;
    const map = {
      ready: "bg-emerald-500/10 text-emerald-600",
      missing: "bg-muted text-muted-foreground",
      locked: "bg-amber-500/10 text-amber-600",
      unsupported_network: "bg-destructive/10 text-destructive",
      error: "bg-destructive/10 text-destructive",
    } as const;
    return (
      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", map[health.state])}>
        {health.message}
      </span>
    );
  };

  useEffect(() => {
    if (!waitingForDeepLink) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (visibilityTimerRef.current) {
          clearTimeout(visibilityTimerRef.current);
        }
        visibilityTimerRef.current = setTimeout(() => {
          if (waitingForDeepLink && activeWallet) {
            setWaitingForDeepLink(false);
            handleConnect(activeWallet);
          }
        }, 800);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
    };
  }, [waitingForDeepLink, activeWallet]);

  const handleConnect = async (walletId: string) => {
    setActiveWallet(walletId);
    setWalletState("connecting");
    setErrorMsg(null);
    setWaitingForDeepLink(false);
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

  const handleDeepLink = (walletId: string) => {
    const walletEntry = WALLETS.find((w) => w.id === walletId);
    if (!walletEntry?.deepLink) return;
    setWaitingForDeepLink(true);
    setWalletState("connecting");
    setActiveWallet(walletId);
    setErrorMsg(null);
    window.location.href = walletEntry.deepLink;
  };

  const handleRetry = () => {
    if (activeWallet) handleConnect(activeWallet);
  };

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

            return (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-8 gap-4"
              >
                <div className="flex w-full items-center gap-3 rounded-xl border border-green-500/40 bg-green-500/5 p-3.5">
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
                    <span className="text-sm font-medium text-foreground">{wallet.name}</span>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">{t("walletConnected")}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t("redirecting")}</p>
                </div>
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
                const isConnectingItem = isActive && walletState === "connecting";
                const isErrorItem = isActive && walletState === "error";
                const health = providerHealth[wallet.id];
                const disabledByHealth =
                  health?.state === "missing" || health?.state === "unsupported_network";

                return (
                  <motion.div
                    key={wallet.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3.5",
                      "transition-all",
                      isConnectingItem && "border-primary/30 bg-kora-muted",
                      isErrorItem && "border-destructive/40 bg-destructive/5",
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
                        {getHealthBadge(wallet.id)}
                        {!installed && !isMobile && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {t("notInstalled")}
                          </span>
                        )}
                        {isMobile && !installed && wallet.deepLink && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                            <Smartphone className="inline h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
                            {t("mobileApp")}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{wallet.description}</p>
                      {health && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {health.message}
                        </p>
                      )}
                      <AnimatePresence>
                        {isErrorItem && (
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
                      {isConnectingItem && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Loader2 className="h-4 w-4 text-primary" aria-hidden="true" />
                        </motion.div>
                      )}
                      {isErrorItem && (
                        <button
                          type="button"
                          onClick={handleRetry}
                          className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20 transition-colors"
                        >
                          <AlertCircle className="h-3 w-3" aria-hidden="true" /> {t("retry")}
                        </button>
                      )}
                      {!isConnectingItem && !isErrorItem && (
                        installed ? (
                          <button
                            ref={i === 0 ? firstFocusRef : undefined}
                            type="button"
                            onClick={() => handleConnect(wallet.id)}
                            disabled={walletState === "connecting" || disabledByHealth}
                            aria-label={`Connect ${wallet.name}`}
                            className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                          >
                            Connect <ChevronRight className="h-3 w-3" aria-hidden="true" />
                          </button>
                        ) : isMobile && wallet.deepLink ? (
                          <button
                            ref={i === 0 ? firstFocusRef : undefined}
                            type="button"
                            onClick={() => handleDeepLink(wallet.id)}
                            disabled={walletState === "connecting"}
                            aria-label={`Open ${wallet.name} mobile app`}
                            className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                          >
                            <Smartphone className="h-3 w-3" aria-hidden="true" />
                            {t("openInApp")} <ExternalLink className="h-3 w-3" aria-hidden="true" />
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

              {waitingForDeepLink && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  {t("deepLinkWaiting")}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 border-t border-border pt-4">
          <div className="text-center">
            <p className="mb-2 text-xs text-muted-foreground">Or browse in read-only mode</p>
            <div className="flex items-center justify-center gap-2">
              <input
                type="text"
                placeholder="Paste a G-address to watch..."
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                id="watch-address-input"
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById("watch-address-input") as HTMLInputElement;
                  const addr = input?.value?.trim();
                  if (addr && addr.startsWith("G") && addr.length === 56) {
                    useWalletStore.getState().enterWatchMode(addr);
                    setWalletModalOpen(false);
                    input.value = "";
                  }
                }}
                className="rounded-md bg-blue-500/10 px-3 py-1.5 text-xs text-blue-500 hover:bg-blue-500/20 transition-colors"
              >
                Watch
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("termsPrefix")}{" "}
          <a href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
            {t("termsLink")}
          </a>
        </p>
        {env.NEXT_PUBLIC_ENABLE_DEVTOOLS && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Provider health checks are running in pre-connect mode.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
