"use client";

import { useState } from "react";
import { useWalletStore } from "@/store/walletStore";
import { useTranslations } from "next-intl";
import { Shield, ShieldAlert, ShieldCheck, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { SynapsKycModal } from "@/components/wallet/SynapsKycModal";
import { cn } from "@/lib/utils";

export function KycStatusCard() {
  const t = useTranslations("kyc");
  const { kycStatus } = useWalletStore();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <GlassCard className="relative overflow-hidden border-border/60 shadow-lg mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-1">
          <div className="flex items-start gap-3.5">
            <div
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                kycStatus === "verified"
                  ? "bg-success/10 border-success/20 text-success"
                  : kycStatus === "rejected"
                  ? "bg-destructive/10 border-destructive/20 text-destructive"
                  : kycStatus === "pending"
                  ? "bg-warning/10 border-warning/20 text-warning"
                  : "bg-muted/40 border-border text-muted-foreground"
              )}
            >
              {kycStatus === "verified" ? (
                <ShieldCheck className="h-5 w-5" />
              ) : kycStatus === "rejected" ? (
                <ShieldAlert className="h-5 w-5" />
              ) : kycStatus === "pending" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Shield className="h-5 w-5" />
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-200">
                {t("title")}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                {kycStatus === "verified" && t("desc.verified")}
                {kycStatus === "pending" && t("desc.pending")}
                {kycStatus === "rejected" && t("desc.rejected")}
                {kycStatus === "none" && t("desc.unverified")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {kycStatus === "verified" && (
              <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success border border-success/10">
                {t("status.verified")}
              </span>
            )}
            {kycStatus === "pending" && (
              <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning border border-warning/10 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> {t("status.pending")}
              </span>
            )}
            {kycStatus === "rejected" && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="bg-destructive/15 text-destructive border border-destructive/20 hover:bg-destructive/25 text-xs font-semibold"
                onClick={() => setModalOpen(true)}
              >
                {t("cta.reverify")}
              </Button>
            )}
            {kycStatus === "none" && (
              <Button
                type="button"
                size="sm"
                className="text-xs font-semibold flex items-center gap-1"
                onClick={() => setModalOpen(true)}
              >
                {t("cta.verify")} <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      <SynapsKycModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
