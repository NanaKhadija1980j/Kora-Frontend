"use client";

import { useState } from "react";
import { ChevronDown, LogOut, ExternalLink, Bell, Coins, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/CopyButton";
import { StellarAddress } from "@/components/ui/stellar-address";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWallet } from "@/hooks/useWallet";
import { useWalletStore } from "@/store";
import { useToast } from "@/hooks/useToast";
import { useUIStore } from "@/store";
import { cn } from "@/lib/utils";
import { safeStellarAccountUrl } from "@/lib/security";
import { env } from "@/lib/env";

export function WalletButton() {
  const t = useTranslations("wallet");
  const {
    isConnected,
    address,
    balance,
    kitSessionActive,
    showReconnectPrompt,
    isReconnecting,
    disconnectWallet,
    manualReconnect,
    fundWalletOnTestnet,
    refreshBalance,
  } = useWallet();
  const { isWrongNetwork, hasPassphraseMismatch, network } = useWalletStore();
  const { setWalletModalOpen } = useUIStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [isFunding, setIsFunding] = useState(false);

  const isTestnet = env.NEXT_PUBLIC_STELLAR_NETWORK === "testnet";
  const hasNetworkMismatch = isWrongNetwork() || hasPassphraseMismatch();

  const handleManualReconnect = async () => {
    try {
      await manualReconnect();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reconnect failed";
      toast.error("Failed to reconnect wallet", message);
    }
  };

  const handleFundTestnetAccount = async () => {
    setIsFunding(true);
    const toastId = "testnet-funding";
    try {
      toast.loading(t("fundingTestnet"), toastId);
      await fundWalletOnTestnet();
      await refreshBalance();
      toast.success(t("fundSuccess"), undefined, toastId);
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("fundFailed");
      toast.error(t("fundFailed"), message, undefined, toastId);
    } finally {
      setIsFunding(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectWallet();
    setConfirmDisconnectOpen(false);
    setOpen(false);
  };

  const expectedNetwork = (env.NEXT_PUBLIC_STELLAR_NETWORK as typeof network) || "testnet";
  const networkLabel = {
    testnet: "Testnet",
    mainnet: "Mainnet",
    futurenet: "Futurenet",
  };

  if (!isConnected) {
    return (
      <Button onClick={() => setWalletModalOpen(true)} size="sm">
        {t("connect")}
      </Button>
    );
  }

  // Determine the visual state of the session indicator dot.
  // - null (reconnecting): spinner
  // - false (stale): amber warning dot
  // - true (active): green pulse
  const sessionIndicator = () => {
    if (kitSessionActive === null || isReconnecting) {
      return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
    }
    if (kitSessionActive === false || showReconnectPrompt) {
      return <span className="h-2 w-2 rounded-full bg-warning" title="Wallet session inactive — reconnect required" />;
    }
    return <span className="h-2 w-2 rounded-full bg-success animate-pulse" />;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2",
          "text-sm transition-colors",
          hasNetworkMismatch
            ? "border-destructive/30 bg-destructive/5 text-destructive hover:border-destructive/40 hover:bg-destructive/10"
            : showReconnectPrompt
              ? "border-warning/30 bg-warning/5 text-warning-foreground hover:border-warning/40 hover:bg-warning/10"
              : "border-input bg-card text-foreground hover:border-border hover:bg-muted"
        )}
        aria-label={`Wallet menu${hasNetworkMismatch ? " - Wrong network" : showReconnectPrompt ? " - Reconnect required" : ""}`}
      >
        {hasNetworkMismatch ? (
          <AlertCircle className="h-4 w-4 shrink-0" />
        ) : (
          sessionIndicator()
        )}
        <StellarAddress address={address!} chars={4} size="sm" showCopy={false} className="text-current" />
        <div className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
          {networkLabel[network] || network}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-background p-3 shadow-token-lg">
          {/* Network mismatch warning */}
          {hasNetworkMismatch && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                Connected to <span className="capitalize font-medium">{networkLabel[network]}</span> but app requires{" "}
                <span className="capitalize font-medium">{networkLabel[expectedNetwork]}</span>
                {hasPassphraseMismatch() && " (passphrase mismatch)"}. Switch your wallet network to continue.
              </p>
            </div>
          )}

          {/* Stale session / reconnect prompt */}
          {!hasNetworkMismatch && showReconnectPrompt && (
            <div
              className="mb-3 rounded-lg border border-warning/20 bg-warning/10 p-2.5"
              role="alert"
              aria-label="Wallet session inactive"
              data-testid="reconnect-prompt"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-warning-foreground">
                    {t("sessionExpiredTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("sessionExpiredDesc")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  handleManualReconnect();
                }}
                disabled={isReconnecting}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-warning/20 px-2 py-1.5 text-xs font-medium text-warning-foreground hover:bg-warning/30 disabled:opacity-60 transition-colors"
                data-testid="reconnect-button"
              >
                {isReconnecting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {isReconnecting ? t("reconnecting") : t("reconnect")}
              </button>
            </div>
          )}

          {/* Reconnect pending spinner */}
          {!hasNetworkMismatch && kitSessionActive === null && !showReconnectPrompt && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t("restoringSession")}</p>
            </div>
          )}

          {balance && (
            <div className="mb-3 space-y-1 rounded-lg bg-card p-3">
              <p className="text-xs text-muted-foreground">{t("balances")}</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">XLM</span>
                <span className="font-medium text-foreground">
                  {parseFloat(balance.xlm).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">USDC</span>
                <span className="font-medium text-foreground">
                  {parseFloat(balance.usdc).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
              <CopyButton text={address!} />
              {t("copyAddress")}
            </div>
            <a
              href={safeStellarAccountUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" /> {t("viewExplorer")}
            </a>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-3.5 w-3.5" /> {t("notificationSettings")}
            </button>
            {isTestnet && (
              <button
                type="button"
                disabled={isFunding || hasNetworkMismatch}
                onClick={handleFundTestnetAccount}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                {isFunding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Coins className="h-3.5 w-3.5" />
                )}
                {isFunding ? t("funding") : t("fundTestnet")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmDisconnectOpen(true)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" /> {t("disconnect")}
            </button>
          </div>
        </div>
      )}

      {/* Notification settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("notificationSettings")}</DialogTitle>
            <DialogDescription>
              Configure toast notifications for transaction and invoice events.
            </DialogDescription>
          </DialogHeader>
          <NotificationSettings />
        </DialogContent>
      </Dialog>

      {/* Disconnect confirm dialog */}
      <Dialog open={confirmDisconnectOpen} onOpenChange={setConfirmDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("disconnectTitle")}</DialogTitle>
            <DialogDescription>{t("disconnectConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisconnectOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="danger" onClick={handleDisconnect}>
              {t("disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
