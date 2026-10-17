# BKM Webshop — Developer Guide

Reference for developers working on this codebase: setup, directory layout, the webshop modules, conventions, and Docker/CI. The big picture (architecture, simulation model, server API) lives in [`docs/architecture.md`](docs/architecture.md); the German project overview, deployment and acceptance notes are in [`README.md`](README.md). This guide links to them instead of repeating them.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Setup](#2-project-setup)
3. [Environment Variables](#3-environment-variables)
4. [Directory Structure](#4-directory-structure)
5. [Architecture Overview](#5-architecture-overview)
6. [Navigation System](#6-navigation-system)
7. [API Layer](#7-api-layer)
8. [State Management](#8-state-management)
9. [Custom Hooks](#9-custom-hooks)
10. [Pages](#10-pages)
11. [Components](#11-components)
12. [TypeScript Types](#12-typescript-types)
13. [Styling Guide](#13-styling-guide)
14. [Development Conventions](#14-development-conventions)
15. [Docker & Deployment](#15-docker--deployment)
16. [Known Limitations](#16-known-limitations)

---

## 1. Tech Stack

| Tool                       | Version | Purpose                                                         |
| -------------------------- | ------- | --------------------------------------------------------------- |
| React                      | 19      | UI framework                                                    |
| TypeScript                 | ~5.9    | Type safety                                                     |
| Vite                       | ^7      | Dev server + build bundler                                      |
| Tailwind CSS               | ^4.3    | Utility-first styling (via `@tailwindcss/vite`)                 |
| lucide-react               | ^0.525  | Icon library                                                    |
| qrcode.react               | ^4.2    | QR codes for the simulation join links                          |
| @microlink/react-json-view | ^1.31   | JSON viewer                                                     |
| Vitest                     | ^5      | Test runner (jsdom environment, v8 coverage)                    |
| React Testing Library      | ^16     | Component tests (with `jest-dom` and `user-event`)              |
| ESLint + Prettier          | —       | Linting + formatting                                            |
| Node.js (no framework)     | —       | Simulation server in `server/`, run with `node server/index.ts` |

No router library, no global state library, no form library — intentionally minimal. The live end-to-end scenarios in `src/e2e/` are Vitest tests against a running simulation server (see [Section 2](#2-project-setup)); there is no browser-automation tool.

---

## 2. Project Setup

### Prerequisites

- Node.js 22.22+ (Vitest/jsdom need at least 22.22; CI uses Node 24, the Docker image Node 26). The simulation server runs `.ts` files directly through Node's native TypeScript type stripping, so there is no separate server build.
- npm 10+

### Installation

```bash
npm ci          # reproducible install (CI / team setup)
npm install     # alternative for first-time local setup
```

### Available Scripts

```bash
npm run dev            # Vite dev server with HMR (http://localhost:5173), proxies /simulation to port 3001
npm run server         # simulation server (node server/index.ts), port 3001 (PORT to change)
npm run build          # type-check (tsc -b) + production build → dist/
npm run preview        # serve the production build locally
npm run lint           # ESLint
npm run format         # Prettier — write all files
npm run format:check   # Prettier — check only (no writes)
npm test               # Vitest, single run
npm run test:watch     # Vitest, watch mode
npm run test:coverage  # Vitest with v8 coverage and the thresholds from vite.config.ts
npm run test:e2e       # live scenarios in src/e2e against a running simulation server
```

`npm run test:e2e` needs `VITE_E2E_API_BASE_URL=http://127.0.0.1:3001` (start `npm run server` first); without it the scenarios are skipped. To work on the simulation locally, run `npm run server` and `npm run dev` together.

Before pushing, the quality gates must pass: `npm run lint`, `npm run format:check`, `npm test`, `npm run build`.

---

## 3. Environment Variables

All client-side variables **must be prefixed with `VITE_`** to be exposed by Vite, and they are embedded in the client bundle (public, never a secret). Copy `.env.example` to `.env` in the project root (`.env` is git-ignored).

| Variable                       | Read by              | Description                                                                                                       |
| ------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`            | Frontend             | ERP backend base URL (default `http://localhost:8000`, trailing slashes are stripped).                            |
| `VITE_API_AUTH_TOKEN`          | Frontend             | Optional bearer token, used only if no API key is stored in `localStorage`.                                       |
| `VITE_PUBLIC_BASE_URL`         | Frontend             | Origin encoded in the join QR codes; must be reachable from students' phones (default: the current origin).       |
| `VITE_SIMULATION_API_BASE_URL` | Frontend             | Only for a separate simulation origin (default: the app's own origin). Then start the server with `CORS_ORIGINS`. |
| `VITE_COMMIT_SHA`              | Frontend             | Commit shown in the build info; set by CI via a Docker build arg, leave empty locally.                            |
| `PORT`                         | Server               | Port of the simulation server (default `3001`, `8080` in the container).                                          |
| `STATIC_DIR`                   | Server               | Directory of the built SPA the server serves (default `dist`, `/app/dist` in the container).                      |
| `CORS_ORIGINS`                 | Server               | Comma-separated allowed origins; only needed with a separate frontend origin.                                     |
| `WEBSHOP_HOST`                 | `docker-compose.yml` | Hostname Traefik routes to the container (default `webshop.local`); read by Compose, not by Vite.                 |

The frontend variables are read in [`src/api/getApiBaseUrl.ts`](src/api/getApiBaseUrl.ts), [`src/api/getApiAuthToken.ts`](src/api/getApiAuthToken.ts), [`src/api/getPublicBaseUrl.ts`](src/api/getPublicBaseUrl.ts) and [`src/api/getSimulationBaseUrl.ts`](src/api/getSimulationBaseUrl.ts). For Docker builds, pass them as build args (see [Section 15](#15-docker--deployment)).

---

## 4. Directory Structure

```
├── src/
│   ├── api/              # ERP clients (articles, inventory, saleOrders, purchaseOrders, apikey, health),
│   │                     # simulation/sessionApi.ts, requestApi.ts (shared fetch wrapper),
│   │                     # getApiBaseUrl / getApiAuthToken / getPublicBaseUrl / getSimulationBaseUrl
│   ├── components/       # Navbar, Hero, CTAButton, cart/, webshop/, logo/, common/,
│   │                     # simulation/ (with stations/)
│   ├── hooks/            # useCart, useWebshopProducts, usePlaceOrder, useApiKeyInit, useTheme,
│   │                     # useSimulationSession, useRoleClaim, useSimulationShopContext, ...
│   ├── pages/            # WebshopPage, SimulationPage, SimulationDashboardPage, SimulationStationPage
│   ├── types/            # shared types and pure logic (cart, checkout, simulation contract, roles,
│   │                     # production, material supply, pre-flight checks, simulation catalogue)
│   ├── styles/tokens.css # design tokens (light + dark)
│   ├── e2e/              # live scenarios against a running simulation server (Vitest)
│   ├── test/             # test setup, fixtures, mocks, engine harness
│   ├── App.tsx           # root component, state-based navigation, cart state
│   ├── index.css         # Tailwind import, @config, fonts, base styles
│   └── main.tsx          # React entry point
├── server/               # Node simulation server: index.ts (HTTP, static files, CORS),
│                         # app.ts (routing, validation), engine.ts (in-memory engine), tests
├── scripts/              # nas-smoke-test.sh, mobile-layout-check.mjs
├── docs/                 # architecture.md, design-system.md, quality-baseline.md, NAS-Abnahme.md
├── public/               # logo-bkm.png/.svg, bkm-luftbild.jpg, shopping-cart.svg
├── .github/              # CI, Docker publish, Dependabot, issue/PR templates
├── .env.example          # env var template
├── Dockerfile            # multi-stage production image
├── docker-compose.yml    # NAS deployment (app + Watchtower)
├── eslint.config.js      # ESLint flat config
├── tailwind.config.js    # Tailwind theme mapped to the design tokens (loaded via @config)
├── tsconfig*.json        # project references: app, node (Vite config), server
└── vite.config.ts        # Vite, Tailwind plugin, path alias, Vitest config
```

Tests sit next to the code they cover (`*.test.ts(x)`). There is no `postcss.config.js`: Tailwind runs through the `@tailwindcss/vite` plugin, and `src/index.css` loads the theme with `@config '../tailwind.config.js'`.

---

## 5. Architecture Overview

The overall architecture, simulation model and server API are described in [`docs/architecture.md`](docs/architecture.md). In short:

- React 19 single-page app with **no router** and **no global store**.
- Webshop mode talks to an ERP backend; simulation mode talks only to the Node server in `server/`, which holds all session state in memory.
- In production one Node process serves both the API and the built SPA.

### Component Data Flow

```
App.tsx
├── useCart()                          ← all cart/checkout state lives here
├── useApiKeyInit / useTheme / useSimulationShopContext
├── Navbar                             ← cartCount, onNavigate, onOpenCart, theme toggle
├── Hero (home)                        ← onNavigate
├── WebshopPage (webshop)              ← cartItems, onAddToCart, simulation session
├── SimulationPage (simulation)        ← joinTarget, onNavigate, onEnterSimulationShop
├── CartDrawer                         ← cart state + actions
└── CheckoutDialog                     ← cart state + actions, places the order
```

Cart state and cart UI (drawer + dialog) are managed at the root `App` level and passed down as props, which keeps the cart consistent across pages.

### API Layer

All ERP calls go through one wrapper (`requestApi`), which handles base URL, auth headers, response parsing and structured errors. Individual API functions sit on top of it and normalize the response.

---

## 6. Navigation System

The `Page` type is defined in [`src/components/Navbar.tsx`](src/components/Navbar.tsx):

```typescript
export type Page = 'home' | 'webshop' | 'simulation';
```

`App.tsx` holds `currentPage` in state and renders the matching page. A QR/deep link (`/join/<code>` or `?session=<code>&role=<role>`) is read once on load and starts on the simulation page.

### How to Add a New Page

1. Add the name to the `Page` union in `Navbar.tsx`.
2. Add an entry to the `navLinks` array in `Navbar.tsx` (`{ label, page }`).
3. Create the page component under `src/pages/`.
4. Add a render branch in `App.tsx`: `{currentPage === 'your-page' && <YourPage />}`.

---

## 7. API Layer

### Request Wrapper — `src/api/requestApi.ts`

```typescript
requestApi<T>(path: string, options?: ApiRequestOptions): Promise<T>
```

- Prepends `getApiBaseUrl()` to the path (`options.baseUrl` overrides it, e.g. for the simulation server).
- Adds `Authorization: Bearer <token>` unless `withAuth: false`. It first awaits `ensureApiKey()`, then takes the token from `getApiAuthToken()`.
- Parses the response as JSON, falls back to plain text, returns `null` for empty bodies.
- Throws `ApiRequestError` (`status`, `path`, `responseBody`) on non-2xx responses.
- If the ERP rejects a stored API key as stale (401, or 404 "key not found"), it drops that key, fetches a new one and retries once.

### Authentication

`getApiAuthToken()` returns the API key stored in `localStorage` (key `api_auth_token`) first and falls back to `VITE_API_AUTH_TOKEN`. The key is fetched on startup by `useApiKeyInit` through `POST /apikey/create` ([`createApiKeyApi`](src/api/apikey/createApiKeyApi.ts)). In simulation mode (join links, customer links) the ERP key is not requested.

### API Functions

| Function                       | Endpoint                              | Notes                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listArticlesApi(signal?)`     | `GET /article/list?sellableOnly=true` | Normalizes field variants (`id`/`article_id`, `description`/`type`, `price`/`unit_price`, `image_url`/`imageUrl`); reads `available_quantity`; drops articles without a valid id; sorts A–Z. |
| `createSaleOrderApi(body)`     | `POST /order/sale/create`             | Body `{ customer_id, products: [{ productId, quantity }] }`; response includes the generated order `id`. Used by checkout.                                                                   |
| `listInventoryApi(signal?)`    | `GET /inventory/list`                 | Falls back to `GET /article/list` on 5xx/network errors (`source: 'article-fallback'`). Not used by the UI.                                                                                  |
| `createPurchaseOrderApi(body)` | `POST /order/purchase/create`         | Not used by the UI.                                                                                                                                                                          |
| `callHealthApi()`              | `GET /health` (`withAuth: false`)     | Not used by the UI.                                                                                                                                                                          |

The simulation endpoints are in [`src/api/simulation/sessionApi.ts`](src/api/simulation/sessionApi.ts); the server side is documented in [`README.md`](README.md) and [`docs/architecture.md`](docs/architecture.md).

---

## 8. State Management

### Cart State — `useCart()`

All cart behaviour lives in [`src/hooks/useCart.ts`](src/hooks/useCart.ts). `App.tsx` calls `useCart()` once and passes the returned values as props.

**State:** `cartItems: CartItem[]`, `isCartOpen`, `isCheckoutOpen`, `cartCount` (total quantity).

**Actions:**

| Method                           | Signature                                       | Behaviour                                                                  |
| -------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| `addToCart`                      | `(article: Article) => void`                    | Adds the article or increments its quantity, capped at `availableQuantity` |
| `removeFromCart`                 | `(articleId: number) => void`                   | Removes the line                                                           |
| `updateQuantity`                 | `(articleId: number, quantity: number) => void` | Sets the quantity (capped at stock); removes the line if quantity ≤ 0      |
| `clearCart`                      | `() => void`                                    | Empties the cart                                                           |
| `openCart` / `closeCart`         | `() => void`                                    | Toggle the cart drawer                                                     |
| `openCheckout` / `closeCheckout` | `() => void`                                    | Toggle the checkout dialog                                                 |

The cart is **not persisted**: a page refresh clears it.

### Other State

- Simulation state is the server's session snapshot, polled by `useSimulationSession` every 1.5 seconds.
- Theme (`dark`/`light` class on `<html>`) and the ERP API key are persisted in `localStorage`; the simulation shop context in `sessionStorage`.

---

## 9. Custom Hooks

All hooks live in [`src/hooks/`](src/hooks/). The webshop-related ones:

| Hook                         | Purpose                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useCart()`                  | Cart state, see [Section 8](#8-state-management).                                                                                                                                               |
| `useWebshopProducts(key?)`   | Loads the sellable articles with their stock (`{ articles, status, errorMessage }`); changing `key` refetches. Aborts in-flight requests on unmount.                                            |
| `usePlaceOrder(sessionId?)`  | Submits the order: `POST /order/sale/create` in ERP mode, `orders/add` on the simulation server when a session id is given. Exposes `status`, `errorMessage`, `orderId`, `placeOrder`, `reset`. |
| `useApiKeyInit(enabled?)`    | Fetches the ERP API key once and stores it in `localStorage`; `enabled = false` skips it (simulation mode).                                                                                     |
| `useTheme()`                 | Light/dark theme, toggles the `dark` class on `<html>`.                                                                                                                                         |
| `useSimulationShopContext()` | Remembers the simulation session and customer name for the shop (`sessionStorage`).                                                                                                             |

The simulation hooks (`useSimulationSession`, `useRoleClaim`, `useCreateSession`, `useSessionStations`, ...) are described in [`docs/architecture.md`](docs/architecture.md).

---

## 10. Pages

### `WebshopPage` — [`src/pages/WebshopPage.tsx`](src/pages/WebshopPage.tsx)

Product grid. Props: `onAddToCart`, `cartItems`, `refreshKey` (refetch after an order), and in simulation mode `simulationSessionId` and `onLeaveSimulation`.

- Outside simulation mode it loads articles via `useWebshopProducts` and renders loading ("Produkte werden geladen…"), error, empty ("Keine Produkte verfügbar.") and grid states.
- With a `simulationSessionId` it shows the static six-variant catalogue (`SIMULATION_CATALOG`) plus a banner and makes no ERP calls.
- Grid: 1 column (mobile) → 2 (`sm`) → 3 (`lg`) → 4 (`xl`).

### Simulation pages

`SimulationPage`, `SimulationDashboardPage` and `SimulationStationPage` are covered in [`docs/architecture.md`](docs/architecture.md).

---

## 11. Components

### `Navbar` — [`src/components/Navbar.tsx`](src/components/Navbar.tsx)

Sticky top bar with logo, page links (Home, Webshop, Simulation), theme toggle and cart button. Props: `currentPage`, `onNavigate`, `cartCount`, `onOpenCart`, `theme`, `onToggleTheme`.

- The cart button is `invisible` (layout preserved) unless the webshop is shown or the cart is not empty; the badge is capped at `99+`.
- Below the `md` breakpoint the links collapse into a hamburger menu.

### `Hero` — [`src/components/Hero.tsx`](src/components/Hero.tsx)

Landing page with the aerial photo (`/bkm-luftbild.jpg`) and two `CTAButton`s: "Zum Webshop" (`outline`, navigates to `'webshop'`) and "Zur Simulation" (`solid`, navigates to `'simulation'`).

### `CTAButton` — [`src/components/CTAButton.tsx`](src/components/CTAButton.tsx)

Call-to-action button with an arrow icon. Props: `label`, `variant` (`'outline'` default, `'solid'`), `onClick`, `disabled`.

### `ProductCard` — [`src/components/webshop/ProductCard.tsx`](src/components/webshop/ProductCard.tsx)

Product tile. Props: `article`, `onAddToCart`, `quantityInCart`, `isSimulation`.

- Price `€X.XX` or "Preis auf Anfrage" and "Lager: n"; both are hidden in simulation mode.
- The add button is disabled with "Nicht verfügbar" at stock 0 and "Max. Menge erreicht" once the cart holds the whole stock; after a click it shows "Hinzugefügt!" briefly.
- Images come from `resolveArticleImage` in `placeholderImage.ts` (falls back to a placeholder).

### Cart components — [`src/components/cart/`](src/components/cart/)

- `CartDrawer`: slide-in sidebar with the item list, total, "Warenkorb leeren" and "Zur Kasse".
- `CheckoutDialog`: modal with the item list and, depending on the mode, the `PaymentMethodPicker` (ERP mode) or the `SimulationOrderForm` (customer name); footer via `CheckoutFooter`. On submit it calls `usePlaceOrder`, shows `OrderConfirmation` on success and calls `onOrderPlaced` (clears the cart, refetches the stock).
- Payment methods (`kreditkarte`, `paypal`, `bankueberweisung`) are a UI-only choice that must be made before submitting; no payment gateway is involved.

The simulation components (dashboard, QR cards, station views) are documented in [`docs/architecture.md`](docs/architecture.md).

---

## 12. TypeScript Types

### `Article` — [`src/api/articles/listArticlesApi.ts`](src/api/articles/listArticlesApi.ts)

```typescript
type Article = {
  id: number;
  name: string;
  description: string;
  price: number | null; // null = "Preis auf Anfrage"
  imageUrl: string | null; // null = use placeholder
  availableQuantity: number;
};
```

### `CartItem` — [`src/types/cart.ts`](src/types/cart.ts)

```typescript
type CartItem = {
  article: Article;
  quantity: number;
};
```

### `PaymentMethod` — [`src/types/checkout.ts`](src/types/checkout.ts)

```typescript
type PaymentMethod = 'kreditkarte' | 'paypal' | 'bankueberweisung';
```

### `CreateSaleOrderRequest` — [`src/api/saleOrders/createSaleOrderApi.ts`](src/api/saleOrders/createSaleOrderApi.ts)

```typescript
interface CreateSaleOrderRequest {
  customer_id: number;
  products: Array<{ productId: number; quantity: number }>;
}
```

### `Page` — [`src/components/Navbar.tsx`](src/components/Navbar.tsx)

```typescript
type Page = 'home' | 'webshop' | 'simulation';
```

### `ApiRequestError` — [`src/api/requestApi.ts`](src/api/requestApi.ts)

```typescript
class ApiRequestError extends Error {
  status: number;
  path: string;
  responseBody: unknown;
}
```

The simulation types shared by server and frontend are in `src/types/simulation.ts` and `src/types/production.ts`.

---

## 13. Styling Guide

### Brand Color

**BKM Red: `#dc2f2f`** is the primary action color (cart badge, "add to cart", "Zur Kasse", order buttons, selection rings). Use the `primary` / `on-primary` tokens (`bg-primary text-on-primary`), backed by `--BKM_WebShop-primary`. Never hard-code the hex.

### Design System Tokens

The design system is documented in [`docs/design-system.md`](docs/design-system.md). Its tokens are `--BKM_WebShop-*` CSS variables in [`src/styles/tokens.css`](src/styles/tokens.css) (light on `:root`, dark via `prefers-color-scheme` or a `.dark` class on `<html>`) and are exposed to Tailwind in [`tailwind.config.js`](tailwind.config.js), which `src/index.css` loads with `@config`:

| Token group | Tailwind utilities                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| Colors      | `bg-bg`, `bg-card`, `text-ink`, `text-ink-muted`, `border-border`, `bg-chip`, `bg-primary`, `accent-*`                 |
| Borders     | `border` (token width, ink colored)                                                                                    |
| Shadows     | `shadow-sticker-press`, `-sticker-sm`, `-sticker`, `-sticker-hover`, `-sticker-md`, `-sticker-lg`, `-sticker-md-hover` |
| Radii       | `rounded-sm/md/lg/xl/full`                                                                                             |
| Spacing     | `p-xxs/xs/sm/md/lg/xl/xxl/xxxl/huge` (also `m-*`, `gap-*`)                                                             |

The Navbar logo is the `BkmLogo` SVG component, which takes its fills from the tokens. The theme toggle is `useTheme` (`src/hooks/useTheme.ts`).

Do not use raw palette classes (`slate-*`, `white`) or hex values in components. `--BKM_WebShop-primary` and `on-primary` are project extensions to the design system.

### Fonts

Imported from Google Fonts in [`src/index.css`](src/index.css): **Space Grotesk** (primary, 400–700) and **Spline Sans** (secondary, 400–600).

---

## 14. Development Conventions

### Component Structure

- **Named function declarations** (not arrow functions): `function MyComponent() { ... }`
- **Props typed inline** directly above the component: `type Props = { ... }`
- **Default export at the bottom** of the file
- Page-specific components live under `src/components/<page>/` (e.g. `src/components/webshop/`)
- Groups of components in a folder expose a barrel `index.ts`

### Path Alias

`@` resolves to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`):

```typescript
import { useCart } from '@/hooks/useCart';
import type { Article } from '@/api/articles/listArticlesApi';
```

### Strict TypeScript

`tsconfig.app.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` and `erasableSyntaxOnly` (no `enum`, no `namespace`). Do not use `any`, `unknown` without type guards, or bare `as` casts.

### Styling Rules

- **Tailwind utility classes only** — no inline styles, no CSS modules (unless Tailwind is genuinely insufficient)
- Variant maps (like in `CTAButton`) keep all class strings co-located
- User-facing text is German and hardcoded; there is no i18n library

### Testing

- Tests are co-located (`Component.test.tsx`, `module.test.ts`) and use Vitest with React Testing Library; setup is in `src/test/setup.ts`, shared helpers in `src/test/`.
- Query by role/label/text, assert user-visible behaviour, and use `user-event` for interaction.
- `npm run test:coverage` enforces the thresholds in `vite.config.ts` (statements 90, branches 85, functions 90, lines 90).
- The live scenarios in `src/e2e/` are skipped unless `VITE_E2E_API_BASE_URL` points at a running simulation server.

### API Convention

- Every API function gets its own file under `src/api/<domain>/`
- Raw responses are normalized inside the API function — consumers never see raw backend shapes
- Use `AbortSignal` for requests triggered from `useEffect` to support cleanup

### Code Comments

Comments explain _why_, not _what_. Only add a comment for hidden constraints, subtle invariants, or deliberate workarounds.

---

## 15. Docker & Deployment

### Dockerfile (Multi-Stage)

```
Stage 1 (builder): node:26-alpine
  - npm ci
  - npm run build → dist/

Stage 2 (runtime): node:26-alpine
  - copies dist/, server/ and the shared src/types/simulation.ts + production.ts
  - runs one Node process (node server/index.ts) as user "node" that serves the SPA and the
    simulation API on port 8080 (PORT=8080, STATIC_DIR=/app/dist)
  - HEALTHCHECK requests /health every 30s
```

Build args (`VITE_API_BASE_URL`, `VITE_API_AUTH_TOKEN`, `VITE_PUBLIC_BASE_URL`, `VITE_SIMULATION_API_BASE_URL`, `VITE_COMMIT_SHA`) are injected at build time and baked into the static JS bundle. In CI the first two come from repository secrets, the optional ones from repository variables (empty means the default behaviour), and the commit SHA from the workflow.

### docker-compose.yml

The compose file does not build locally. It runs the image published to GHCR (`ghcr.io/berufskolleg-meschede/webshop-react:latest`), publishes host port `51020` to container port `8080`, joins the external `SmartFactory` network and carries the Traefik labels (`Host(${WEBSHOP_HOST:-webshop.local})`). A Watchtower container polls every 60s and updates containers labelled `com.centurylinklabs.watchtower.enable=true`. Deployment details and the acceptance checklist are in [`README.md`](README.md) and [`docs/NAS-Abnahme.md`](docs/NAS-Abnahme.md).

### CI

- `.github/workflows/ci.yml` (pull requests and pushes to `main`, Node 24): `npm ci`, `npm run lint`, `npm run format:check`, `npm run test:coverage`, `npm run build`.
- `.github/workflows/docker-publish.yml` (push to `main`) builds and publishes the image to GHCR.

To build and run locally instead:

```bash
docker build --build-arg VITE_API_BASE_URL=http://localhost:8000 -t webshop-react .
docker run -p 3000:8080 webshop-react
```

**Important:** Because Vite embeds env vars at build time, changing a `VITE_*` value requires a full rebuild — you cannot hot-swap it at runtime.

---

## 16. Known Limitations

- **No secrets in the bundle:** `VITE_API_AUTH_TOKEN` and every other `VITE_*` value are visible to every visitor. The ERP API key is fetched at runtime and stored in `localStorage`.
- **Simulation state is in memory:** one server process holds all sessions, so it must not be scaled out, and a restart ends running sessions.
- **Cart is not persisted** across page reloads.
- **Payment is UI-only:** the payment method choice is not sent anywhere; no payment gateway is integrated.
- **No i18n:** all user-facing strings are hardcoded in German.
- **Unused API modules:** `listInventoryApi`, `createPurchaseOrderApi` and `callHealthApi` exist but no UI uses them.
