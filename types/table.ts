import type { ReactNode } from "react";

export type TableSortDirection = "asc" | "desc" | null;

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessor?: keyof T | ((row: T) => string | number);
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableEmptyState {
  title?: string;
  message: string;
  illustration?: ReactNode;
  action?: ReactNode;
}

export interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  enableSelection?: boolean;
  bulkActions?: ReactNode;
  onSelectionChange?: (selectedIds: string[]) => void;
  /** When provided, each body row is clickable (and keyboard-activatable via Enter) */
  onRowClick?: (row: T) => void;
  emptyState?: DataTableEmptyState;
  getRowId?: (row: T) => string;
  className?: string;
  syncToUrl?: boolean;
  pageParamName?: string;
  sortParamName?: string;
  pageSizeParamName?: string;
}
