# Architecture Overview

## Purpose and context

The BKM WebShop is a school project of the Berufskolleg Meschede. It has two parts that share one code base:

1. **Webshop**: a single-page app (landing page, product grid, cart, checkout, order confirmation) that talks to an ERP backend.
2. **Production simulation**: a classroom exercise for an Industry 4.0 production line that makes salt and pepper shakers. A teacher runs a session, students and customers join with their phones, and each student operates one station of the line. The simulation needs no ERP: a small Node server keeps its state in memory.

User-facing text is German; code, identifiers and documentation are English (README.md is German).

## Tech stack

| Area      | Choice                                                                             |
| --------- | ---------------------------------------------------------------------------------- |
| UI        | React 19, TypeScript, Vite                                                         |
| Styling   | Tailwind CSS 4 driven by the design tokens in [design-system.md](design-system.md) |
| Icons     | `lucide-react`                                                                     |
| QR codes  | `qrcode.react`                                                                     |
| Server    | Node.js without framework (`server/`), run directly with `node server/index.ts`    |
| Tests     | Vitest, React Testing Library (jsdom), coverage thresholds in `vite.config.ts`     |
| Quality   | ESLint, Prettier                                                                   |
| Packaging | Docker image (Node 26 Alpine), published to GHCR by GitHub Actions                 |

Path alias: `@` points to `src/`.

## Project layout

```
src/
  App.tsx            page switch, URL join handling, cart state
  pages/             WebshopPage, SimulationPage, SimulationDashboardPage, SimulationStationPage
  components/        Navbar, Hero, cart/, webshop/, logo/, common/, simulation/ (stations/ inside)
  hooks/             useCart, useWebshopProducts, usePlaceOrder, useTheme, useApiKeyInit,
                     useSimulationSession, useRoleClaim, useSimulationShopContext, ...
  api/               ERP clients (articles, inventory, saleOrders, purchaseOrders, apikey, health)
                     and simulation/sessionApi.ts; requestApi.ts is the shared fetch wrapper
  types/             shared types and pure logic (simulation contract, roles, production math,
                     material supply, pre-flight checks, six-variant catalogue)
  styles/tokens.css  design tokens (light and dark)
  e2e/               live scenarios against a running simulation server
server/
  index.ts           HTTP entry point (port, static hosting, CORS)
  app.ts             routing and request validation
  engine.ts          in-memory simulation engine (state machine and rules)
docs/                design system, quality baseline, project documentation
```

## Commands

```bash
npm run dev            # Vite dev server with HMR (proxies /simulation to port 3001)
npm run server         # simulation server on port 3001 (PORT to change)
npm run build          # type-check + production build into dist/
npm run preview        # preview the production build
npm run lint           # ESLint
npm run format         # Prettier, write
npm run format:check   # Prettier, check only
npm test               # Vitest single run (test:watch for watch mode)
npm run test:coverage  # tests with coverage thresholds
npm run test:e2e       # live scenarios (Pull/Push/replenishment); needs
                       # VITE_E2E_API_BASE_URL=http://127.0.0.1:3001, skipped otherwise
```

Start `npm run server` and `npm run dev` together to work on the simulation locally. In production a single process (`node server/index.ts`, port 8080 in the container) serves the API and the built SPA.

Configuration lives in `.env` (copy `.env.example`; never commit it). All `VITE_*` variables are embedded in the client bundle and are public. Important ones: `VITE_API_BASE_URL` (ERP, default `http://localhost:8000`), `VITE_API_AUTH_TOKEN` (optional), `VITE_PUBLIC_BASE_URL` (origin encoded in QR codes), `VITE_SIMULATION_API_BASE_URL` (only for a separate simulation origin; then start the server with `CORS_ORIGINS`).

## Data flow

**Navigation.** There is no router. `App.tsx` holds `useState<Page>` (`'home' | 'webshop' | 'simulation'`) and passes `currentPage` and `onNavigate` to the `Navbar`. A new page extends the `Page` union and adds a render branch. Join links (`?session=<code>&role=<role>`) are read once on load.

**State.** There is no global store. The cart lives in `useCart`, created in `App.tsx` and passed down as props. Simulation state is the server's session snapshot, polled by `useSimulationSession` every 1.5 seconds. Theme (`dark`/`light` class on `<html>`) and the ERP API key are persisted in `localStorage`; the simulation shop context in `sessionStorage`.

**Webshop mode.** `useWebshopProducts` loads articles and inventory from the ERP; checkout posts a sale order (`usePlaceOrder`). `requestApi` adds the `Authorization` header from `getApiAuthToken`: the API key fetched at startup by `useApiKeyInit`, falling back to `VITE_API_AUTH_TOKEN`.

**Simulation shop mode.** Opening the shop with `?session=<code>&role=customer` (or `?mode=simulation&session=<code>`) switches it to simulation mode: a static six-variant catalogue (`types/simulationCatalog.ts`, the only mapping between article id and variant), a banner, and no ERP calls. Checkout adds the order to the session instead.

## Simulation model

**Variants.** Six shakers: salt (S) or pepper (P) lid, combined with a red, silver or black housing (`S-RT`, `S-SI`, `S-SW`, `P-RT`, `P-SI`, `P-SW`). Salt lids are blue, pepper lids green.

**Roles.** Customers (any number, or none) and one worker per station. Each role has its own QR code on the dashboard (`types/simulationRoles.ts`). A station can be claimed by exactly one person; a second claim returns 409. Claims survive a reset.

