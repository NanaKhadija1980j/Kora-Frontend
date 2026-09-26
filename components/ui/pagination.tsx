"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  totalItems: number;
  pageSize: number;
  currentPage: number; // 1-based
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  syncToUrl?: boolean;
  pageParamName?: string;
  pageSizeParamName?: string;
}

export function Pagination({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  syncToUrl = true,
  pageParamName = "page",
  pageSizeParamName = "pageSize",
}: PaginationProps) {
  const t = useTranslations("pagination");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const normalizedCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const updateUrl = React.useCallback(
    (page: number, size: number) => {
      if (!syncToUrl) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set(pageParamName, String(page));
      params.set(pageSizeParamName, String(size));
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams, syncToUrl, pageParamName, pageSizeParamName]
  );

  React.useEffect(() => {
    if (!syncToUrl) return;
    const urlPage = searchParams.get(pageParamName);
    const urlPageSize = searchParams.get(pageSizeParamName);

    if (urlPage) {
      const parsedPage = parseInt(urlPage, 10);
      if (!isNaN(parsedPage) && parsedPage !== currentPage && parsedPage > 0) {
        onPageChange(parsedPage);
      }
    }
    if (urlPageSize && onPageSizeChange) {
      const parsedSize = parseInt(urlPageSize, 10);
      if (!isNaN(parsedSize) && parsedSize !== pageSize && parsedSize > 0) {
        onPageSizeChange(parsedSize);
      }
    }
  }, [searchParams, syncToUrl, onPageChange, onPageSizeChange, currentPage, pageSize, pageParamName, pageSizeParamName]);

  const handlePageChange = (page: number) => {
    const targetPage = Math.min(Math.max(1, page), totalPages);
    onPageChange(targetPage);
    updateUrl(targetPage, pageSize);
  };

  const handlePageSizeChange = (size: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(size);
      handlePageChange(1);
      updateUrl(1, size);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 1) return [1];

    const range = 2; // current ± 2
    const left = normalizedCurrentPage - range;
    const right = normalizedCurrentPage + range;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        pages.push(i);
      } else if (i === left - 1 || i === right + 1) {
        pages.push("...");
      }
    }

    return pages.filter((v, i, a) => a.indexOf(v) === i);
  };

  const startItem = totalItems === 0 ? 0 : (normalizedCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(normalizedCurrentPage * pageSize, totalItems);

  const pageNumbers = getPageNumbers();

  return (
    <nav
      role="navigation"
      aria-label={t("navAria")}
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4"
    >
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{startItem}</span>–
        <span className="font-medium text-foreground">{endItem}</span> of{" "}
        <span className="font-medium text-foreground">{totalItems}</span> results
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Show</span>
            <select
              aria-label={t("pageSizeAria")}
              className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            onClick={() => handlePageChange(normalizedCurrentPage - 1)}
            disabled={normalizedCurrentPage <= 1}
            aria-label={t("previousPage")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {pageNumbers.map((page, index) => {
            if (page === "...") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground"
                >
                  &hellip;
                </span>
              );
            }

            const pageNum = page as number;
            const isCurrent = pageNum === normalizedCurrentPage;

            return (
              <Button
                key={`page-${pageNum}`}
                type="button"
                variant={isCurrent ? "default" : "outline"}
                className={cn(
                  "h-9 w-9 rounded-lg text-sm",
                  isCurrent && "font-semibold pointer-events-none"
                )}
                onClick={() => handlePageChange(pageNum)}
                aria-label={t("goToPage", { page: pageNum })}
                aria-current={isCurrent ? "page" : undefined}
              >
                {pageNum}
              </Button>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            onClick={() => handlePageChange(normalizedCurrentPage + 1)}
            disabled={normalizedCurrentPage >= totalPages}
            aria-label={t("nextPage")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
