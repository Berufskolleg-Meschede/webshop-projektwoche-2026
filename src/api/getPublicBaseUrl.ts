/**
 * Origin that phones scan via QR code. Set `VITE_PUBLIC_BASE_URL` to the NAS LAN address
 * (e.g. http://<host>:51020) — `localhost` is unreachable from a student's phone.
 */
export default function getPublicBaseUrl(): string {
  const baseUrl = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.trim();
  return (baseUrl || window.location.origin).replace(/\/+$/, '');
}