| Station | Task                                                                    |
| ------- | ----------------------------------------------------------------------- |
| 1       | Supply lids (blue/salt, green/pepper)                                   |
| 2       | Supply housings (red, silver, black)                                    |
| 3       | Production: hand over batches of produced shakers                       |
| 4       | Storage: check a batch against the list, store it or report a deviation |
| 5       | Retrieval: hand out the customer order                                  |

**Session lifecycle.** A session has a 4-digit code and the state `CONFIGURING`, `RUNNING` or `FINISHED` (only `CONFIGURING` to `RUNNING` to `FINISHED` is allowed).

1. `CONFIGURING`: the teacher chooses the strategy and collects the daily order. Customers place orders through the simulation shop; the teacher can edit the sum. In Push the teacher also sets the daily production plan. A pre-flight check requires an order, and claimed stations unless demo mode is on. Configuration is only accepted in this state.
2. `RUNNING`: the teacher presses "Tag simulieren". Station 1 becomes active, Station 2 follows when Station 1 is done.
3. `FINISHED`: the day ends automatically when the order is fully retrieved and production is done, when Station 5 ends it, or when the teacher ends it by hand. The quantity ordered but not retrieved becomes the `shortfall`.
4. From `FINISHED` the teacher can start the **next day** (same stations, claims, strategy and plan; the shortfall becomes the pre-filled order and `run_id` increases) or **reset** (clears the run, keeps claims, increases `run_id`).

**Pull flow.** Stations 1 and 2 supply material. When both are done, Station 5 becomes active and hands out the customer order. Once the whole order is retrieved, Station 5 is complete and production opens: Station 3 produces the retrieved quantity again, handing it over in one or several batches; Station 4 verifies and stores each batch. If Station 4 reports a deviation, the intact part is stored and the missing quantity goes back to Station 3 (`replenishment_queue`, display only) until the target is reached.

**Push flow.** Supply works as in Pull. When it is done, Stations 3 and 5 become active at the same time. Station 3 produces according to the daily production plan, Station 4 stores. Station 5 retrieves as soon as the customer asks for items, either from existing stock or as Station 4 books them. The software stock is not a gate and may temporarily be negative; it heals once the storage is booked.

**Batches.** A batch (`PRODUCED`, `STORED`, `REJECTED`) is a partial production run handed from Station 3 to Station 4. Open quantity at Station 3 is the target minus all non-rejected batches.

## API overview

### Simulation server (`server/`)

All responses are the full session snapshot (`types/simulation.ts`, snake_case field names). Errors use HTTP status codes: 400/422 invalid input, 404 unknown session or batch, 409 not allowed in the current state or station occupied, 503 no free session code. Sessions are kept in memory and purged after a time-to-live when new sessions are created, so a server restart loses all sessions.

| Method and path                        | Purpose                                          |
| -------------------------------------- | ------------------------------------------------ |
| `GET /health`                          | liveness check                                   |
| `POST /simulation/session/create`      | create a session (strategy)                      |
| `GET /simulation/session/{id}`         | read the snapshot (polled)                       |
| `POST .../state`                       | change state (`RUNNING`, `FINISHED`)             |
| `POST .../config`                      | strategy, plan, daily order (`CONFIGURING` only) |
| `POST .../claim`, `.../release`        | claim or free a station                          |
| `POST .../customer-join`               | count a joined customer                          |
| `POST .../orders/add`                  | add a customer order (`CONFIGURING` only)        |
| `POST .../reset`, `.../next-day`       | reset the run, start the next day                |
| `POST .../stations/{1,2}/complete`     | finish supply                                    |
| `POST .../stations/3/produce-batch`    | hand over a batch                                |
| `POST .../stations/4/store-batch`      | store a batch                                    |
| `POST .../stations/4/report-deviation` | report a missing quantity                        |
| `POST .../stations/5/retrieve-item`    | book a retrieval                                 |
| `POST .../stations/5/finish-day`       | end the day                                      |

The client is `src/api/simulation/sessionApi.ts`.

### ERP backend (webshop mode only)

`GET /article/list`, `GET /inventory/list`, `POST /order/sale/create`, `POST /order/purchase/create`, API key creation at startup, and `GET /health`. The base URL is `VITE_API_BASE_URL`. See [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) for the request wrapper.

## Conventions

- **Components**: named function components, exported as default at the bottom; props typed inline as `type Props = { ... }` above the component; page-specific components live under `src/components/<page>/`.
- **Styling**: use the design tokens through Tailwind utilities (`bg-card`, `text-ink`, `border-border`, `rounded-lg`, `p-md`, `shadow-sticker`, `bg-primary`), never raw palette classes or hex values. Cards have a 2px ink border and a hard sticker shadow; buttons are `rounded-full`. No CSS modules or styled-components.
- **Primary action colour**: `bg-primary text-on-primary` (logo red).
- **Logo**: `BkmLogo` is an inline SVG whose fills use tokens so it works in both themes.
- **Wording** (reuse, do not invent variants): `Schließen` dismisses an info popup, `Abbrechen` backs out of a confirmation, `Zurück` goes one step back in a flow, `Weiter einkaufen` stays in the shop after an order.
- **Tests**: colocated as `*.test.ts(x)`, setup in `src/test/setup.ts`, shared fixtures in `src/test/fixtures.ts`. New code needs tests.
- **Quality gates**: `npm run lint`, `npm run format:check`, `npm test` and `npm run build` must pass; CI (`.github/workflows/ci.yml`) runs them on pull requests and on `main`.
- **Commits**: `type(scope): subject`, one line, English imperative.
- **Deployment**: on pushes to `main`, `docker-publish.yml` builds and pushes the image to GHCR; `docker-compose.yml` runs it behind a reverse proxy.
