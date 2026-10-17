import type { Batch, ShakerVariant, SimulationSession, StationId } from './simulation.ts';
import {
  VARIANTS,
  getOpenQuantity,
  getProducedQuantity,
  getStoredQuantity,
  getTargets,
  getTotalTarget,
  isProductionDone,
  sum,
} from './simulationRules.ts';

export { VARIANTS, getTargets, isSupplyDone, sum } from './simulationRules.ts';

/** Cap for the daily plan and the summed customer orders per variant (client and server). */
export const MAX_DAILY_QUANTITY = 999;
/** Cap for one customer order line per variant (ADR-SIM-03: 1-99). */
export const MAX_ORDER_LINE_QUANTITY = 99;

/** Splits `S-RT` into its content (`S`/`P`) and housing colour (`RT`/`SI`/`SW`). */
export function parseVariant(variant: ShakerVariant): {
  content: 'S' | 'P';
  color: 'RT' | 'SI' | 'SW';
} {
  const [content, color] = variant.split('-') as ['S' | 'P', 'RT' | 'SI' | 'SW'];
  return { content, color };
}

/** Station names by station id, shared by the dashboard, the station header and the roles. */
export const STATION_NAMES: Record<StationId, string> = {
  1: 'Zulieferung Deckel',
  2: 'Zulieferung Gehäuse',
  3: 'Produktion',
  4: 'Einlagerung',
  5: 'Auslagerung',
};

/** Housing colour names by colour key (nominative, capitalised). */
export const COLOR_WORDS = { RT: 'Rot', SI: 'Silber', SW: 'Schwarz' } as const;
/** Lid colour names by content key. */
export const LID_COLOR_WORDS = { S: 'Blau', P: 'Grün' } as const;

const CONTENT_LABELS = { S: 'Salz (Deckel blau)', P: 'Pfeffer (Deckel grün)' } as const;
const COLOR_LABELS = { RT: 'Gehäuse rot', SI: 'Gehäuse silber', SW: 'Gehäuse schwarz' } as const;

export function getVariantLabel(variant: ShakerVariant): string {
  const { content, color } = parseVariant(variant);
  return `${CONTENT_LABELS[content]} · ${COLOR_LABELS[color]}`;
}

export type VariantProgress = {
  variant: ShakerVariant;
  target: number;
  produced: number;
  open: number;
  status: 'OPEN' | 'IN_PRODUCTION' | 'DONE';
};

export function getProductionProgress(session: SimulationSession): VariantProgress[] {
  const targets = getTargets(session);
  return VARIANTS.map((variant) => {
    const target = targets[variant] ?? 0;
    const produced = getProducedQuantity(session, variant);
    const open = getOpenQuantity(session, variant);
    let status: VariantProgress['status'] = 'OPEN';
    if (open === 0) status = 'DONE';
    else if (produced > 0) status = 'IN_PRODUCTION';
    return { variant, target, produced, open, status };
  }).filter((progress) => progress.target > 0);
}

/** Push only: the whole daily plan is produced. A hint for the teacher, never an end condition. */
export function isPushPlanDone(session: SimulationSession): boolean {
  if (session.strategy !== 'PUSH') return false;
  const progress = getProductionProgress(session);
  return progress.length > 0 && progress.every((entry) => entry.open === 0);
}

/** Valid batch size: a whole number from 1 up to what is still open. */
export function validateBatchQuantity(quantity: number, open: number): string | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'Bitte eine ganze Zahl ab 1 eingeben.';
  if (quantity > open) return `Es sind nur noch ${open} Stück offen.`;
  return null;
}

/** Station 4 progress: stored pieces against the whole order. */
export function getStorageProgress(session: SimulationSession): { stored: number; target: number } {
  return { stored: getStoredQuantity(session), target: getTotalTarget(session) };
}

export type StorageOutlook = {
  stored: number;
  /** Stored pieces plus this batch, once it is stored. */
  withBatch: number;
  target: number;
  /** Pieces per variant that would still be missing after storing this batch. */
  missing: { variant: ShakerVariant; quantity: number }[];
};

/** What storing one incoming batch achieves: progress "with this batch" and the remaining parts. */
export function getBatchStorageOutlook(session: SimulationSession, batch: Batch): StorageOutlook {
  const targets = getTargets(session);
  const { stored, target } = getStorageProgress(session);
  const missing = VARIANTS.map((variant) => {
    const storedOfVariant = session.batches
      .filter((b) => b.variant === variant && b.status === 'STORED')
      .reduce((total, b) => total + b.quantity, 0);
    const incoming = batch.variant === variant ? batch.quantity : 0;
    return { variant, quantity: Math.max((targets[variant] ?? 0) - storedOfVariant - incoming, 0) };
  }).filter((entry) => entry.quantity > 0);
  return { stored, withBatch: stored + batch.quantity, target, missing };
}

/** Station 4 may report between 1 and all pieces of a batch as missing or damaged. */
export function validateMissingQuantity(missing: number, batchQuantity: number): string | null {
  if (!Number.isInteger(missing) || missing < 1) return 'Bitte eine ganze Zahl ab 1 eingeben.';
  if (missing > batchQuantity) return `Die Charge hat nur ${batchQuantity} Stück.`;
  return null;
}

export type RetrievalProgress = {
  variant: ShakerVariant;
  demand: number;
  retrieved: number;
  open: number;
};

/** Station 5 serves the total order (`daily_orders`) in Push and Pull alike, independent of stock. */
export function getRetrievalProgress(session: SimulationSession): RetrievalProgress[] {
  return VARIANTS.map((variant) => {
    const demand = session.daily_orders[variant] ?? 0;
    const retrieved = session.retrieved[variant] ?? 0;
    const open = Math.max(demand - retrieved, 0);
    return { variant, demand, retrieved, open };
  }).filter((progress) => progress.demand > 0);
}

export type SessionSummary = {
  produced: number;
  replenishmentBatches: number;
  replenishmentUnits: number;
  retrieved: number;
  demand: number;
};

/** Teacher KPIs for a finished day (no timing: the didactic concept has no stopwatch). */
export function getSessionSummary(session: SimulationSession): SessionSummary {
  const kept = session.batches.filter((batch) => batch.status !== 'REJECTED');
  const replenishment = kept.filter((batch) => batch.is_replenishment);
  return {
    produced: sum(kept.map((batch) => batch.quantity)),
    replenishmentBatches: replenishment.length,
    replenishmentUnits: sum(replenishment.map((batch) => batch.quantity)),
    retrieved: sum(VARIANTS.map((variant) => session.retrieved[variant] ?? 0)),
    demand: sum(VARIANTS.map((variant) => session.daily_orders[variant] ?? 0)),
  };
}

export const BUTTON_FINISH_DAY = 'Beenden';
/** Pull: Station 5 after the whole order is retrieved (station COMPLETED). */
export const STATION5_FINISHED_TEXT = 'Warte auf Tagesabschluss';
export const HEADLINE_DAY_ABORTED = 'Tag abgebrochen';
export const LINE_DAY_NOT_FULFILLED = 'Tag nicht vollständig erfüllt';
export const BUTTON_FINISH_DAY_SHORTFALLS = 'Tag mit Fehlständen abschließen';

/** Push flow: Station 5 can end the day with shortfalls once production is done (same rule as the server). */
export function isProductionAndStorageFinished(session: SimulationSession): boolean {
  return isProductionDone(session);
}

/** True when the finished day left any ordered quantity unretrieved. */
export function hasOpenShortfall(session: SimulationSession): boolean {
  return Object.values(session.shortfall ?? {}).some((quantity) => (quantity ?? 0) > 0);
}
