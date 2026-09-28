"use client";

/**
 * InvoiceAmendmentForm — allows SMEs to propose metadata corrections (#568).
 *
 * Eligible statuses: listed, partially_funded.
 * Allowed fields:    description, category.
 * Blocked states:    fully_funded, active, repaid, defaulted, cancelled.
 *
 * The form re-pins updated metadata to IPFS and returns the new CID to the
 * parent via `onSuccess`.
 */

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  canAmend,
  getAmendBlockedReason,
  AMENDABLE_FIELDS,
  type InvoiceAmendment,
} from "@/lib/invoiceStateMachine";
import { prepareAmendInvoiceMetadata } from "@/services/invoiceService";
import type { Invoice } from "@/types";
import { cn } from "@/lib/utils";

// ─── Category options (mirrors marketplace page) ──────────────────────────────

const CATEGORY_OPTIONS = [
  "technology",
  "agriculture",
  "healthcare",
  "construction",
  "energy",
  "logistics",
  "retail",
  "manufacturing",
  "finance",
  "other",
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface InvoiceAmendmentFormProps {
  invoice: Invoice;
  ownerAddress: string;
  /** Called with the new IPFS CID after a successful amendment. */
  onSuccess?: (newCid: string) => void;
  /** Called when the user cancels without making changes. */
  onCancel?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoiceAmendmentForm({
  invoice,
  ownerAddress,
  onSuccess,
  onCancel,
}: InvoiceAmendmentFormProps) {
  const t = useTranslations("amendment");

  const isOwner =
    !!ownerAddress &&
    ownerAddress.toLowerCase() === invoice.ownerAddress?.toLowerCase();

  const blockedReason = getAmendBlockedReason(invoice.status, isOwner, true);

  const [description, setDescription] = useState(
    invoice.metadata.description ?? ""
  );
  const [category, setCategory] = useState(invoice.metadata.category ?? "other");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCid, setSuccessCid] = useState<string | null>(null);

  // ── Blocked state ──────────────────────────────────────────────────────────
  if (blockedReason) {
    return (
      <div
        className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4"
        role="alert"
        aria-live="polite"
        data-testid="amendment-blocked"
      >
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">
              {t("blockedTitle")}
            </p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {blockedReason}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (successCid) {
    return (
      <div
        className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-2"
        role="status"
        aria-live="polite"
        data-testid="amendment-success"
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              {t("successTitle")}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">{t("successDesc")}</p>
            <p className="text-xs text-zinc-500 font-mono mt-1 break-all">
              {t("newCid")}: {successCid}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const amendment: InvoiceAmendment = {};
      if (description !== invoice.metadata.description) {
        amendment.description = description;
      }
      if (category !== invoice.metadata.category) {
        amendment.category = category;
      }

      if (Object.keys(amendment).length === 0) {
        setError(t("noChanges"));
        setSubmitting(false);
        return;
      }

      const newCid = await prepareAmendInvoiceMetadata(
        invoice.id,
        invoice.status,
        ownerAddress,
        amendment
      );

      setSuccessCid(newCid);
      onSuccess?.(newCid);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unknownError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      aria-label={t("formAriaLabel")}
      data-testid="amendment-form"
    >
      <div className="flex items-center gap-2 mb-1">
        <Pencil className="h-4 w-4 text-zinc-400" />
        <h3 className="text-sm font-semibold text-zinc-200">{t("title")}</h3>
      </div>

      <p className="text-xs text-zinc-500">{t("eligibleFields")}</p>

      {/* Description field */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="amendment-description"
          className="text-xs font-medium text-zinc-300"
        >
          {t("descriptionLabel")}
        </label>
        <textarea
          id="amendment-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={200}
          placeholder={t("descriptionPlaceholder")}
          disabled={submitting}
          className={cn(
            "w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600",
            "focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30",
            "resize-none disabled:opacity-50"
          )}
        />
        <span className="text-[10px] text-zinc-600 text-right">
          {description.length}/200
        </span>
      </div>

      {/* Category field */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="amendment-category"
          className="text-xs font-medium text-zinc-300"
        >
          {t("categoryLabel")}
        </label>
        <select
          id="amendment-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={submitting}
          className={cn(
            "w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200",
            "focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30",
            "disabled:opacity-50 appearance-none cursor-pointer"
          )}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt} value={opt} className="bg-zinc-950">
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Notice: financial terms cannot be changed */}
      <div className="rounded-md bg-zinc-900/50 border border-zinc-800 px-3 py-2 text-xs text-zinc-500">
        {t("lockedFieldsNotice")}
      </div>

      {/* Error */}
      {error && (
        <p
          className="flex items-center gap-1.5 text-xs text-red-400"
          role="alert"
          data-testid="amendment-error"
        >
          <AlertTriangle className="h-3 w-3" />
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          disabled={submitting}
          loading={submitting}
          className="flex-1"
        >
          {submitting ? t("submitting") : t("submit")}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

export default InvoiceAmendmentForm;
