"use client";

import React from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { StellarTxLink } from "@/components/ui/stellar-tx-link";
import { useUIStore } from "@/store/uiStore";

export type NotificationPreferenceType =
  | "txConfirmed"
  | "invoiceFunded"
  | "maturityReminder"
  | "yieldAvailable";

interface TxToastProps {
  message: string;
  txHash?: string;
}

export function TxToast({ message, txHash }: TxToastProps) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1 w-full">
      <span className="font-medium text-foreground">{message}</span>
      {txHash && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <span className="shrink-0">Tx Link:</span>
          <StellarTxLink hash={txHash} chars={8} size="sm" />
        </div>
      )}
    </div>
  );
}

interface ErrorToastProps {
  message: string;
  description?: string;
  onRetry?: () => void;
  toastId: string | number;
  retryLabel: string;
  dismissLabel: string;
}

export function ErrorToast({
  message,
  description,
  onRetry,
  toastId,
  retryLabel,
  dismissLabel,
}: ErrorToastProps) {
  return (
    <div role="alert" aria-live="assertive" className="flex flex-col gap-2 w-full">
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-destructive">{message}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {onRetry && (
          <button
            onClick={() => {
              toast.dismiss(toastId);
              onRetry();
            }}
            className="rounded bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground hover:opacity-90 transition-opacity"
          >
            {retryLabel}
          </button>
        )}
        <button
          onClick={() => toast.dismiss(toastId)}
          className="rounded border border-border bg-transparent px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const notificationPreferences = useUIStore((s) => s.notificationPreferences);
  const t = useTranslations("transaction");

  const shouldNotify = (type?: NotificationPreferenceType) => {
    if (!type) return true;
    return notificationPreferences[type];
  };

  const showLoading = (
    message: string,
    id: string | number,
    type?: NotificationPreferenceType
  ) => {
    if (!shouldNotify(type)) return id;
    return toast.loading(
      <div role="status" aria-live="polite" className="font-medium text-foreground">
        {message}
      </div>,
      { id, duration: Infinity }
    );
  };

  const showSuccess = (
    message: string,
    txHash?: string,
    id?: string | number,
    type?: NotificationPreferenceType
  ) => {
    const toastId = id ?? Math.random().toString();
    if (!shouldNotify(type)) return toastId;
    return toast.success(<TxToast message={message} txHash={txHash} />, {
      id: toastId,
      duration: 4000,
    });
  };

  const showError = (
    message: string,
    description?: string,
    onRetry?: () => void,
    id?: string | number,
    type?: NotificationPreferenceType
  ) => {
    const toastId = id ?? Math.random().toString();
    if (!shouldNotify(type)) return toastId;
    return toast.error(
      <ErrorToast
        message={message}
        description={description}
        onRetry={onRetry}
        toastId={toastId}
        retryLabel={t("retry")}
        dismissLabel={t("dismiss")}
      />,
      { id: toastId, duration: Infinity }
    );
  };

  const dismiss = (id?: string | number) => {
    toast.dismiss(id);
  };

  return {
    loading: showLoading,
    success: showSuccess,
    error: showError,
    dismiss,
  };
}
