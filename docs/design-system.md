# Design System

The Kora frontend uses a semantic, token-based design system built on Tailwind CSS, CSS custom properties, and Radix UI primitives.

## Source of truth

| Layer | Location |
| ----- | -------- |
| CSS tokens | `app/globals.css` (`:root` and `.dark` blocks) |
| Tailwind mapping | `tailwind.config.ts` |
| UI primitives | `components/ui/` |
| Domain components | `components/invoice/`, `components/wallet/`, etc. |

## Theming

- **Dark-mode-first** with light mode via the `class` strategy (`darkMode: ["class"]` in Tailwind).
- Theme switching is handled by `next-themes`; an inline script in `app/layout.tsx` prevents FOUC on first load.
- Color tokens are defined as **HSL components** (e.g. `--color-primary: 174 72% 40%`) and consumed as `hsl(var(--primary))` in Tailwind.

## Token categories

### Color

Semantic tokens in `globals.css`:

- **Brand:** `--color-primary`, `--color-accent`
- **Surfaces:** `--color-surface`, `--color-surface-elevated`, `--color-surface-muted`
- **Text:** `--color-text`, `--color-text-muted`, `--color-text-subtle`
- **Feedback:** `--color-success`, `--color-warning`, `--color-destructive`, `--color-info`

Legacy shadcn-compatible aliases (`--background`, `--foreground`, `--card`, etc.) map to the semantic tokens for compatibility with existing UI components.

### Spacing & typography

Spacing scale (`--space-1` … `--space-12`) and font sizes (`--font-size-xs` … `--font-size-3xl`) are defined in `globals.css` and referenced where needed for consistent rhythm.

## UI primitives

Reusable building blocks live under `components/ui/`. The public barrel in
`components/ui/index.ts` currently re-exports the following modules:

| Module | Purpose | Use when |
| ------ | ------- | -------- |
| `button` | Shared action button variants and sizing. | Triggering primary, secondary, outline, ghost, or destructive actions. |
| `card` | Card surface primitives for grouped content. | Grouping related information into a bordered/elevated surface. |
| `badge` | Compact status or category label. | Showing state, risk, tags, or short metadata inline. |
| `skeleton` | Loading placeholders, including shared skeleton compositions. | Reserving layout while data or content is loading. |
| `progress` | Determinate progress indicator. | Showing completion, funding, or other bounded progress. |
| `input` | Styled single-line text input. | Collecting short text values with shared validation styling. |
| `textarea` | Styled multiline text input. | Collecting notes, descriptions, or other longer free-form text. |
| `number-input` | Numeric input with step controls and optional USDC prefix. | Collecting bounded numeric or currency-like values. |
| `date-picker` | Calendar-backed date input with min/max bounds. | Choosing a date where validation and a calendar UI are preferable to raw text. |
| `file-input` | Drag-and-drop PDF input with validation and preview/removal state. | Collecting a single invoice/document PDF. |
| `pagination` | Shared pagination controls. | Splitting long result sets into navigable pages. |
| `dialog` | Radix-based modal primitives. | Presenting focused tasks that should temporarily block interaction with the page behind them. |
| `select` | Searchable, grouped, multi-select, and async-capable option picker. | Choosing one or more values from a controlled option set. |
| `stat-card` | KPI card with trend and optional sparkline. | Summarizing dashboard metrics at a glance. |
| `data-table` | Sortable, paginated, selectable data table. | Rendering structured datasets that need sorting, paging, bulk actions, or URL-synced state. |
| `CopyButton` | Clipboard action with copied-state feedback. | Letting users copy addresses, hashes, IDs, or other exact values. |
| `Highlight` | Highlights query matches inside text. | Emphasizing matched substrings in search/filter results. |
| `apr-display` | Calculates and presents APR with contextual formatting. | Showing invoice yield/APR consistently in cards, details, and dashboards. |
| `drawer` | Accessible right-side slide-in panel with focus management. | Showing secondary details without navigating away from the current desktop view. |
| `range-slider` | Two-thumb numeric range control with optional histogram. | Filtering or selecting a minimum/maximum interval. |

The directory also contains shared UI modules that are imported directly rather
than re-exported by `components/ui/index.ts`:

| Module | Purpose | Use when |
| ------ | ------- | -------- |
| `bottom-sheet` | Accessible mobile slide-up panel with focus trapping and swipe-to-dismiss. | Presenting drawer-like secondary content on smaller screens. |
| `breadcrumb` | Hierarchical navigation trail. | Showing the user's location within nested routes or flows. |
| `tooltip` | Radix-based tooltip primitives plus a compound `Tooltip` helper. | Adding concise contextual help on hover, focus, or long-press. |
| `back-button` | Shared browser-history back action. | A view needs an explicit “Go Back” control. |
| `CountdownTimer` | Deadline/maturity countdown with urgency states and optional calendar export. | Showing time remaining until expiry or repayment. |
| `EmptyState` | Empty-result presentation with optional CTA and recovery suggestions. | A collection, dashboard, or filtered view has no content to display. |
| `ErrorPage` | Route-level error presentation with retry and recovery navigation. | A Next.js route error boundary needs a consistent fallback. |
| `error-boundary` | Component-level React error boundary and fallback. | Isolating failures inside a subtree without taking down the whole route. |
| `ShortcutBadge` | Compact keyboard-shortcut hint. | Displaying shortcuts alongside commands or navigation items. |
| `animations` | Shared success and loading animation primitives. | Reusing reduced-motion-aware spinners or completion feedback. |
| `print-layout` | Print/PDF layout wrapper and print-specific styling. | Rendering invoice/details content for browser printing or PDF export. |
| `stellar-address` | Truncated Stellar address with full-value tooltip and copy action. | Displaying long Stellar addresses compactly and safely. |
| `stellar-tx-link` | Truncated, validated link to a Stellar transaction explorer. | Linking a transaction hash to its external explorer record. |

Tests and Storybook files colocated in `components/ui/` are supporting files,
not additional primitives. Prefer composing the modules above over one-off
styles, and use `cn()` from `lib/utils` for conditional class merging.

## Storybook

Component stories live alongside components as `*.stories.tsx` files. Storybook
packages are **not currently wired** as an `npm run storybook` script — visual
coverage runs through the Vitest snapshot test instead. See
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

Run the snapshot suite for stories:

```bash
npm run test -- __tests__/stories.snapshot.test.tsx
```

If you make intentional markup changes, regenerate the committed snapshots:

```bash
npm run test -- __tests__/stories.snapshot.test.tsx -u
```

Snapshots are stored in `__tests__/__snapshots__/` and must be committed with
your change.

## Adding new tokens

1. Add the CSS variable to `:root` and `.dark` in `app/globals.css`.
2. Map it in `tailwind.config.ts` under `theme.extend`.
3. Use the Tailwind utility in components — avoid hard-coded hex values in feature code.
