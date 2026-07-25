"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  Search,
  Store,
  LayoutDashboard,
  BarChart3,
  PlusCircle,
  History,
  Wallet,
  FileText,
  Clock,
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { useDebounce } from "@/hooks/useDebounce";
import { useInvoices } from "@/hooks/useInvoices";
import { useWallet } from "@/hooks/useWallet";
import { useUIStore } from "@/store/uiStore";
import { formatCurrency } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

// ─── Highlight matching characters ───────────────────────────────────────────

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase().trim();
  const idx = lower.indexOf(q);
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded-sm px-0.5 not-italic font-medium">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </span>
  );
}

// ─── Page commands ────────────────────────────────────────────────────────────

const PAGE_COMMANDS = [
  { id: "page-marketplace", label: "Marketplace", href: "/marketplace", icon: Store },
  { id: "page-invest", label: "Investor Dashboard", href: "/dashboard/investor", icon: BarChart3 },
  { id: "page-sme", label: "My Invoices", href: "/dashboard/sme", icon: LayoutDashboard },
  { id: "page-create", label: "Create Invoice", href: "/invoice/create", icon: PlusCircle },
  { id: "page-transactions", label: "Transaction History", href: "/transactions", icon: History },
  { id: "page-analytics", label: "Analytics", href: "/analytics", icon: BarChart3 },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter();
  const { open, setOpen, getRecent, pushRecent } = useCommandPalette();
  const { isConnected } = useWallet();
  const setWalletModalOpen = useUIStore((s) => s.setWalletModalOpen);
  const [query, setQuery] = React.useState("");

  // Fetch invoices for search (only when palette is open)
  const { data: invoiceData } = useInvoices();
  const invoices = React.useMemo(() => invoiceData?.data ?? [], [invoiceData?.data]);

  // Reset query on close
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const recent = React.useMemo(() => getRecent(), [open, getRecent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce the search query before filtering so fast typing doesn't
  // re-filter the (potentially large) invoice list on every keystroke.
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  // Filter invoices by debtor name, invoice number, on-chain token ID, or face value.
  const filteredInvoices = React.useMemo(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) return [];
    const q = trimmed.toLowerCase();
    return invoices
      .filter(
        (inv) =>
          inv.metadata.invoiceNumber.toLowerCase().includes(q) ||
          inv.metadata.debtorName.toLowerCase().includes(q) ||
          inv.tokenId.toLowerCase().includes(q) ||
          String(inv.metadata.amount).includes(q)
      )
      .slice(0, 6);
  }, [invoices, debouncedQuery]);

  function navigate(href: string, label: string, type: "page" | "invoice") {
    pushRecent({ id: href, label, href, type });
    setOpen(false);
    router.push(href);
  }

  function runAction(action: () => void) {
    setOpen(false);
    action();
  }

  const showEmpty = !query.trim();

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Palette */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className={cn(
            "fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-4 duration-150"
          )}
        >
          <Command
            className={cn(
              "rounded-2xl border border-border bg-card shadow-token-lg overflow-hidden",
              "flex flex-col"
            )}
            shouldFilter={false}
            loop
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Search pages, invoices, actions…"
                className={cn(
                  "flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground",
                  "outline-none border-none focus:ring-0"
                )}
                aria-label="Command palette search"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <Command.List
              className="max-h-[400px] overflow-y-auto overscroll-contain p-2"
              aria-label="Command results"
            >
              <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </Command.Empty>

              {/* Recent — shown when query is empty */}
              {showEmpty && recent.length > 0 && (
                <Command.Group
                  heading={
                    <GroupHeading icon={<Clock className="h-3 w-3" />} label="Recent" />
                  }
                >
                  {recent.map((item) => (
                    <PaletteItem
                      key={item.id}
                      icon={item.type === "invoice" ? <FileText className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                      label={item.label}
                      query=""
                      onSelect={() => navigate(item.href, item.label, item.type)}
                    />
                  ))}
                </Command.Group>
              )}

              {/* Pages */}
              {(showEmpty || PAGE_COMMANDS.some((p) => p.label.toLowerCase().includes(query.toLowerCase()))) && (
                <Command.Group
                  heading={
                    <GroupHeading icon={<Store className="h-3 w-3" />} label="Pages" />
                  }
                >
                  {PAGE_COMMANDS.filter(
                    (p) => showEmpty || p.label.toLowerCase().includes(query.toLowerCase())
                  ).map((page) => (
                    <PaletteItem
                      key={page.id}
                      icon={<page.icon className="h-4 w-4" />}
                      label={page.label}
                      query={query}
                      onSelect={() => navigate(page.href, page.label, "page")}
                    />
                  ))}
                </Command.Group>
              )}

              {/* Invoices — only when searching */}
              {!showEmpty && filteredInvoices.length > 0 && (
                <Command.Group
                  heading={
                    <GroupHeading icon={<FileText className="h-3 w-3" />} label="Invoices" />
                  }
                >
                  {filteredInvoices.map((inv) => (
                    <PaletteItem
                      key={inv.id}
                      icon={<FileText className="h-4 w-4" />}
                      label={inv.metadata.invoiceNumber}
                      sublabel={`${inv.metadata.debtorName} · ${formatCurrency(inv.metadata.amount, inv.metadata.currency, true)} · ${Math.round(inv.funding.fundingProgress * 100)}% funded`}
                      query={query}
                      badge={inv.status}
                      onSelect={() =>
                        navigate(`/marketplace/${inv.id}`, inv.metadata.invoiceNumber, "invoice")
                      }
                    />
                  ))}
                </Command.Group>
              )}

              {/* Actions */}
              {(showEmpty ||
                ["connect wallet", "create invoice", "disconnect"].some((a) =>
                  a.includes(query.toLowerCase())
                )) && (
                <Command.Group
                  heading={
                    <GroupHeading icon={<Zap className="h-3 w-3" />} label="Actions" />
                  }
                >
                  {!isConnected && (
                    <PaletteItem
                      icon={<Wallet className="h-4 w-4" />}
                      label="Connect Wallet"
                      query={query}
                      onSelect={() => runAction(() => setWalletModalOpen(true))}
                    />
                  )}
                  <PaletteItem
                    icon={<PlusCircle className="h-4 w-4" />}
                    label="Create Invoice"
                    query={query}
                    onSelect={() => navigate("/invoice/create", "Create Invoice", "page")}
                  />
                </Command.Group>
              )}
            </Command.List>

            {/* Footer hint */}
            <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">ESC</kbd>
                close
              </span>
            </div>
          </Command>
        </div>
      )}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GroupHeading({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

interface PaletteItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  query: string;
  badge?: string;
  onSelect: () => void;
}

function PaletteItem({ icon, label, sublabel, query, badge, onSelect }: PaletteItemProps) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
        "text-foreground outline-none transition-colors",
        "data-[selected=true]:bg-muted data-[selected=true]:text-foreground",
        "hover:bg-muted"
      )}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">
          <HighlightMatch text={label} query={query} />
        </span>
        {sublabel && (
          <span className="truncate text-xs text-muted-foreground">{sublabel}</span>
        )}
      </span>
      {badge && (
        <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
          {badge.replace(/_/g, " ")}
        </span>
      )}
    </Command.Item>
  );
}
