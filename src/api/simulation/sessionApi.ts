import getSimulationBaseUrl from '../getSimulationBaseUrl';
import requestApi from '../requestApi';
import type {
  ClaimStationRequest,
  OrderItem,
  ProduceBatchRequest,
  SessionConfigRequest,
  SimulationSession,
  SimulationState,
  StationId,
} from '@/types/simulation';

/** The simulation server needs no ERP API key and lives on its own base URL. */
const REQUEST_DEFAULTS = () => ({ withAuth: false, baseUrl: getSimulationBaseUrl() });

const JSON_HEADERS = { 'Content-Type': 'application/json' };

type RawSession = Omit<SimulationSession, 'session_id' | 'ended_by_teacher'> & {
  session_id: string | number;
  ended_by_teacher?: boolean;
};

/** The backend issues numeric 4-digit codes; the UI treats them as strings (keeps leading zeros). */
function normalizeSession(raw: RawSession): SimulationSession {
  return {
    ...raw,
    session_id: String(raw.session_id),
    run_id: raw.run_id ?? 1,
    stations: raw.stations ?? [],
    customer_count: raw.customer_count ?? 0,
    batches: raw.batches ?? [],
    replenishment_queue: raw.replenishment_queue ?? [],
    orders: raw.orders ?? [],
    stock: raw.stock ?? {},
    retrieved: raw.retrieved ?? {},
    ended_by_teacher: raw.ended_by_teacher ?? false,
    shortfall: raw.shortfall ?? {},
    carried_over: raw.carried_over ?? {},
    daily_orders: raw.daily_orders ?? {},
  };
}

function sessionPath(sessionId: string, action = '') {
  return `/simulation/session/${encodeURIComponent(sessionId)}${action}`;
}

function post(path: string, body?: unknown) {
  return requestApi<RawSession>(path, {
    ...REQUEST_DEFAULTS(),
    method: 'POST',
    headers: JSON_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(normalizeSession);
}

export function createSessionApi() {
  return post('/simulation/session/create');
}

export function getSessionApi(sessionId: string, signal?: AbortSignal) {
  return requestApi<RawSession>(sessionPath(sessionId), { ...REQUEST_DEFAULTS(), signal }).then(
    normalizeSession
  );
}

export function setSessionStateApi(sessionId: string, state: SimulationState) {
  return post(sessionPath(sessionId, '/state'), { state });
}

export function claimStationApi(sessionId: string, body: ClaimStationRequest) {
  return post(sessionPath(sessionId, '/claim'), body);
}

export function releaseStationApi(sessionId: string, stationId: StationId) {
  return post(sessionPath(sessionId, '/release'), { station_id: stationId });
}

export function completeStationApi(sessionId: string, stationId: StationId) {
  return post(sessionPath(sessionId, `/stations/${stationId}/complete`));
}

export function produceBatchApi(sessionId: string, body: ProduceBatchRequest) {
  return post(sessionPath(sessionId, '/stations/3/produce-batch'), body);
}

export function storeBatchApi(sessionId: string, batchId: string) {
  return post(sessionPath(sessionId, '/stations/4/store-batch'), { batch_id: batchId });
}

export function reportDeviationApi(
  sessionId: string,
  body: { batch_id: string; reason: string; missing_quantity: number }
) {
  return post(sessionPath(sessionId, '/stations/4/report-deviation'), body);
}

export function retrieveItemApi(sessionId: string, body: ProduceBatchRequest) {
  return post(sessionPath(sessionId, '/stations/5/retrieve-item'), body);
}

export function finishDayApi(sessionId: string) {
  return post(sessionPath(sessionId, '/stations/5/finish-day'), {});
}

export function configureSessionApi(sessionId: string, body: SessionConfigRequest) {
  return post(sessionPath(sessionId, '/config'), body);
}

export function addOrderApi(
  sessionId: string,
  body: { customer_name?: string; items: OrderItem[] }
) {
  return post(sessionPath(sessionId, '/orders/add'), body);
}

export function joinAsCustomerApi(sessionId: string) {
  return post(sessionPath(sessionId, '/customer-join'));
}

export function nextDaySessionApi(sessionId: string) {
  return post(sessionPath(sessionId, '/next-day'));
}
