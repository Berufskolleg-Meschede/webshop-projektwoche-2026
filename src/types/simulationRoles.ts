import { STATION_NAMES } from './production';
import type { StationId } from './simulation';

export type SimulationRole =
  | 'customer'
  | 'station1_lids'
  | 'station2_housings'
  | 'station3_production'
  | 'station4_storage'
  | 'station5_retrieval';

export type RoleInfo = {
  role: SimulationRole;
  label: string;
  /** Short description of a station, folded into its title; `null` for customers. */
  sub: string | null;
  /** `null` for customers: any number may join and they need no claim. */
  stationId: StationId | null;
};

export const ROLES: RoleInfo[] = [
  { role: 'customer', label: 'Kunde', sub: null, stationId: null },
  { role: 'station1_lids', label: 'Station 1 – Deckel', sub: STATION_NAMES[1], stationId: 1 },
  {
    role: 'station2_housings',
    label: 'Station 2 – Gehäuse',
    sub: STATION_NAMES[2],
    stationId: 2,
  },
  {
    role: 'station3_production',
    label: 'Station 3 – Produktion',
    sub: STATION_NAMES[3],
    stationId: 3,
  },
  {
    role: 'station4_storage',
    label: 'Station 4 – Einlagerung',
    sub: STATION_NAMES[4],
    stationId: 4,
  },
  {
    role: 'station5_retrieval',
    label: 'Station 5 – Auslagerung',
    sub: STATION_NAMES[5],
    stationId: 5,
  },
];

/** "Station 3 – Produktion" → "Station 3". */
export function getRoleShortName(info: RoleInfo): string {
  return info.label.split(' – ')[0];
}

/** One-line role title: "Kunde" or "Station 1 · Zulieferung Deckel". */
export function getRoleTitle(info: RoleInfo): string {
  return info.sub === null ? info.label : `${getRoleShortName(info)} · ${info.sub}`;
}

export function parseRole(value: string | null): RoleInfo | null {
  return ROLES.find((info) => info.role === value) ?? null;
}

export function buildRoleLink(baseUrl: string, sessionId: string, role: SimulationRole): string {
  const params = new URLSearchParams({ session: sessionId, role });
  return `${baseUrl}/?${params.toString()}`;
}

/** The one link for everyone: `<base>/join/<code>` opens the join page (name + role). */
export function buildJoinLink(baseUrl: string, sessionId: string): string {
  return `${baseUrl}/join/${sessionId}`;
}

/** A session code is exactly four digits. */
export const SESSION_CODE_PATTERN = /^\d{4}$/;

export function isSessionCode(value: string): boolean {
  return SESSION_CODE_PATTERN.test(value);
}

/** Session code of a `/join/<4 digits>` path, else `null`. */
export function parseJoinPath(pathname: string): string | null {
  const code = /^\/join\/([^/]+)\/?$/.exec(pathname)?.[1];
  return code && isSessionCode(code) ? code : null;
}
