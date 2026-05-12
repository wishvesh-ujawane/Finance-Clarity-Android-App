# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Financial Clarity (`artifacts/financial-clarity`)
- **Type**: react-vite, preview at `/`
- **Purpose**: Personal money manager app with dashboard, budgets, and analysis
- **Tech**: React 19, Vite, Tailwind CSS, Recharts, Framer Motion, Lucide React
- **Persistence**: localStorage only (no backend)
- **Theme**: Deep-blue palette (Manrope + Inter fonts)
- **Features**:
  - Dashboard with balance card, spending donut chart (Recharts PieChart), recent transactions
  - Budgets page with progress bars and amber/red alerts at 75%/100% thresholds
  - Analysis page with bar chart (last 6 months) and category breakdown
  - Bottom sheet (Framer Motion slide-up) for adding transactions
  - FAB (+) button fixed bottom-right
  - Create new categories inline while adding transactions
  - Month selector on dashboard
  - Full localStorage persistence

### Key Files
- `src/context/FinanceContext.tsx` — global state (transactions, categories, budgets) + localStorage sync
- `src/lib/types.ts` — TypeScript interfaces (Transaction, Category, Budget)
- `src/components/TransactionSheet.tsx` — animated bottom sheet for transaction entry
- `src/components/Navigation.tsx` — sidebar (desktop) + bottom nav (mobile)
- `src/components/FAB.tsx` — floating action button
- `src/components/CategoryIcon.tsx` — icon map for category icons
- `src/pages/Dashboard.tsx` — balance overview, donut chart, recent transactions
- `src/pages/Budgets.tsx` — budget management with alerts
- `src/pages/Analysis.tsx` — income/expense analysis with charts
