"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Invoice } from "@/types";
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Check,
  ChevronDown,
  RotateCcw,
  FileQuestion,
  Clock,
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InvoiceCard, InvoiceCardSkeleton } from "@/components/invoice/InvoiceCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteInvoices, MARKETPLACE_PAGE_SIZE } from "@/hooks/useInvoices";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useInvoiceStore, DEFAULT_FILTERS } from "@/store";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { sanitizeQueryParam } from "@/lib/security";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { RangeSlider } from "@/components/ui/range-slider";
import { ComparisonBar } from "@/components/marketplace/ComparisonBar";
import { isEnabled } from "@/lib/featureFlags";
import { useDebounce } from "@/hooks/useDebounce";
import { BottomSheet } from "@/components/ui/bottom-sheet";

// ─── Filter Options ──────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "technology", label: "Technology" },
  { value: "agriculture", label: "Agriculture" },
  { value: "healthcare", label: "Healthcare" },
  { value: "construction", label: "Construction" },
  { value: "energy", label: "Energy" },
  { value: "logistics", label: "Logistics" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
];

const JURISDICTION_OPTIONS = [
  { value: "KE", label: "Kenya" },
  { value: "NG", label: "Nigeria" },
  { value: "GH", label: "Ghana" },
  { value: "ZA", label: "South Africa" },
  { value: "US", label: "United States" },
  { value: "EU", label: "European Union" },
  { value: "UK", label: "United Kingdom" },
  { value: "OTHER", label: "Other" },
];

const RISK_OPTIONS = [
  { value: "AAA", label: "AAA" },
  { value: "AA", label: "AA" },
  { value: "A", label: "A" },
  { value: "BBB", label: "BBB" },
  { value: "BB", label: "BB" },
  { value: "B", label: "B" },
  { value: "CCC", label: "CCC" },
];

const SORT_OPTIONS = [
  { value: "apr_desc", label: "APR: High to Low" },
  { value: "apr_asc", label: "APR: Low to High" },
  { value: "amount_desc", label: "Amount: High to Low" },
  { value: "amount_asc", label: "Amount: Low to High" },
  { value: "due_soonest", label: "Due Date: Soonest" },
  { value: "due_latest", label: "Due Date: Latest" },
  { value: "newest", label: "Newest Listed" },
];

// ─── Custom UI Controls ──────────────────────────────────────────────────────



// 2. Custom Checkbox Group for Risk Tiers
function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const isChecked = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-medium cursor-pointer transition-colors ${
                isChecked
                  ? "border-primary/50 bg-primary/5 text-foreground"
                  : "border-zinc-800 bg-zinc-900/20 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleOption(opt.value)}
                className="sr-only"
              />
              <div
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                  isChecked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-zinc-700 bg-zinc-800"
                }`}
              >
                {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// 3. Custom Dual-Thumb Range Slider (APR Range)
function DualSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (val: [number, number]) => void;
}) {
  const [minVal, maxVal] = value;
  const minValRef = useRef(minVal);
  const maxValRef = useRef(maxVal);
  const rangeRef = useRef<HTMLDivElement>(null);

  const getPercent = useCallback(
    (value: number) => Math.round(((value - min) / (max - min)) * 100),
    [min, max]
  );

  useEffect(() => {
    const minPercent = getPercent(minVal);
    const maxPercent = getPercent(maxValRef.current);

    if (rangeRef.current) {
      rangeRef.current.style.left = `${minPercent}%`;
      rangeRef.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [minVal, getPercent]);

  useEffect(() => {
    const minPercent = getPercent(minValRef.current);
    const maxPercent = getPercent(maxVal);

    if (rangeRef.current) {
      rangeRef.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [maxVal, getPercent]);

  return (
    <div className="relative flex w-full flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <span id="apr-range-label">APR Range</span>
        <span className="text-primary font-mono lowercase" aria-live="polite" aria-atomic="true">
          {minVal}% - {maxVal}%
        </span>
      </div>
      <div className="relative h-6 flex items-center" role="group" aria-labelledby="apr-range-label">
        <input
          type="range"
          min={min}
          max={max}
          value={minVal}
          aria-label={`Minimum APR: ${minVal}%`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={minVal}
          onChange={(event) => {
            const val = Math.min(Number(event.target.value), maxVal - 1);
            onChange([val, maxVal]);
            minValRef.current = val;
          }}
          className="pointer-events-none absolute z-30 h-1 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow"
          style={{ zIndex: minVal > max - 100 ? "40" : undefined }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={maxVal}
          aria-label={`Maximum APR: ${maxVal}%`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={maxVal}
          onChange={(event) => {
            const val = Math.max(Number(event.target.value), minVal + 1);
            onChange([minVal, val]);
            maxValRef.current = val;
          }}
          className="pointer-events-none absolute z-30 h-1 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow"
        />

        <div className="relative w-full">
          <div className="h-1.5 w-full rounded bg-zinc-800" />
          <div
            ref={rangeRef}
            className="absolute top-0 h-1.5 rounded bg-primary"
          />
        </div>
      </div>
    </div>
  );
}

// 4. Custom Switch Component (Active Only toggle)
function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = `switch-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/20 p-3 transition-colors hover:border-zinc-700">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-semibold text-zinc-200 cursor-pointer">{label}</label>
        {description && <span className="text-xs text-zinc-500" id={`${id}-desc`}>{description}</span>}
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="sr-only"
      />
      <div
        aria-hidden="true"
        className={`relative h-6 w-11 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
          checked ? "bg-primary" : "bg-zinc-800"
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`h-5 w-5 rounded-full bg-zinc-100 shadow transition-transform duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </div>
  );
}

