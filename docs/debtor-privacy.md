# Debtor Privacy Architecture & Masking Rules

This document specifies the privacy guarantees, masking invariants, and implementation guidelines for debtor data across Kora Protocol.

## Overview

In commercial invoice financing, SME borrowers frequently discount invoices with sensitive debtor relationships. Exposing identifiable corporate debtor information indiscriminately can lead to commercial disadvantage, competitive intelligence leakage, or relationship friction.

Kora provides three levels of `debtorPrivacy`:
1. `anonymized` (Default for sensitive listings)
2. `partial` (Standard corporate listing)
3. `full` (Public corporate listing)

Additionally, Kora enforces a **Post-Funding Reveal** invariant: when a liquidity provider funds an invoice position, the debtor details become fully visible to that investor to satisfy contract verification requirements.

---

## Privacy Levels and Field Visibility

| Field | `anonymized` | `partial` | `full` | `isFunded === true` |
| :--- | :--- | :--- | :--- | :--- |
| **Debtor Name** | Masked with Industry & Jurisdiction descriptor (e.g. `Technology Company (Kenya)`) | Full Legal Name (e.g. `Safaricom PLC`) | Full Legal Name (e.g. `Safaricom PLC`) | Full Legal Name |
| **Debtor Street Address** | Hidden (`Identity anonymized for privacy`) | Masked (`Address hidden · Kenya`) | Full Street Address | Full Street Address |
| **Jurisdiction / Country** | Visible | Visible | Visible | Visible |
| **Industry Category** | Visible | Visible | Visible | Visible |
| **Card & Table ARIA Labels** | Privacy-safe descriptor (No PII leak) | Company Name (Partial disclosure) | Full Company Name | Full Company Name |

---

## Centralized Masking Helpers

All UI components, card surfaces, list rows, comparison modals, and accessibility labels **must** resolve debtor information through `lib/debtorPrivacy.ts` rather than accessing `invoice.metadata.debtorName` or `invoice.metadata.debtorAddress` directly.

### Key API Functions

```typescript
import {
  getEffectiveDebtorPrivacy,
  getMaskedDebtorName,
  getMaskedDebtorAddress,
  getDebtorAriaLabel,
  isDebtorAnonymized,
  isDebtorPartial,
  isDebtorFull,
} from "@/lib/debtorPrivacy";

// Resolve privacy-safe debtor name
const name = getMaskedDebtorName(invoice, isFunded);

// Resolve privacy-safe address string
const address = getMaskedDebtorAddress(invoice, isFunded);

// Resolve screen reader label
const label = getDebtorAriaLabel(invoice, isFunded);
```

---

## UI Components & Visual Variants

### `DebtorDisplay` Component
The canonical component for rendering debtor identity. Supports multiple display variants:
- `variant="card"`: Standard two-line layout with privacy indicators and icons.
- `variant="compact"`: Single-line layout suitable for table headers, comparison chips, and list rows.
- `variant="detail"`: Expanded layout for invoice detail views with privacy status badges.

---

## Testing & Compliance

Every surface touching debtor data must satisfy:
1. **Zero PII Leaks under Anonymization**: No real debtor names or street addresses present in DOM text, HTML attributes, tooltips, or ARIA labels when `debtorPrivacy === "anonymized"` and `isFunded === false`.
2. **Deterministic Monikers**: Anonymized listings deterministically display category and jurisdiction descriptors.
3. **Automated Unit Tests**: Maintained in `__tests__/debtor-privacy.test.tsx`.
