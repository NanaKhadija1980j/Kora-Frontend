"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Search, User, X, ChevronDown, Star } from "lucide-react";
import { useWalletStore } from "@/store";
import { truncateAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";

type AddressBookEntry = {
  id: string;
  address: string;
  label: string;
  groupIds: string[];
  isFavorite: boolean;
};

type Props = {
  /** Called when a contact is selected. The caller can then fill in the address field. */
  onSelect: (entry: AddressBookEntry) => void;
  /** Optional placeholder text for the search input */
  placeholder?: string;
  /** Optional CSS class */
  className?: string;
  /** Optional button label */
  buttonLabel?: string;
  /** HTML input name attribute */
  name?: string;
  /** Optional group ID to filter by */
  filterGroupId?: string;
};

export function AddressBookPicker({
  onSelect,
  placeholder,
  className,
  buttonLabel,
  name,
  filterGroupId,
}: Props) {
  const t = useTranslations("addressBook");
  const addressBook = useWalletStore((s) => s.addressBook);
  const addressBookGroups = useWalletStore((s) => s.addressBookGroups);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(filterGroupId ?? null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = addressBook.filter((e) => {
    if (activeGroupFilter && !e.groupIds.includes(activeGroupFilter)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.address.toLowerCase().includes(q) ||
      e.label.toLowerCase().includes(q)
    );
  });

  // Sort: favorites first
  const sorted = [...filtered].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return 0;
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleSelect = useCallback(
    (entry: AddressBookEntry) => {
      onSelect(entry);
      setOpen(false);
      setSearch("");
      setHighlightIndex(-1);
    },
    [onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
        return;
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < sorted.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : sorted.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < sorted.length) {
          handleSelect(sorted[highlightIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[highlightIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  if (addressBook.length === 0) return null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("pickFromAddressBook")}
      >
        <User className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{buttonLabel ?? t("pickFromAddressBook")}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-border bg-popover shadow-2xl">
          {/* Search input */}
          <div className="flex items-center border-b border-border px-3 py-2">
            <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <label htmlFor={`ab-picker-search-${name ?? "default"}`} className="sr-only">
              {t("searchPlaceholder")}
            </label>
            <input
              ref={inputRef}
              id={`ab-picker-search-${name ?? "default"}`}
              type="text"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={placeholder ?? t("searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={t("clearSearch")}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Group filter tabs */}
          {addressBookGroups.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-1.5">
              <button
                type="button"
                onClick={() => setActiveGroupFilter(null)}
                className={cn(
                  "shrink-0 rounded px-2 py-0.5 text-xs transition-colors",
                  activeGroupFilter === null
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t("all")}
              </button>
              {addressBookGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveGroupFilter(activeGroupFilter === group.id ? null : group.id)}
                  className={cn(
                    "shrink-0 rounded px-2 py-0.5 text-xs transition-colors",
                    activeGroupFilter === group.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}

          {/* List */}
          <ul
            ref={listRef}
            role="listbox"
            aria-label={t("savedContacts")}
            className="max-h-48 overflow-y-auto py-1"
          >
            {sorted.length === 0 ? (
              <li className="px-3 py-3 text-center text-sm text-muted-foreground">
                {search ? t("noSearchResults") : t("noSaved")}
              </li>
            ) : (
              sorted.map((entry, index) => (
                <li
                  key={entry.id}
                  role="option"
                  aria-selected={index === highlightIndex}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                    index === highlightIndex
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-muted/60",
                  )}
                  onClick={() => handleSelect(entry)}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      {entry.isFavorite && (
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" aria-hidden="true" />
                      )}
                      <span className="truncate font-medium">
                        {entry.label || truncateAddress(entry.address, 6)}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {truncateAddress(entry.address, 8)}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
