# Contributing to Kora Protocol

Thank you for helping improve Kora Protocol. Kora is an on-chain invoice financing app on Stellar: SMEs tokenize invoices, investors fund invoice positions, and wallet flows connect the UI to Soroban and USDC activity.

This guide is written for first-time contributors. Follow it from top to bottom when you set up the project, pick an issue, make a branch, test your work, and open a pull request.

## Contents

- [Before You Start](#before-you-start)
- [Fork and Clone](#fork-and-clone)
- [Local Setup](#local-setup)
- [Mock Data Mode](#mock-data-mode)
- [Daily Development Commands](#daily-development-commands)
- [Storybook](#storybook)
- [Your First Issue](#your-first-issue)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Testing Checklist](#testing-checklist)
- [Pull Request Checklist](#pull-request-checklist)
- [Code Style](#code-style)
- [Getting Help](#getting-help)

## Before You Start

Install these tools:

- Node.js 18 or newer.
- npm 9 or newer.
- Git.
- A GitHub account.
- Freighter or another Stellar wallet extension if you are testing wallet flows.

This repository uses npm. Use `npm install` for local setup so npm can reconcile `package.json` with the lockfile when dependencies change.

## Fork and Clone

1. Fork `OpenLedger-Foundation/Kora-Frontend` on GitHub.
2. Clone your fork:

```bash
git clone https://github.com/<your-github-user>/Kora-Frontend.git
cd Kora-Frontend
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/OpenLedger-Foundation/Kora-Frontend.git
git fetch upstream
```

4. Start every new task from the latest upstream `main`:

```bash
git switch main
git pull --ff-only upstream main
```

## Local Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

The example file documents the variables the app expects. Do not commit `.env.local`; it is ignored by Git and may contain private values.

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Mock Data Mode

Mock data mode lets you work on marketplace pages, SME dashboards, investor views, invoice cards, filters, and many UI states without live Stellar contracts.

Use mock data mode when:

- You are building UI.
- You are adding tests for stores, components, filters, or formatting.
- You do not need a real wallet signature or Soroban transaction.

Check `.env.example` for the mock-data flag. If it is enabled in `.env.local`, you can browse the app without live contract IDs or Pinata credentials.

Use a wallet only when the issue specifically touches wallet connection, transaction signing, funding, repayment, or network mismatch behavior. For wallet testing, use Stellar Testnet and never commit seed phrases, private keys, or real credentials.

## Daily Development Commands

Use these commands before you open a PR:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

Other useful commands:

```bash
npm run test:watch       # run Vitest in watch mode
npm run test:coverage    # generate a coverage report
npm run test:e2e         # run Playwright end-to-end tests
npm run format:check     # check Prettier formatting
npm run format           # format files with Prettier
```

If a command fails because of existing unrelated failures, mention that clearly in your PR description and include the exact command output that proves your changed area was tested.

## Storybook

Storybook is available for isolated UI work:

```bash
npm run storybook
```

Open the local Storybook URL printed by the command, usually `http://localhost:6006`.

Build Storybook before submitting changes that add or modify stories:

```bash
npm run build-storybook
```

Use Storybook for components in `components/ui`, invoice cards, empty states, loading states, dialogs, drawers, and other reusable UI pieces.

### Storybook Snapshot Tests

We use Vitest to run automated HTML snapshot tests for all Storybook stories. This ensures that any changes to component rendering are explicitly tracked and reviewed.

To run the snapshot tests:

```bash
npm run test -- __tests__/stories.snapshot.test.tsx
```

If you make intentional changes to a component's markup, you must update the snapshot files by running:

```bash
npm run test -- __tests__/stories.snapshot.test.tsx -u
```

Or using the full `--updateSnapshot` flag:

```bash
npx vitest run __tests__/stories.snapshot.test.tsx --updateSnapshot
```

The generated snapshots are stored in `__tests__/__snapshots__/` and must be committed to the repository.

## Your First Issue

Start with small issues that have clear files, acceptance criteria, and tests. The best search is:

```text
is:issue is:open label:"good first issue"
```

If the `good first issue` label has not been populated yet, use the same approach with small documentation, test, or accessibility issues under the `Stellar Wave` label. Good starter-style candidates are:

- `#228` - active filter chips with individual clear buttons.
- `#232` - unit tests for `lib/utils.ts`.
- `#233` - integration tests for the `useWallet` hook.
- `#235` - filter and sort tests for `invoiceStore`.
- `#245` - IPFS upload and verification tests.
- `#296` - contributor quick-start guide.

Before starting, read the issue comments. Do not take an issue that has already been assigned or accepted for another contributor. If a maintainer asks contributors to apply first, comment on the issue and wait for assignment before expecting reward-program credit.

## Branch Naming

Use short, descriptive branch names:

```bash
git switch -c docs/contributing-quickstart
git switch -c test/invoice-store-filters
git switch -c fix/wallet-network-mismatch
git switch -c feat/marketplace-filter-chips
```

Recommended prefixes:

- `docs/` for documentation only.
- `test/` for tests only.
- `fix/` for bug fixes.
- `feat/` for new user-facing behavior.
- `chore/` for tooling, configuration, or maintenance.

## Commit Messages

Use Conventional Commits:

```text
docs(contributing): add contributor quick-start guide
test(invoice-store): cover filter combinations
fix(wallet): handle network mismatch reconnects
feat(marketplace): add active filter chip removal
```

Keep commits focused. If a commit includes unrelated formatting, generated output, and feature code together, it is harder to review.

## Testing Checklist

Choose the smallest useful validation for your change:

- Documentation only: run `npm run format:check` if Markdown formatting changed, and verify links/commands manually.
- Utility functions: run `npm run test -- <test-file>`.
- Components or hooks: run the relevant Vitest file and `npm run lint`.
- UI flows: run Storybook or Playwright where the issue asks for browser behavior.
- Shared behavior: run `npm run lint`, `npm run type-check`, `npm run test`, and `npm run build`.

For coverage issues, run:

```bash
npm run test:coverage
```

Add the coverage summary or relevant excerpt to the PR description when the issue asks for it.

## Pull Request Checklist

Before opening a PR:

- Rebase on the latest upstream `main`.
- Keep the PR limited to the issue scope.
- Link the issue with `Closes #123`.
- Explain what changed and why.
- List every command you ran.
- Add screenshots or recordings for UI changes.
- Mention known limitations or existing unrelated failures.
- Confirm no secrets, private keys, wallet seed phrases, or `.env.local` values are included.

Example PR body:

```text
## Summary

- Added focused tests for invoice store category, APR, jurisdiction, and risk filters.
- Added fixture coverage for empty-result sorting.

Closes #235

## Testing

- [x] npm run test -- store/__tests__/invoiceStore.test.ts
- [x] npm run lint
```

## Pre-commit Hooks

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) to run `eslint --fix` and `tsc --noEmit` on staged `.ts`/`.tsx` files before every commit. The hook must complete cleanly for the commit to succeed.

If the hook fails, fix the reported errors before committing. Lint errors are printed directly in the terminal output.

Emergency bypass (use sparingly — CI will still catch errors):

```bash
git commit --no-verify -m "chore: emergency fix"
```

Never use `--no-verify` for normal development. It skips all pre-commit checks and should only be used when the hook itself is broken or you are committing a work-in-progress branch that will not be merged.

## Code Style

### TypeScript

- Prefer typed inputs and outputs.
- Avoid `any`; use `unknown` and narrow it.
- Keep domain types in `types/` when they are shared.

### React

- Use functional components and hooks.
- Add `"use client"` only when the component needs browser APIs, state, effects, or event handlers.
- Extract repeated logic into hooks only when it simplifies the caller.

### Styling

- Use Tailwind utility classes and existing design tokens.
- Use `cn()` from `lib/utils.ts` for conditional classes.
- Keep accessibility in mind: labels, focus states, keyboard navigation, and screen reader announcements matter.

### Security

- Never commit private keys, seed phrases, API keys, JWTs, or real customer data.
- Do not log signatures, wallet seeds, private invoices, or credentials.
- Use `.env.local` for local secrets and `.env.example` only for safe placeholders.

## Getting Help

- Ask questions on the issue when the acceptance criteria are unclear.
- Include file paths, screenshots, and command output when reporting setup problems.
- Keep discussion on GitHub unless maintainers explicitly ask contributors to use another channel.

Thanks for contributing to Kora Protocol.
