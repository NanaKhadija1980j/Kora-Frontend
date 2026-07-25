"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SHORTCUT_DEFINITIONS } from "@/hooks/useKeyboardShortcuts";
import { cn } from "@/lib/utils";

interface ShortcutReferenceModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = ["Navigation", "Marketplace", "Dashboard"] as const;

function groupShortcuts() {
  const groups: Record<string, Array<{ key: string; label: string; description: string }>> = {};
  for (const [key, def] of Object.entries(SHORTCUT_DEFINITIONS)) {
    if (!groups[def.category]) groups[def.category] = [];
    groups[def.category].push({ key, label: def.label, description: def.description });
  }
  return groups;
}

const GROUPED = groupShortcuts();

function KbdBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function ShortcutReferenceModal({ open, onClose }: ShortcutReferenceModalProps) {
  const t = useTranslations("shortcuts");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) { e.preventDefault(); panel.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); previouslyFocused?.focus(); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="shortcut-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9100] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            key="shortcut-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyboard-shortcuts-title"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-[9200] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-token-lg"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 id="keyboard-shortcuts-title" className="text-base font-semibold text-foreground">
                  {t("title")}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t("closeLabel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              {CATEGORIES.map((category) => {
                const items = GROUPED[category];
                if (!items?.length) return null;
                return (
                  <section key={category} aria-labelledby={`shortcut-cat-${category}`}>
                    <h3
                      id={`shortcut-cat-${category}`}
                      className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                    >
                      {category}
                    </h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      {items.map((item, idx) => (
                        <div
                          key={item.key}
                          className={cn(
                            "flex items-center justify-between px-4 py-2.5 text-sm",
                            idx !== items.length - 1 && "border-b border-border",
                          )}
                        >
                          <span className="text-foreground">{item.description}</span>
                          <KbdBadge>{item.label}</KbdBadge>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Press <KbdBadge>{t("hintKey")}</KbdBadge> anytime to open this reference. Shortcuts can be disabled in{" "}
              <span className="text-foreground">{t("hintSettings")}</span>.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
