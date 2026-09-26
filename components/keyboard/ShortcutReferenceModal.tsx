"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { SHORTCUT_DEFINITIONS } from "@/hooks/useKeyboardShortcuts";
import { COMMAND_PALETTE_SHORTCUTS } from "@/hooks/useCommandPalette";
import { cn } from "@/lib/utils";

interface ShortcutReferenceModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = ["Navigation", "Command Palette", "Marketplace", "Dashboard"] as const;

function groupShortcuts() {
  const groups: Record<string, Array<{ key: string; label: string; description: string }>> = {};
  for (const [key, def] of Object.entries(SHORTCUT_DEFINITIONS)) {
    if (!groups[def.category]) groups[def.category] = [];
    groups[def.category].push({ key, label: def.label, description: def.description });
  }
  // Inject palette-specific shortcuts as a synthetic group so the modal shows
  // them without requiring them to live in SHORTCUT_DEFINITIONS.
  groups["Command Palette"] = [
    ...(groups["Command Palette"] ?? []),
    ...COMMAND_PALETTE_SHORTCUTS
      .filter((s) => !groups["Command Palette"]?.some((g) => g.label === s.label))
      .map((s) => ({ key: `palette-${s.label}`, label: s.label, description: s.description })),
  ];
  return groups;
}

const GROUPED = groupShortcuts();

function detectMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/**
 * `"⌘K / Ctrl+K"` renders as `⌘K` on Apple platforms and `Ctrl+K` everywhere else.
 *
 * Only labels shaped as an Apple/non-Apple pair are split — labels that merely contain a slash,
 * such as `"← → / ↑ ↓"`, are left alone.
 */
export function platformLabel(label: string, isMac: boolean): string {
  const variants = label.split("/").map((part) => part.trim());
  if (variants.length !== 2) return label;
  const [apple, other] = variants;
  const isPlatformPair = /[⌘⌥⌃⇧]/.test(apple) && /ctrl|alt|win/i.test(other);
  if (!isPlatformPair) return label;
  return isMac ? apple : other;
}

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
  const [query, setQuery] = useState("");
  // Resolved after mount so server and client markup match.
  const [isMac, setIsMac] = useState(false);

  useEffect(() => setIsMac(detectMac()), []);

  // Start each visit with the full list.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CATEGORIES.map((category) => {
      const items = (GROUPED[category] ?? [])
        .map((item) => ({ ...item, label: platformLabel(item.label, isMac) }))
        .filter(
          (item) =>
            !needle ||
            item.description.toLowerCase().includes(needle) ||
            item.label.toLowerCase().includes(needle),
        );
      return { category, items };
    }).filter((group) => group.items.length > 0);
  }, [query, isMac]);

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

            <div className="relative mb-5">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchAriaLabel")}
                className="w-full rounded-xl border border-border bg-muted/40 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-5" aria-live="polite">
              {groups.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No shortcuts match &ldquo;{query.trim()}&rdquo;.
                </p>
              )}
              {groups.map(({ category, items }) => (
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
              ))}
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
