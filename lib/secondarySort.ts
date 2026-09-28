export const SECONDARY_SORT_OPTIONS = [
  { value: "listed_desc", label: "Listed date: Newest" },
  { value: "listed_asc", label: "Listed date: Oldest" },
  { value: "ask_price_asc", label: "Ask price: Low to high" },
  { value: "ask_price_desc", label: "Ask price: High to low" },
  { value: "discount_desc", label: "Implied discount: High to low" },
  { value: "discount_asc", label: "Implied discount: Low to high" },
  { value: "tenor_asc", label: "Remaining tenor: Shortest" },
  { value: "tenor_desc", label: "Remaining tenor: Longest" },
] as const;

export type SecondarySortBy = (typeof SECONDARY_SORT_OPTIONS)[number]["value"];

export const DEFAULT_SECONDARY_SORT: SecondarySortBy = "listed_desc";

interface SecondarySortableItem {
  positionId: string;
  remainingTenor: number;
  listing: {
    askPrice: number;
    impliedDiscount: number;
    listedAt: string;
  };
}

const VALID_SORTS = new Set<SecondarySortBy>(SECONDARY_SORT_OPTIONS.map((option) => option.value));

export function parseSecondarySort(value: string | null | undefined): SecondarySortBy {
  return value && VALID_SORTS.has(value as SecondarySortBy)
    ? (value as SecondarySortBy)
    : DEFAULT_SECONDARY_SORT;
}

function listedAtTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function sortSecondaryItems<T extends SecondarySortableItem>(
  items: readonly T[],
  sortBy: SecondarySortBy
): T[] {
  return [...items].sort((left, right) => {
    let comparison = 0;

    switch (sortBy) {
      case "listed_asc":
        comparison =
          listedAtTimestamp(left.listing.listedAt) - listedAtTimestamp(right.listing.listedAt);
        break;
      case "ask_price_asc":
        comparison = left.listing.askPrice - right.listing.askPrice;
        break;
      case "ask_price_desc":
        comparison = right.listing.askPrice - left.listing.askPrice;
        break;
      case "discount_desc":
        comparison = right.listing.impliedDiscount - left.listing.impliedDiscount;
        break;
      case "discount_asc":
        comparison = left.listing.impliedDiscount - right.listing.impliedDiscount;
        break;
      case "tenor_asc":
        comparison = left.remainingTenor - right.remainingTenor;
        break;
      case "tenor_desc":
        comparison = right.remainingTenor - left.remainingTenor;
        break;
      case "listed_desc":
      default:
        comparison =
          listedAtTimestamp(right.listing.listedAt) - listedAtTimestamp(left.listing.listedAt);
        break;
    }

    if (comparison !== 0 || left.positionId === right.positionId) return comparison;
    return left.positionId < right.positionId ? -1 : 1;
  });
}
