"use client";

import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface VerificationModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  error?: string;
  actionType?: string;
  /** The challenge message that will be signed — shown to the user for transparency */
  challengeMessage?: string;
  onVerify: () => Promise<void>;
  onCancel: () => void;
}

export function VerificationModal({
  isOpen,
  isLoading = false,
  error,
  actionType,
  challengeMessage,
  onVerify,
  onCancel,
}: VerificationModalProps) {
  const t = useTranslations("verification");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleVerify = async () => {
    try {
      setLocalError(null);
      await onVerify();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : t("verifying")
      );
    }
  };

  const displayError = error || localError;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-kora-muted text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {actionType
              ? t("descriptionWithAction", { actionType })
              : t("descriptionDefault")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {challengeMessage && (
            <div
              className="rounded-lg border border-border bg-muted/50 px-3 py-2"
              aria-label={t("challengeLabel")}
            >
              <p className="text-xs text-muted-foreground mb-1">{t("messageToSign")}</p>
              <p className="font-mono text-xs text-foreground break-all">{challengeMessage}</p>
            </div>
          )}

          {displayError && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
            >
              {displayError}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleVerify}
              disabled={isLoading}
              className="flex-1"
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("verifying")}
                </>
              ) : (
                t("signAndVerify")
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
