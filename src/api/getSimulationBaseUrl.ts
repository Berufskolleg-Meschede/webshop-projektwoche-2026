/**
 * The simulation runs on the webshop's own server (not the ERP). By default it is reached on the
 * same origin as the app (nginx/Node in production, the Vite proxy in dev).
 */
export default function getSimulationBaseUrl(): string {
  const baseUrl = (import.meta.env.VITE_SIMULATION_API_BASE_URL as string | undefined)?.trim();
  return (baseUrl || window.location.origin).replace(/\/+$/, '');
}
