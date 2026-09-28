"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import type { ColumnDef, DataTableProps, TableSortDirection } from "@/types/table";
import { Pagination } from "./pagination";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

function getSortValue<T>(row: T, column: ColumnDef<T>): string | number {
  if (column.accessor) {
    if (typeof column.accessor === "function") {
      return column.accessor(row);
    }
    const value = row[column.accessor as keyof T];
    if (typeof value === "string" || typeof value === "number") return value;
    return String(value ?? "");
  }
  return "";
}

function compareValues(a: string | number, b: string | number, direction: TableSortDirection) {
  if (direction === null) return 0;
  const multiplier = direction === "asc" ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * multiplier;
  }
  return String(a).localeCompare(String(b)) * multiplier;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading = false,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 20],
  enableSelection = false,
  bulkActions,
  onSelectionChange,
  emptyState,
  getRowId = (row) => row.id,
  onRowClick,
  className,
  syncToUrl = false,
  pageParamName = "page",
  sortParamName = "sort",
  pageSizeParamName = "pageSize",
}: DataTableProps<T>) {
  const t = useTranslations("dataTable");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<TableSortDirection>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { width } = useBreakpoint();
  const isMobileView = width < 640;

  // Sync state from URL parameters on mount and searchParams changes
  useEffect(() => {
    if (!syncToUrl) return;

    const urlPage = searchParams.get(pageParamName);
    const urlPageSize = searchParams.get(pageSizeParamName);
    const urlSort = searchParams.get(sortParamName);

    if (urlPage) {
      const parsedPage = parseInt(urlPage, 10);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        setPage(parsedPage - 1);
      }
    }
    if (urlPageSize) {
      const parsedSize = parseInt(urlPageSize, 10);
      if (!isNaN(parsedSize) && parsedSize > 0) {
        setPageSize(parsedSize);
      }
    }
    if (urlSort) {
      const parts = urlSort.split(":");
      if (parts.length === 2 && (parts[1] === "asc" || parts[1] === "desc")) {
        const columnExists = columns.some((c) => c.id === parts[0]);
        if (columnExists) {
          setSortColumn(parts[0]);
          setSortDirection(parts[1] as TableSortDirection);
        }
      }
    }
  }, [searchParams, syncToUrl, pageParamName, pageSizeParamName, sortParamName, columns]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;
    const column = columns.find((c) => c.id === sortColumn);
    if (!column) return data;
    return [...data].sort((a, b) =>
      compareValues(getSortValue(a, column), getSortValue(b, column), sortDirection)
    );
  }, [data, columns, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = sortedData.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const toggleSort = (columnId: string) => {
    let nextColumn: string | null = columnId;
    let nextDirection: TableSortDirection = "asc";

    if (sortColumn !== columnId) {
      nextColumn = columnId;
      nextDirection = "asc";
    } else if (sortDirection === "asc") {
      nextColumn = columnId;
      nextDirection = "desc";
    } else {
      nextColumn = null;
      nextDirection = null;
    }

    setSortColumn(nextColumn);
    setSortDirection(nextDirection);

    if (syncToUrl) {
      const params = new URLSearchParams(searchParams.toString());
      if (nextColumn && nextDirection) {
        params.set(sortParamName, `${nextColumn}:${nextDirection}`);
      } else {
        params.delete(sortParamName);
      }
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange?.(Array.from(next));
      return next;
    });
  };

  const toggleAll = () => {
    const pageIds = pageData.map(getRowId);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
  };

  const getRowProps = (row: T) => {
    if (!onRowClick) return {};
    return {
      role: "row",
      tabIndex: 0,
      "aria-label": t("openDetailsAria", { id: getRowId(row) }),
      className: "cursor-pointer",
      onClick: () => onRowClick(row),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick(row);
        }
      },
    } as const;
  };

  const renderCellValue = (row: T, column: ColumnDef<T>) => {
    if (column.cell) return column.cell(row);
    if (column.accessor) {
      if (typeof column.accessor === "function") {
        return column.accessor(row);
      }
      return String(row[column.accessor as keyof T] ?? "");
    }
    return null;
  };

  const SortIcon = ({ columnId }: { columnId: string }) => {
    if (sortColumn !== columnId || !sortDirection) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary" aria-hidden />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary" aria-hidden />
    );
  };

  if (!isLoading && data.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center",
          className
        )}
      >
        {emptyState?.illustration}
        {emptyState?.title && (
          <p className="mt-4 text-base font-semibold text-foreground">{emptyState.title}</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {emptyState?.message ?? t("noData")}
        </p>
        {emptyState?.action && <div className="mt-4">{emptyState.action}</div>}
      </div>
    );
  }

  const skeletonRowCount = Math.min(pageSize, 5);

  if (isMobileView) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border/50 pb-4">
          {enableSelection && (
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-input"
                checked={
                  pageData.length > 0 && pageData.every((row) => selected.has(getRowId(row)))
                }
                onChange={toggleAll}
                aria-label={t("selectAllAria")}
              />
              {t("selectAllOnPage")}
            </label>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="mobile-sort-select" className="text-xs text-muted-foreground whitespace-nowrap">
              Sort by
            </label>
            <select
              id="mobile-sort-select"
              className="h-9 rounded-lg border border-input bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={sortColumn && sortDirection ? `${sortColumn}:${sortDirection}` : ""}
              onChange={(e) => {
                if (e.target.value === "") {
                  setSortColumn(null);
                  setSortDirection(null);
                  if (syncToUrl) {
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete(sortParamName);
                    router.push(`${pathname}?${params.toString()}`);
                  }
                } else {
                  const [col, dir] = e.target.value.split(":");
                  setSortColumn(col);
                  setSortDirection(dir as TableSortDirection);
                  if (syncToUrl) {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set(sortParamName, `${col}:${dir}`);
                    router.push(`${pathname}?${params.toString()}`);
                  }
                }
              }}
            >
              <option value="">None</option>
              {columns
                .filter((c) => c.sortable !== false && c.accessor)
                .flatMap((column) => [
                  {
                    value: `${column.id}:asc`,
                    label: `${column.header} (Ascending)`,
                  },
                  {
                    value: `${column.id}:desc`,
                    label: `${column.header} (Descending)`,
                  },
                ])
                .map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {enableSelection && selected.size > 0 && bulkActions && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-2">
            <span className="text-sm text-muted-foreground">
              {selected.size} row{selected.size === 1 ? "" : "s"} selected
            </span>
            {bulkActions}
          </div>
        )}

        {isLoading
          ? Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
              <div
                key={`skeleton-mobile-${rowIndex}`}
                className="rounded-2xl border border-border bg-card p-4 space-y-4"
              >
                {Array.from({ length: Math.min(columns.length, 4) }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <div className="h-3 w-24 rounded bg-muted" />
                    <div className="h-4 w-full rounded bg-muted/80" />
                  </div>
                ))}
              </div>
            ))
          : pageData.map((row) => {
              const rowId = getRowId(row);
              const props = getRowProps(row);
              return (
                <div
                  key={rowId}
                  {...props}
                  className={cn(
                    "rounded-2xl border border-border bg-card p-4 shadow-sm",
                    props.className
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-border/50">
                    {enableSelection && (
                      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="rounded border-input"
                          checked={selected.has(rowId)}
                          onChange={() => toggleRow(rowId)}
                          aria-label={t("selectRowAria", { id: rowId })}
                        />
                        Select
                      </label>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {renderCellValue(row, columns[0])}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {columns[1] ? renderCellValue(row, columns[1]) : null}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {columns.slice(2).map((column) => {
                      if (column.id === "actions") {
                        return (
                          <div key={column.id} className="mt-2 pt-2 border-t border-border/50 flex items-center justify-end">
                            {renderCellValue(row, column)}
                          </div>
                        );
                      }
                      return (
                        <div key={column.id} className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {column.header}
                          </p>
                          <div className="text-sm text-foreground">
                            {renderCellValue(row, column)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

        {!isLoading && data.length > 0 && (
          <Pagination
            totalItems={sortedData.length}
            pageSize={pageSize}
            currentPage={page + 1}
            onPageChange={(p) => setPage(p - 1)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
            pageSizeOptions={pageSizeOptions}
            syncToUrl={syncToUrl}
            pageParamName={pageParamName}
            pageSizeParamName={pageSizeParamName}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {enableSelection && selected.size > 0 && bulkActions && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-2">
          <span className="text-sm text-muted-foreground">
            {selected.size} row{selected.size === 1 ? "" : "s"} selected
          </span>
          {bulkActions}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {enableSelection && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-input"
                    checked={
                      pageData.length > 0 && pageData.every((row) => selected.has(getRowId(row)))
                    }
                    onChange={toggleAll}
                    aria-label={t("selectAllAria")}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={cn("px-4 py-3 text-xs font-medium text-muted-foreground", column.className)}
                >
                  {column.sortable !== false && column.accessor ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => toggleSort(column.id)}
                      aria-label={t("sortByAria", { column: column.header })}
                    >
                      {column.header}
                      <SortIcon columnId={column.id} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`} className="border-b border-border/50">
                    {enableSelection && (
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-4" />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={column.id} className="px-4 py-3">
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : pageData.map((row) => {
                  const rowId = getRowId(row);
                  const props = getRowProps(row);
                  return (
                    <tr
                      key={rowId}
                      {...props}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-muted/30",
                        props.className
                      )}
                    >
                      {enableSelection && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="rounded border-input"
                            checked={selected.has(rowId)}
                            onChange={() => toggleRow(rowId)}
                            aria-label={t("selectRowAria", { id: rowId })}
                          />
                        </td>
                      )}
                      {columns.map((column) => (
                        <td key={column.id} className={cn("px-4 py-3", column.className)}>
                          {column.cell
                            ? column.cell(row)
                            : column.accessor
                              ? typeof column.accessor === "function"
                                ? column.accessor(row)
                                : String(row[column.accessor as keyof T] ?? "")
                              : null}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {!isLoading && data.length > 0 && (
        <Pagination
          totalItems={sortedData.length}
          pageSize={pageSize}
          currentPage={page + 1}
          onPageChange={(p) => setPage(p - 1)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
          pageSizeOptions={pageSizeOptions}
          syncToUrl={syncToUrl}
          pageParamName={pageParamName}
          pageSizeParamName={pageSizeParamName}
        />
      )}
    </div>
  );
}
