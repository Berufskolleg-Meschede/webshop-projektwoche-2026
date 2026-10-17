# Quality baseline (Q0)

Measured on `main` at commit `2365248` (issue #211) on 2026-10-15. Facts only; nothing in the repo was changed except this file.

## 1. Gates

| Gate                                 | Result                                                  |
| ------------------------------------ | ------------------------------------------------------- |
| `npm run lint` (ESLint)              | 0 errors, 0 warnings (132 files linted)                 |
| `npm run build` (`tsc -b` + Vite)    | passes; JS bundle 368.90 kB (117.08 kB gzip)            |
| `tsc --noEmit` for app, node, server | 0 errors                                                |
| `npm test`                           | 50 files passed, 1 skipped; 535 tests passed, 6 skipped |
| `npm run test:coverage`              | passes all thresholds                                   |

The 6 skipped tests are the live scenarios in `src/e2e/simulation.e2e.test.ts` (they need `VITE_E2E_API_BASE_URL`).

## 2. Coverage (`npm run test:coverage`, Vitest 5.0.4, v8 provider)

Scope in `vite.config.ts`: `src/**/*.{ts,tsx}` and `server/**/*.ts`, excluding tests, `src/test/**`, `src/main.tsx`, `server/index.ts`, `src/globals.d.ts` and every `index.ts`.

Thresholds enforced: statements 90, branches 85, functions 90, lines 90.

| Area           | Files | Statements | Branches | Functions |   Lines |
| -------------- | ----: | ---------: | -------: | --------: | ------: |
| **Total**      |    69 |     98.78% |   95.69% |    98.95% |  99.33% |
| server         |     2 |     98.36% |   90.10% |   100.00% |  99.47% |
| src/api        |    12 |     98.18% |   97.14% |    97.83% |  98.10% |
| src/components |    32 |     98.73% |   98.16% |    99.00% |  99.49% |
| src/hooks      |     9 |     99.45% |   97.30% |   100.00% |  99.69% |
| src/pages      |     4 |     97.71% |   95.65% |    93.75% |  98.37% |
| src/types      |     9 |     99.52% |   95.62% |   100.00% |  99.41% |
| src/App.tsx    |     1 |    100.00% |  100.00% |   100.00% | 100.00% |

Raw totals: statements 1714/1735, branches 1335/1395, functions 569/575, lines 1497/1507. Per-area figures are summed from the per-file `json-summary` counts.

Files below 100% in any metric (21 of 69), lowest first by the weakest metric:

| File                                                            | Stmts | Branch | Funcs | Lines |
| --------------------------------------------------------------- | ----: | -----: | ----: | ----: |
| `src/hooks/usePendingAction.ts`                                 |  90.9 |     50 |   100 |   100 |
| `server/engine.ts`                                              | 98.42 |  86.69 |   100 |   100 |
| `src/pages/SimulationDashboardPage.tsx`                         | 93.54 |  96.36 | 88.23 |  93.1 |
| `src/pages/WebshopPage.tsx`                                     |   100 |  94.44 | 83.33 |   100 |
| `src/components/simulation/QrCodeCard.tsx`                      | 95.23 |     90 |  90.9 |   100 |
| `src/hooks/useCart.ts`                                          |   100 |  91.66 |   100 |   100 |
| `src/types/liveDashboard.ts`                                    | 98.24 |   91.3 |   100 | 97.87 |
| `src/pages/SimulationPage.tsx`                                  | 98.07 |  92.59 |   100 |   100 |
| `src/components/simulation/JoinPage.tsx`                        | 94.11 |  92.15 |   100 | 97.61 |
| `src/api/articles/listArticlesApi.ts`                           | 94.11 |  97.14 |   100 | 92.85 |
| `src/api/simulation/sessionApi.ts`                              | 95.23 |  94.73 | 94.73 |    95 |
| `src/components/simulation/stations/Station3ProductionView.tsx` | 97.29 |    100 | 93.75 | 96.29 |
| `src/hooks/useSimulationSession.ts`                             |   100 |  94.44 |   100 |   100 |
| `src/components/simulation/StationOccupiedScreen.tsx`           |   100 |  94.11 |   100 |   100 |
| `src/hooks/useSimulationShopContext.ts`                         |  97.5 |    100 |   100 | 97.29 |
| `src/types/production.ts`                                       |   100 |  95.83 |   100 |   100 |
| `src/api/inventory/listInventoryApi.ts`                         |   100 |  95.83 |   100 |   100 |
| `server/app.ts`                                                 | 98.18 |     97 |   100 | 97.97 |
| `src/pages/SimulationStationPage.tsx`                           |   100 |  96.72 |   100 |   100 |
| `src/components/cart/CheckoutDialog.tsx`                        | 97.67 |  98.07 |   100 |   100 |
| `src/components/simulation/StrategySelector.tsx`                |   100 |  97.18 |   100 |   100 |

## 3. Tests per area

51 test files, 541 tests (535 run, 6 skipped).

| Area                 | Test files | Tests run | Skipped |
| -------------------- | ---------: | --------: | ------: |
| server               |          2 |        97 |       0 |
| src/api              |          7 |        46 |       0 |
| src/components       |         19 |       150 |       0 |
| src/hooks            |          9 |        91 |       0 |
| src/pages            |          5 |        79 |       0 |
| src/types            |          6 |        46 |       0 |
| src (root, e.g. App) |          2 |        26 |       0 |
| src/e2e (live)       |          1 |         0 |       6 |
| **Total**            |     **51** |   **535** |   **6** |

Runtime: about 6.5 s for the whole suite (jsdom environment created 51 times, 23 s of summed worker time).

## 4. Duplicate and dead code

Both tools were run read-only through `npx --yes` (no dependency or config added to the repo).

### knip 6.41.0 (default config, no `knip.json`)

Exit code 1 (findings). Default config means entry points are guessed from `package.json` and the Vite/Vitest plugins.

- Unused file (1): `scripts/mobile-layout-check.mjs`
- Unused dependency (1): `@microlink/react-json-view`
- Unused devDependency (1): `baseline-browser-mapping`
- Unused exports (10): `MAX_QUANTITY_PER_VARIANT` (`server/engine.ts`), `CLEAR_STATION_QUESTION`, `CLEAR_STATION_CONFIRM`, `CLEAR_STATION_CANCEL` (`ClearStationButton.tsx`), `STATION3_WAITING_FOR_RETRIEVAL_TEXT` (`Station3ProductionView.tsx`), `PLACEHOLDER_IMAGE`, `SIMULATION_DEFAULT_IMAGE`, `SIMULATION_DEFAULT_IMAGE_ALT` (`placeholderImage.ts`), `SESSION_POLL_INTERVAL_MS` (`useSimulationSession.ts`), `SIMULATION_CUSTOMER_NAME_STORAGE_KEY` (`useSimulationShopContext.ts`)
- Unused exported types (4): `InventoryDataSource`, `InventoryItem` (`listInventoryApi.ts`), `OrderProgressRow` (`liveDashboard.ts`), `BatchStatus` (`simulation.ts`)

Caveats: an export used only by a test file may still be reported depending on how knip treats test entries; the script and the two packages were not checked by hand against config files, CI or the Docker image. Treat the list as candidates, not verified dead code.

### jscpd 5.4.1

Command: `npx --yes jscpd src server --ignore '**/*.test.ts,**/*.test.tsx' --min-lines 5 --min-tokens 50`. Test files were excluded; thresholds are the stated flags, not the tool defaults, so numbers change with them.

9 clones, 119 duplicated lines of 7030 (1.69%), 797 of 40764 tokens (1.96%). By format: tsx 77 lines (1.98%), typescript 11 lines (0.37%), css 31 lines (17.42% of the 178 CSS lines).

| Lines | Clone                                                                                 |
| ----: | ------------------------------------------------------------------------------------- |
|    16 | `Station3ProductionView.tsx:95-110` and `Station5RetrievalView.tsx:90-105`            |
|    15 | `Station3ProductionView.tsx:110-124` and `Station5RetrievalView.tsx:105-119`          |
|    11 | `Station3ProductionView.tsx:51-61` and `Station5RetrievalView.tsx:55-65`              |
|     8 | `Station3ProductionView.tsx:39-46` and `Station5RetrievalView.tsx:43-50`              |
|    11 | `hooks/usePlaceOrder.ts:23-33` and `hooks/useSimulationSession.ts:30-40`              |
|    11 | `pages/SimulationPage.tsx:136-146` and `pages/SimulationPage.tsx:164-174` (same file) |
|    10 | `JoinPage.tsx:64-73` and `StationOccupiedScreen.tsx:54-63`                            |
|     6 | `CartDrawer.tsx:30-35` and `CheckoutDialog.tsx:76-81`                                 |
|    31 | `styles/tokens.css:80-110` and `113-143` (light and dark token blocks, expected)      |

## 5. Largest files (lines, `src/` and `server/`, `.ts`/`.tsx`)

|   # | Lines | File                                                                |
| --: | ----: | ------------------------------------------------------------------- |
|   1 |   999 | `server/engine.test.ts`                                             |
|   2 |   677 | `server/engine.ts`                                                  |
|   3 |   556 | `src/pages/SimulationDashboardPage.test.tsx`                        |
|   4 |   491 | `src/pages/SimulationPage.test.tsx`                                 |
|   5 |   405 | `src/hooks/useSimulationSession.test.ts`                            |
|   6 |   399 | `src/components/simulation/stations/Station4StorageView.test.tsx`   |
|   7 |   356 | `server/app.test.ts`                                                |
|   8 |   324 | `src/components/simulation/StrategySelector.tsx`                    |
|   9 |   309 | `src/components/cart/CheckoutDialog.tsx`                            |
|  10 |   286 | `src/components/simulation/stations/Station5RetrievalView.test.tsx` |
|  11 |   279 | `server/app.ts`                                                     |
|  12 |   253 | `src/pages/SimulationDashboardPage.tsx`                             |
|  13 |   224 | `src/e2e/simulation.e2e.test.ts`                                    |
|  14 |   219 | `src/pages/SimulationStationPage.tsx`                               |
|  15 |   219 | `src/hooks/useSimulationSession.ts`                                 |

Largest non-test source files only: `server/engine.ts` 677, `StrategySelector.tsx` 324, `CheckoutDialog.tsx` 309, `server/app.ts` 279, `SimulationDashboardPage.tsx` 253, `SimulationStationPage.tsx` 219, `useSimulationSession.ts` 219, `Station5RetrievalView.tsx` 194.

## 6. Candidates for later phases

**Q1 audit**

- `server/engine.ts`: 677 lines, lowest branch coverage in the repo (86.69%), the only file near the 85% branch threshold.
- `src/hooks/usePendingAction.ts`: 50% branch coverage.
- Large single files: `StrategySelector.tsx` (324), `CheckoutDialog.tsx` (309), `SimulationDashboardPage.tsx` (253).
- knip candidates: `@microlink/react-json-view`, `baseline-browser-mapping`, `scripts/mobile-layout-check.mjs`, 10 unused exports, 4 unused exported types.

**Q3 unify**

- `Station3ProductionView` and `Station5RetrievalView` share four clones (50 lines).
- `usePlaceOrder` and `useSimulationSession` share an 11-line clone.
- `SimulationPage.tsx` repeats an 11-line block inside itself.
- `JoinPage` and `StationOccupiedScreen` share a 10-line block; `CartDrawer` and `CheckoutDialog` share 6 lines.

**Q4 coverage gaps**

- Function coverage below 90%: `WebshopPage.tsx` (83.33%), `SimulationDashboardPage.tsx` (88.23%).
- Branch coverage below 92%: `usePendingAction.ts` (50%), `server/engine.ts` (86.69%), `QrCodeCard.tsx` (90%), `useCart.ts` (91.66%), `liveDashboard.ts` (91.3%).
- Line coverage below 95%: `listArticlesApi.ts` (92.85%), `SimulationDashboardPage.tsx` (93.1%), `Station3ProductionView.tsx` (96.29% lines, 93.75% functions).
- The 6 live scenarios in `src/e2e/` are skipped in a plain `npm test` run (they need the simulation server).