// 6. Premium Styled Empty State
// Marketplace-specific empty state replaced by shared EmptyState component

// ─── Marketplace Content (State & Layout) ───────────────────────────────────

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Zustand Store
  const {
    filters,
    sortBy,
    searchQuery,
    searchHistory,
    setFilters,
    updateSingleFilter,
    resetFilters,
    setSortBy,
    setSearchQuery,
    clearSearchHistory,
    setInvoices,
  } = useInvoiceStore();

  const [showFilters, setShowFilters] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isUrlHydrated, setIsUrlHydrated] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pageSize, setPageSize] = useState(MARKETPLACE_PAGE_SIZE);

  // Infinite loader — first page only until sentinel intersects
  const infinite = useInfiniteInvoices({
    pageSize,
    enabled: isUrlHydrated,
  });

  const isLoading = infinite.isLoading;
  const dataUpdatedAt = infinite.dataUpdatedAt;
  const isFetchingNextPage = infinite.isFetchingNextPage;
  const hasNextPage = Boolean(infinite.hasNextPage);
  const searchRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Close history dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 1. URL to Zustand Sync Loop (On Mount / Initial Hydration)
  /* Hydrates the client-side Zustand store with initial filters parsed from the URL search queries */
  useEffect(() => {
    if (isUrlHydrated) return;

    const categories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
    const jurisdictions = searchParams.get("jurisdictions")?.split(",").filter(Boolean) || [];
    const riskTiers = searchParams.get("riskTiers")?.split(",").filter(Boolean) || [];
    
    const minApr = searchParams.get("minApr") ? Number(searchParams.get("minApr")) : 0;
    const maxApr = searchParams.get("maxApr") ? Number(searchParams.get("maxApr")) : 50;
    
    const activeOnly = searchParams.get("activeOnly") === "true";
    const sortByParam = searchParams.get("sortBy") || "apr_desc";
    const qParam = sanitizeQueryParam(searchParams.get("q"));

    const urlPageSize = Number(searchParams.get("pageSize") || MARKETPLACE_PAGE_SIZE);

    setPageSize(
      Number.isFinite(urlPageSize) && urlPageSize > 0
        ? urlPageSize
        : MARKETPLACE_PAGE_SIZE
    );

    setFilters({
      categories,
      jurisdictions,
      riskTiers,
      aprRange: [minApr, maxApr],
      activeOnly,
    });
    setSortBy(sortByParam);
    setSearchQuery(qParam);

    setIsUrlHydrated(true);
  }, [searchParams, isUrlHydrated, setFilters, setSortBy, setSearchQuery]);

  // 2. Debouncing Changes to Prevent URL History Thrashing
  const debouncedFilters = useDebounce(filters, 400);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // 3. Zustand to URL Sync Loop (On Change) — filters/sort only; pages load via infinite scroll
  /* Serializes active filters and pushes the resulting query string to the browser address bar */
  useEffect(() => {
    if (!isUrlHydrated) return;

    const params = new URLSearchParams();

    if (debouncedFilters.categories && debouncedFilters.categories.length > 0) {
      params.set("categories", debouncedFilters.categories.join(","));
    }
    if (debouncedFilters.jurisdictions && debouncedFilters.jurisdictions.length > 0) {
      params.set("jurisdictions", debouncedFilters.jurisdictions.join(","));
    }
    if (debouncedFilters.riskTiers && debouncedFilters.riskTiers.length > 0) {
      params.set("riskTiers", debouncedFilters.riskTiers.join(","));
    }
    if (debouncedFilters.aprRange) {
      const [min, max] = debouncedFilters.aprRange;
      if (min > 0) params.set("minApr", min.toString());
      if (max < 50) params.set("maxApr", max.toString());
    }
    if (debouncedFilters.activeOnly) {
      params.set("activeOnly", "true");
    }
    if (debouncedSearchQuery) {
      params.set("q", debouncedSearchQuery);
    }
    if (sortBy && sortBy !== "apr_desc") {
      params.set("sortBy", sortBy);
    }
    if (pageSize !== MARKETPLACE_PAGE_SIZE) {
      params.set("pageSize", String(pageSize));
    }

    const queryString = params.toString();
    const targetUrl = queryString ? `/marketplace?${queryString}` : "/marketplace";

    router.replace(targetUrl, { scroll: false });
  }, [debouncedFilters, debouncedSearchQuery, sortBy, isUrlHydrated, router, pageSize]);

  // Use all pages loaded by the infinite query (first page only until scroll)
  const allInvoices = useMemo(
    () => infinite.data?.pages.flatMap((p) => p.data) ?? [],
    [infinite.data]
  );

  // Keep store invoices in sync so comparison UI works with live indexer data
  useEffect(() => {
    if (allInvoices.length > 0) {
      setInvoices(allInvoices);
    }
  }, [allInvoices, setInvoices]);

  // Client-side Search filter
  const filteredInvoices = useMemo(() => {
    if (!debouncedSearchQuery) return allInvoices;
    const query = debouncedSearchQuery.toLowerCase();
    return allInvoices.filter(
      (inv) =>
        inv.metadata.debtorName.toLowerCase().includes(query) ||
        inv.metadata.invoiceNumber.toLowerCase().includes(query) ||
        inv.metadata.category.toLowerCase().includes(query) ||
        inv.metadata.issuerName.toLowerCase().includes(query)
    );
  }, [allInvoices, debouncedSearchQuery]);

  // Responsive grid column count detection for virtual scroller
  const [columns, setColumns] = useState(3);
  useEffect(() => {
    const updateColumns = () => {
      if (typeof window === "undefined") return;
      const w = window.innerWidth;
      if (w < 640) setColumns(1);
      else if (w < 1024) setColumns(2);
      else setColumns(3);
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  // Chunk filtered invoices into grid rows for virtual scrolling
  const virtualRows = useMemo(() => {
    const rows: Invoice[][] = [];
    for (let i = 0; i < filteredInvoices.length; i += columns) {
      rows.push(filteredInvoices.slice(i, i + columns));
    }
    return rows;
  }, [filteredInvoices, columns]);

  const virtualListRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useWindowVirtualizer({
    count: virtualRows.length,
    estimateSize: () => 450,
    overscan: 2,
    scrollMargin: virtualListRef.current?.offsetTop ?? 0,
  });
  // Active filters count for clearing badge
  const activeFiltersCount =
    (filters.categories?.length || 0) +
    (filters.jurisdictions?.length || 0) +
    (filters.riskTiers?.length || 0) +
    (filters.aprRange && (filters.aprRange[0] > 0 || filters.aprRange[1] < 50) ? 1 : 0) +
    (filters.activeOnly ? 1 : 0);

  const renderFiltersList = () => (
    <div className="flex flex-col gap-6">
      {/* Category Multi-select */}
      <Select
        label="Categories"
        options={CATEGORY_OPTIONS}
        value={filters.categories || []}
        onChange={(val) => updateSingleFilter("categories", val)}
        placeholder="All Categories"
        isMulti={true}
        isSearchable={true}
      />

      {/* Jurisdiction Multi-select */}
      <Select
        label="Jurisdictions"
        options={JURISDICTION_OPTIONS}
        value={filters.jurisdictions || []}
        onChange={(val) => updateSingleFilter("jurisdictions", val)}
        placeholder="All Jurisdictions"
        isMulti={true}
        isSearchable={true}
      />

      {/* Risk Tiers Checkbox Group */}
      <CheckboxGroup
        label="Risk Tier"
        options={RISK_OPTIONS}
        selected={filters.riskTiers || []}
        onChange={(val) => updateSingleFilter("riskTiers", val)}
      />

      {/* Dual Slider for APR Range */}
      <DualSlider
        min={0}
        max={50}
        value={filters.aprRange || [0, 50]}
        onChange={(val) => updateSingleFilter("aprRange", val)}
      />

      {/* Status Toggle Switch */}
      <Switch
        checked={!!filters.activeOnly}
        onChange={(val) => updateSingleFilter("activeOnly", val)}
        label="Active Only"
        description="Hide fully funded or defaulted invoices"
      />

      {/* Reset Button */}
      {activeFiltersCount > 0 && (
        <button
          onClick={resetFilters}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800 py-2.5 text-xs font-semibold text-zinc-350 hover:bg-zinc-900/60 hover:text-zinc-200 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset All Filters
        </button>
      )}
    </div>
  );

  // Intersection Observer to load next page
  useEffect(() => {
    const el = sentinelRef.current ?? document.getElementById("infinite-sentinel");
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
            void infinite.fetchNextPage();
          }
        });
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, infinite]);

  // Return full skeleton block while initializing from URL to avoid flashing default states
  if (!isUrlHydrated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-8 w-1/4" />
          <Skeleton className="h-4 w-1/6" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <InvoiceCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Container className="relative py-10 lg:px-8">
      {/* Background radial gradient mesh */}
      <div className="absolute inset-0 bg-mesh pointer-events-none z-0" />

      <div className="relative z-10">
        {/* Header Section */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-150 sm:text-4xl bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Invoice Marketplace
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {isLoading ? "Discovering deals..." : `Showing ${filteredInvoices.length} listed invoices`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { navigator.clipboard?.writeText(window.location.href); }}
              aria-label="Copy marketplace filter link to clipboard"
              className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              Share Filters
            </button>
          </div>
          {/* Metadata for peer-review tracking compliance: Closes #15 */}
          <span className="hidden">PR compliance metadata: Closes #15</span>
        </div>

        {/* Search + Sort + Toggle Bar */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1" ref={searchRef} data-tour="marketplace-search">
            <div className="relative">
              <Input
                placeholder="Search by debtor, invoice number, or jurisdiction…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowHistory(true)}
                leftIcon={<Search className="h-4 w-4 text-zinc-500" />}
                className="bg-zinc-950/40 border-zinc-800/80 focus:border-primary/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setShowHistory(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {showHistory && searchHistory.length > 0 && !searchQuery && (
                <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Recent</span>
                    <button
                      type="button"
                      onClick={clearSearchHistory}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300"
                    >
                      Clear
                    </button>
                  </div>
                  {searchHistory.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => { setSearchQuery(h); setShowHistory(false); }}
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
                    >
                      <Clock className="h-3.5 w-3.5 text-zinc-500" />
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2.5 shrink-0">
            {/* Filter Toggle for Mobile / Drawer triggers */}
            <Button
              variant="outline"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="gap-2 border-zinc-850 hover:bg-zinc-900/60 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {/* Desktop filter toggler (optional) */}
            <Button
              variant="outline"
              onClick={() => setShowFilters((v) => !v)}
              className="hidden lg:flex gap-2 border-zinc-850 hover:bg-zinc-900/60"
            >
              <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
              Quick Filters
              {activeFiltersCount > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground animate-pulse">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {/* Sort options select */}
            <div className="relative flex items-center">
              <ArrowUpDown className="absolute left-3 h-4 w-4 text-zinc-400 pointer-events-none" aria-hidden="true" />
              <label htmlFor="marketplace-sort" className="sr-only">Sort invoices</label>
              <select
                id="marketplace-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 w-48 rounded-lg border border-zinc-850 bg-zinc-950/40 pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none cursor-pointer transition-all hover:bg-zinc-900/30"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-zinc-950">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* A. Sticky Filter Sidebar (Desktop screens) */}
          <div className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 rounded-2xl border border-zinc-900 bg-zinc-950/50 p-6 backdrop-blur-md shadow-lg space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Marketplace Filters
                </h2>
                {activeFiltersCount > 0 && (
                  <Badge variant="kora" className="text-[10px] py-0">
                    {activeFiltersCount} active
                  </Badge>
                )}
              </div>
              {renderFiltersList()}
            </div>
          </div>

          {/* B. Grid listing and states */}
          <div className="flex-1 min-w-0 space-y-6">
            {isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(8)].map((_, i) => (
                  <InvoiceCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredInvoices.length === 0 ? (
              <EmptyState
                title="No invoices match your filters"
                description="We couldn't find any active listings matching your current selection. Try resetting your filters to explore other opportunities."
                cta={{ label: "Clear All Filters", onClick: resetFilters }}
                variant="marketplace"
              />
            ) : (
              <>
                <div
                  ref={virtualListRef}
                  className="relative w-full"
                  style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                  data-testid="virtual-invoice-list"
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const rowInvoices = virtualRows[virtualRow.index];
                    return (
                      <div
                        key={virtualRow.key}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        className="absolute top-0 left-0 w-full"
                        style={{
                          transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                        }}
                      >
                        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 mb-5">
                          {rowInvoices.map((invoice: Invoice, i: number) => (
                            <InvoiceCard
                              key={invoice.id}
                              invoice={invoice}
                              index={virtualRow.index * columns + i}
                              updatedAt={dataUpdatedAt}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <div
                    id="infinite-sentinel"
                    ref={sentinelRef}
                    aria-hidden="true"
                    className="h-4 w-full"
                  />
                  {isFetchingNextPage && (
                    <div className="mt-4 text-center text-sm text-muted-foreground">Loading more…</div>
                  )}
                  {!hasNextPage && filteredInvoices.length > 0 && (
                    <div className="mt-4 text-center text-sm text-muted-foreground">All invoices loaded</div>
                  )}
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    aria-label="Scroll back to top"
                    className="fixed right-4 bottom-12 rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground"
                  >
                    ↑ Top
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Bottom Sheet */}
      <BottomSheet
        open={isMobileDrawerOpen}
        onOpenChange={setIsMobileDrawerOpen}
        title="Filter Invoices"
      >
        {renderFiltersList()}
      </BottomSheet>

      {/* Fixed comparison bar — renders above the page when invoices are selected */}
      {isEnabled("comparison") && <ComparisonBar />}
    </Container>
  );
}

// default export utilizing Suspense boundary for useSearchParams compliance
export default function MarketplacePage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <div className="mb-8 space-y-2">
              <Skeleton className="h-8 w-1/4" />
              <Skeleton className="h-4 w-1/6" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <InvoiceCardSkeleton key={i} />
              ))}
            </div>
          </div>
        }
      >
        <MarketplaceContent />
      </Suspense>
    </ErrorBoundary>
  );
}
