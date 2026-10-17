# BKM Webshop React

> **Hinweis:** Dieses Repository ist nur zu Demonstrationszwecken öffentlich. Das Projekt wird nicht weiter gepflegt: Es gibt keine Updates und keine Bearbeitung von Issues oder Pull Requests.

Frontend und Simulationsserver für den BKM-Webshop auf Basis von **React 19**, **TypeScript**, **Vite** und **Tailwind CSS**.

Die Anwendung enthält aktuell:

- eine Landing Page (`Home`)
- eine Webshop-Seite mit Produktliste aus der API (ERP-Anbindung)
- Warenkorb (Drawer), Checkout-Dialog und Bestellbestätigung (Verkaufsbestellung wird an die API gesendet)
- eine **Simulation** der Industrie-4.0-Produktion (Lehrkraft-Dashboard, ein Beitritts-QR-Code für alle, Stationen 1–5, Kunden-Webshop) – ohne ERP, mit eigenem Node-Server
- Light-/Dark-Theme-Umschalter
- API-Module für Artikel, Inventory, Health, Verkaufs- und Einkaufsbestellungen, API-Key und Simulation

---

## Inhaltsverzeichnis

- [Projektüberblick](#projektüberblick)
- [Technologie-Stack](#technologie-stack)
- [Funktionen](#funktionen)
- [Simulation – Kurzanleitung für Lehrkräfte](#simulation--kurzanleitung-für-lehrkräfte)
- [Projektstruktur](#projektstruktur)
- [Setup & Start](#setup--start)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Verfügbare Skripte](#verfügbare-skripte)
- [API-Anbindung](#api-anbindung)
- [Deployment](#deployment)
- [CI](#ci)
- [Architektur-Notizen](#architektur-notizen)

---

## Projektüberblick

Dieses Repository enthält ein Single-Page-Frontend (SPA) für einen Webshop-Kontext **und** einen kleinen Node-Server (`server/`), der die Simulation hält und im Betrieb zusätzlich die gebaute SPA ausliefert.
Die Navigation läuft ohne Router über lokalen React-State (`home` / `webshop` / `simulation`).

Zwei Betriebsarten:

- **Webshop (ERP):** Artikel und Bestellungen laufen über das ERP-Backend (`VITE_API_BASE_URL`).
- **Simulation (ohne ERP):** Zustand liegt im Arbeitsspeicher des Simulationsservers; der Webshop zeigt im Simulationsmodus einen festen Katalog mit sechs Varianten und ruft keine ERP-Endpunkte auf.

---

## Technologie-Stack

- **React 19**
- **TypeScript**
- **Vite**
- **Tailwind CSS 4** (`@tailwindcss/vite`)
- **Node-Server** (`server/`, ohne Framework, startet mit `node server/index.ts`)
- **Vitest + React Testing Library**
- **ESLint + Prettier**
- **lucide-react** (Icons), **qrcode.react** (QR-Codes)

---

## Funktionen

### UI / Seiten

- **Navbar** mit Navigation zu `Home`, `Webshop` und `Simulation`, Warenkorb-Button und Theme-Toggle (`useTheme`)
- **BkmLogo** als Inline-SVG, theme-fähig über Design-Tokens
- **Hero/Landing-Bereich** mit Call-to-Action Buttons
- **WebshopPage**
  - ERP-Modus: lädt Artikel von der Backend-API, Loading-/Error-/Empty-States, responsives Produkt-Grid
  - Simulationsmodus (`?session=<4 Ziffern>&role=customer` oder `?mode=simulation&session=…`): statischer Katalog, Banner, Bestellung geht an den Simulationsserver
- **ProductCard**
  - Name, Beschreibung, Preis, Lagerbestand, Bild
  - Fallback-Bild bei fehlendem Artikelbild
- **Warenkorb** (`CartDrawer`, State in `useCart`)
- **Checkout** (`CheckoutDialog`) mit Bestellübermittlung über `usePlaceOrder` und **OrderConfirmation**
- **SimulationPage** (Einstieg), **SimulationDashboardPage** (Lehrkraft), **SimulationStationPage** (Schüler:innen pro Station)

### Simulation

- Session mit 4-stelligem Code, **ein** Beitritts-QR-Code und Link für alle (`/join/<code>`: Benutzername eingeben, freie Rolle wählen), Stationen 1–5 je einmal besetzbar, Kunde beliebig oft. Ältere Rollenlinks (`?session=<code>&role=<rolle>`) funktionieren weiter.
- Lehrkraft-Dashboard: Pull/Push, Tagesauftrag, Vorab-Prüfung, Start / Beenden / Zurücksetzen, Tagesbestellungstabelle, Abschlussbericht
- Stationen: Material (1 Deckel, 2 Gehäuse), Produktion in Chargen (3), Prüfung und Einlagerung mit Abweichungsmeldung (4), Auslagerung (5)
- Live-Zustand per Polling (`useSimulationSession`, alle 1,5 s)

### API-Logik

- zentraler Request-Wrapper mit einheitlichem Fehlerobjekt (`ApiRequestError`)
- Konfiguration der Base-URL per Environment Variable
- Auth-Token: automatisch beim Start abgerufener API-Key (`useApiKeyInit`, in `localStorage`), alternativ `VITE_API_AUTH_TOKEN`. Beim Einstieg über einen Simulationslink wird kein ERP-API-Key angefordert.
- Endpunkte (ERP):
  - Artikel-Liste
  - Inventory (inkl. Fallback auf Artikel-Endpunkt bei Serverfehlern)
  - Health
  - Sale Order (POST) und Purchase Order (POST)
  - API-Key erzeugen
- Endpunkte (Simulationsserver): siehe [API-Anbindung](#api-anbindung)

---

## Simulation – Kurzanleitung für Lehrkräfte

Die Simulation läuft **nur im Webshop** (kein ERP-Backend): ein kleiner Node-Server (`server/`) hält den Zustand im Arbeitsspeicher und liefert zusätzlich die Webseite aus.

1. **Starten:** Container/Server starten und die Seite im Schulnetz öffnen. Entwicklung: `npm run server` und `npm run dev`.
2. **Session erstellen:** Menü _Simulation_ → _Session erstellen_. Es entsteht ein 4-stelliger Code.
3. **Konfigurieren** (nur vor dem Start): Produktionsprinzip _Pull_ oder _Push_ wählen, den Tagesauftrag eintragen (bei _Push_ zusätzlich die Tages-Produktionsmenge). Es gibt keinen Speichern-Schritt: die Einstellungen gehen beim Start gebündelt an den Server und bleiben für die Folgetage erhalten.
4. **Teilnehmende beitreten lassen:** Im Dashboard den _QR-Code anzeigen_ der Karte _Teilnehmende beitreten lassen_ (oder den Link `/join/<Code>` kopieren): ein Code für alle. Schüler:innen scannen ihn mit dem Smartphone, tragen einen Benutzernamen ein und wählen eine freie Rolle: Stationen 1–5 sind je einmal besetzbar (belegte sind gesperrt), _Kunde_ beliebig oft und öffnet den WebShop im Simulationsmodus. Die Kacheln unter _Besetzung_ zeigen live: grau = frei, gelb = verbunden, grün = aktiv.
5. **Start:** _Tag simulieren_. Der Start ist gesperrt, solange kein Auftrag vorliegt oder – außer im **Demo-Modus** – Stationen unbesetzt sind. Danach _Beenden_ (mit Rückfrage); _Zurücksetzen_ fragt nach und öffnet die Konfiguration wieder.
6. **Ablauf:** Station 1 & 2 stellen Deckel und Gehäuse bereit → Station 3 produziert in frei wählbaren Chargen → Station 4 prüft und lagert ein (Abweichungen gehen zur Nachproduktion zurück an Station 3) → Station 5 lagert aus. Pull: Station 5 wartet auf den vollständig eingelagerten Auftrag; Push: Station 5 startet sofort nach Station 1 & 2.
7. **Abschluss:** Ist der Auftrag vollständig ausgelagert, erscheint auf allen Geräten der Erfolgsbildschirm; im Dashboard steht die Zusammenfassung. Den Rohzustand zeigt _Rohzustand (JSON) anzeigen_.

**Wichtig für den Betrieb:** Sessions liegen im Speicher – ein Neustart des Containers (auch durch Watchtower) beendet laufende Sessions. Der Server darf nur als **ein** Prozess laufen. Damit die QR-Codes auf den Handys funktionieren, muss das Dashboard über die Netzwerkadresse (nicht `localhost`) geöffnet werden oder `VITE_PUBLIC_BASE_URL` gesetzt sein.

---

## Projektstruktur

```text
server/                      # Simulationsserver (Node, ein Prozess)
  index.ts                   # Start, Port, statische Auslieferung von dist/
  app.ts                     # HTTP-Routen /simulation/…, /health
  engine.ts                  # Zustandsmaschine der Simulation
scripts/
  nas-smoke-test.sh          # Smoke-Test gegen ein laufendes Deployment
docs/
  architecture.md            # Architektur, Simulationsmodell, API
  design-system.md           # Design-Tokens
  NAS-Abnahme.md             # Abnahme-Checkliste Synology
src/
  api/
    apikey/ articles/ health/ inventory/ purchaseOrders/ saleOrders/
    simulation/              # Client für den Simulationsserver (sessionApi.ts)
    requestApi.ts
    getApiBaseUrl.ts
    getApiAuthToken.ts
    getPublicBaseUrl.ts
    getSimulationBaseUrl.ts
  components/
    webshop/                 # ProductCard, SimulationBanner
    cart/                    # CartDrawer, CheckoutDialog, OrderConfirmation
    simulation/              # Dashboard-Teile, QR, Rollen, Berichte
      stations/              # Ansichten und Dialoge der Stationen 1–5
    logo/BkmLogo.tsx
    Navbar.tsx  Hero.tsx  CTAButton.tsx
  hooks/
    useApiKeyInit.ts  useCart.ts  usePlaceOrder.ts  useTheme.ts  useWebshopProducts.ts
    useSimulationSession.ts  useRoleClaim.ts  useSimulationShopContext.ts  usePendingAction.ts
  pages/
    WebshopPage.tsx  SimulationPage.tsx  SimulationDashboardPage.tsx  SimulationStationPage.tsx
  types/                     # cart, checkout, simulation, simulationRoles, simulationCatalog,
                             # production, materialSupply, preflight
  e2e/                       # Live-Szenarien gegen den Simulationsserver
  styles/tokens.css
  App.tsx
  main.tsx
```

---

## Setup & Start

### Voraussetzungen

- Node.js 22.22+ (jsdom/Vitest benötigen mindestens 22.22, 24 empfohlen; CI nutzt 24, das Docker-Image Node 26)
- npm 10+ (empfohlen)

### Installation

Für reproduzierbare Installationen (CI/Team-Setup):

```bash
npm ci
```

Alternative für lokale Erstinstallation:

```bash
npm install
```

### Entwicklungsserver starten

```bash
npm run dev
```

Danach ist die App über die von Vite ausgegebene URL erreichbar (typisch `http://localhost:5173`).

### Simulation lokal

```bash
npm run server   # Simulationsserver auf Port 3001
npm run dev      # Vite; leitet /simulation an Port 3001 weiter
```

Ohne ERP-Backend funktionieren damit Simulation und Simulations-Webshop vollständig.

---

## Umgebungsvariablen

Alle clientseitigen Vite-Variablen müssen mit `VITE_` beginnen und landen im Client-Bundle (öffentlich sichtbar).

Vorlage: `.env.example` nach `.env` kopieren (`.env` wird nicht committet). Beispiel:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_API_AUTH_TOKEN=
```

| Variable                       | Wo                   | Bedeutung                                                                                        |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL`            | Frontend             | Basis-URL des ERP-Backends (Standard `http://localhost:8000`)                                    |
| `VITE_API_AUTH_TOKEN`          | Frontend             | optionales Bearer-Token als Fallback, falls kein API-Key in `localStorage` liegt                 |
| `VITE_PUBLIC_BASE_URL`         | Frontend             | Ursprung im Beitritts-QR-Code (muss von den Handys erreichbar sein); Standard: aktuelle Origin   |
| `VITE_SIMULATION_API_BASE_URL` | Frontend             | nur für einen separaten Simulationsserver; Standard: eigene Origin (Dev: Vite-Proxy auf `:3001`) |
| `PORT`                         | Server               | Port des Simulationsservers (Standard `3001`, im Container `8080`)                               |
| `STATIC_DIR`                   | Server               | Verzeichnis der gebauten SPA (Standard `dist`; im Container `/app/dist`)                         |
| `CORS_ORIGINS`                 | Server               | kommagetrennte Origins, nur bei separatem Frontend; sonst leer lassen                            |
| `WEBSHOP_HOST`                 | `docker-compose.yml` | Hostname, den Traefik zum Container routet (Standard `webshop.local`)                            |

---

## Verfügbare Skripte

```bash
npm run dev           # Entwicklungsserver (HMR)
npm run build         # TypeScript Build + Vite Production Build
npm run lint          # ESLint
npm run preview       # Lokale Vorschau des Production Builds
npm test              # Tests (Vitest, einmaliger Lauf)
npm run test:watch    # Tests im Watch-Modus
npm run test:coverage # Tests mit Coverage-Report (Schwellwerte in der CI)
npm run server        # Simulationsserver (Node, Port 3001)
npm run test:e2e      # Live-Szenarien Pull/Push/Replenishment; braucht VITE_E2E_API_BASE_URL=http://127.0.0.1:3001, sonst übersprungen
npm run format        # Prettier (schreibt Änderungen)
npm run format:check  # Prettier Check ohne Schreiben
```

Tests laufen mit **Vitest** und **React Testing Library** (`*.test.ts(x)` neben dem Code, Setup in `src/test/setup.ts`, gemeinsame Testdaten in `src/test/fixtures.ts`) und sind Teil der CI.

---

## API-Anbindung

### ERP-Backend

Der Request-Flow läuft über `src/api/requestApi.ts`:

1. Base-URL ermitteln (`getApiBaseUrl`)
2. optional Authorization Header setzen (`getApiAuthToken`: API-Key aus `localStorage`, sonst `VITE_API_AUTH_TOKEN`)
3. Antwort parsen (JSON oder Text)
4. bei HTTP-Fehlern `ApiRequestError` werfen

Genutzte Endpunkte:

- `GET /article/list?sellableOnly=true` (Webshop)
- `GET /inventory/list` (Fallback: `GET /article/list`)
- `POST /order/sale/create` (Checkout)

Weitere API-Module (noch ohne UI):

- `GET /health`
- `POST /order/purchase/create`

### Simulationsserver

Client: `src/api/simulation/sessionApi.ts`, Server: `server/app.ts`. Alle Pfade unter `/simulation/session/…`:

- `POST /create`, `GET /{id}` (Zustand, wird gepollt)
- `POST /{id}/state` (RUNNING / FINISHED), `/config`, `/reset`, `/next-day` (nur nach einem beendeten Tag: löscht Bestellungen und Fortschritt des Tages, behält Rollen, Teilnehmer, Strategie und Plan)
- `POST /{id}/claim`, `/release`, `/customer-join`, `/orders/add`
- `POST /{id}/stations/{1|2}/complete`, `/stations/3/produce-batch`, `/stations/4/store-batch`, `/stations/4/report-deviation`, `/stations/5/retrieve-item`, `/stations/5/finish-day`

Zusätzlich liefert der Server `GET /health` (`{"status":"ok"}`) und die gebaute SPA inklusive Fallback auf `index.html`.

---

## Deployment

Das Deployment besteht aus **einem Anwendungs-Container** plus **einem Watchtower-Container** (`docker-compose.yml`, Netzwerk `SmartFactory`):

| Container    | Zweck                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------- |
| `frontend`   | **ein** Node-Prozess: liefert die SPA und den Simulationsserver aus (Container-Port `8080`) |
| `watchtower` | prüft alle 60 s auf ein neues Image und startet `frontend` neu (`--cleanup`)                |

- **Image:** `ghcr.io/berufskolleg-meschede/webshop-react:latest`, gebaut aus dem `Dockerfile` (Multi-Stage, `node:26-alpine`, läuft als User `node`, Healthcheck auf `/health`).
- **Ports:** `51020` (NAS) → `8080` (Container). Erreichbar unter `http://<nas-lan-ip>:51020`.
- **Traefik:** Labels routen `Host(${WEBSHOP_HOST:-webshop.local})` auf den Container; wirksam nur, wenn eine Traefik-Instanz im Netzwerk `SmartFactory` läuft. `WEBSHOP_HOST` in der `.env` neben der Compose-Datei setzen.
- **Nur ein Prozess/Container:** Sessions liegen im Arbeitsspeicher, nicht skalieren. Ein Neustart (auch durch Watchtower nach einem Push auf `main`) beendet laufende Sessions – Updates nicht während des Unterrichts einspielen.
- **Build-Args:** `VITE_API_BASE_URL`, `VITE_API_AUTH_TOKEN` (GitHub-Secrets), optional `VITE_PUBLIC_BASE_URL` und `VITE_SIMULATION_API_BASE_URL` (GitHub-Variablen, leer = Standardverhalten), `VITE_COMMIT_SHA` (Commit des Builds).
- **Abnahme:** `scripts/nas-smoke-test.sh http://<nas-lan-ip>:51020` (automatisch) und die Checkliste in [`docs/NAS-Abnahme.md`](docs/NAS-Abnahme.md) (manuell mit Handys).

---

## CI

- GitHub Actions `ci.yml`: Lint, Format-Check, Tests, Build bei Pull Requests und Pushes auf `main` (Node 24)
- `docker-publish.yml` baut bei jedem Push auf `main` das Image nach GHCR. Der Job ist unabhängig von `ci.yml`: ein rotes `main` wird trotzdem veröffentlicht, deshalb nur mit grüner CI mergen.
- Dependabot für npm, GitHub Actions und Docker

---

## Architektur-Notizen

- Pfadalias `@` zeigt auf `src/` (siehe `vite.config.ts`)
- Styling mit Tailwind Utility-Klassen (Tailwind 4, Konfiguration über `@config` in `src/index.css`)
- Design-System-Tokens: `docs/design-system.md` → `src/styles/tokens.css` → `tailwind.config.js`
- Kein globales State-Management; Warenkorb-State in `useCart` (in `App.tsx` instanziiert), Simulationszustand in `useSimulationSession`
- Weiterführende Doku: `DEVELOPER_GUIDE.md`, `docs/architecture.md`, `docs/design-system.md`, `docs/NAS-Abnahme.md`
- Mitarbeit und Sicherheit: `CONTRIBUTING.md`, `SECURITY.md`
- Navigation zustandsbasiert in `App.tsx` (kein Router): `Page = 'home' | 'webshop' | 'simulation'`
- Der Simulationsserver und das Frontend teilen `src/types/simulation.ts` und `src/types/production.ts`
