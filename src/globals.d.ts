/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMMIT_SHA: string;
  readonly VITE_PUBLIC_BASE_URL?: string;
  /** Origin of the simulation server; defaults to the app's own origin. */
  readonly VITE_SIMULATION_API_BASE_URL?: string;
  /** Test only: base URL of a running backend for `npm run test:e2e`. */
  readonly VITE_E2E_API_BASE_URL?: string;
}
