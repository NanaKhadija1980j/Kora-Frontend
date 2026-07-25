"use client";

import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquarePlus, X, Bug, Lightbulb, MessageCircle, Paperclip, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/store/walletStore";

// ── Schema ────────────────────────────────────────────────────────────────────
const feedbackSchema = z.object({
  type: z.enum(["bug", "feature", "other"]),
  title: z.string().min(3, "Title must be at least 3 characters").max(120),
  description: z.string().min(10, "Please provide more detail").max(2000),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

// ── Type selector config ──────────────────────────────────────────────────────
const FEEDBACK_TYPES = [
  { value: "bug" as const, label: "Bug Report", icon: Bug, color: "text-destructive" },
  { value: "feature" as const, label: "Feature Request", icon: Lightbulb, color: "text-amber-400" },
  { value: "other" as const, label: "Other", icon: MessageCircle, color: "text-primary" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getBrowserInfo(): string {
  if (typeof navigator === "undefined") return "unknown";
  return navigator.userAgent;
}

async function captureScreenshot(): Promise<string | null> {
  try {
    // Dynamically import html2canvas to keep it out of the initial bundle
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: false,
      scale: 0.5, // reduce size
      logging: false,
    });
    return canvas.toDataURL("image/jpeg", 0.6);
  } catch {
    return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function FeedbackWidget() {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturingScreen, setCapturingScreen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const walletAddress = useWalletStore((s) => s.address);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { type: "bug" },
  });

  const selectedType = watch("type");

  // ── Screenshot capture ────────────────────────────────────────────────────
  const handleCaptureScreen = useCallback(async () => {
    setCapturingScreen(true);
    // Brief delay so the widget can close/minimise before capture
    setOpen(false);
    await new Promise((r) => setTimeout(r, 300));
    const dataUrl = await captureScreenshot();
    setScreenshot(dataUrl);
    setOpen(true);
    setCapturingScreen(false);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("invalidImageType"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("imageTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshot(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, [t]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = useCallback(
    async (values: FeedbackFormValues) => {
      setSubmitting(true);
      try {
        const payload = {
          ...values,
          screenshot,
          context: {
            url: window.location.href,
            walletAddress,
            userAgent: getBrowserInfo(),
            timestamp: new Date().toISOString(),
          },
        };

        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Submission failed");
        }

        toast.success("Feedback submitted — thanks for helping improve Kora!");
        reset();
        setScreenshot(null);
        setOpen(false);
      } catch (err) {
        toast.error("Failed to submit feedback", {
          description: (err as Error).message,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [screenshot, walletAddress, reset]
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    reset();
    setScreenshot(null);
  }, [reset]);

  return (
    <>
      {/* ── Floating trigger button ─────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[9000] flex flex-col items-end gap-3">
        <AnimatePresence>
          {open && (
            <motion.div
              key="feedback-panel"
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-[340px] sm:w-[380px] rounded-2xl border border-border bg-background shadow-token-lg"
              role="dialog"
              aria-modal="true"
              aria-label="Feedback form"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-sm font-semibold text-foreground">Send Feedback</span>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close feedback form"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4" noValidate>
                {/* Type selector */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Type
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {FEEDBACK_TYPES.map(({ value, label, icon: Icon, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setValue("type", value)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-medium transition-all",
                          selectedType === value
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-muted"
                        )}
                        aria-pressed={selectedType === value}
                      >
                        <Icon className={cn("h-4 w-4", selectedType === value ? color : "")} aria-hidden="true" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label htmlFor="fb-title" className="mb-1.5 block text-xs font-medium text-foreground">
                    Title <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="fb-title"
                    {...register("title")}
                    placeholder="Brief summary…"
                    className={cn(
                      "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
                      errors.title ? "border-destructive" : "border-border"
                    )}
                  />
                  {errors.title && (
                    <p className="mt-1 text-xs text-destructive" role="alert">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="fb-description" className="mb-1.5 block text-xs font-medium text-foreground">
                    Description <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    id="fb-description"
                    {...register("description")}
                    rows={4}
                    placeholder="Describe the issue or idea in detail…"
                    className={cn(
                      "w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
                      errors.description ? "border-destructive" : "border-border"
                    )}
                  />
                  {errors.description && (
                    <p className="mt-1 text-xs text-destructive" role="alert">
                      {errors.description.message}
                    </p>
                  )}
                </div>

                {/* Screenshot section */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Screenshot (optional)
                  </p>
                  {screenshot ? (
                    <div className="relative rounded-lg overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshot}
                        alt="Attached screenshot preview"
                        className="w-full max-h-32 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setScreenshot(null)}
                        className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground backdrop-blur-sm"
                        aria-label="Remove screenshot"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCaptureScreen}
                        disabled={capturingScreen}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
                      >
                        {capturingScreen ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Capture screen
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      >
                        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                        Upload image
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        aria-label="Upload screenshot"
                        onChange={handleFileUpload}
                      />
                    </div>
                  )}
                </div>

                {/* Auto-captured context info */}
                <p className="text-[11px] text-muted-foreground">
                  Your current URL, browser info
                  {walletAddress ? ", and wallet address" : ""} will be included automatically.
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleClose}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    isLoading={submitting}
                  >
                    Submit
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating button */}
        <motion.button
          type="button"
          onClick={() => setOpen((v) => !v)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-token-md transition-colors hover:bg-muted",
            "sm:px-4 sm:py-2.5",
            // On mobile collapse to icon only
            "max-sm:px-3 max-sm:py-3"
          )}
          aria-label={open ? "Close feedback" : "Open feedback form"}
          aria-expanded={open}
        >
          {open ? (
            <X className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <MessageSquarePlus className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{open ? "Close" : "Feedback"}</span>
        </motion.button>
      </div>
    </>
  );
}
