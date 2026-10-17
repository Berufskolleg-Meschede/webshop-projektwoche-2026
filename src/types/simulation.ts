/**
 * Shared simulation contract (ADR-SIM-01, Feature 01). Field names mirror the
 * backend (snake_case) so API payloads need no mapping.
 */
export type SimulationState = 'CONFIGURING' | 'RUNNING' | 'FINISHED';

export type ProductionStrategy = 'PULL' | 'PUSH';

export type StationStatus = 'IDLE' | 'WAITING' | 'ACTIVE' | 'BLOCKED' | 'COMPLETED';

export type StationId = 1 | 2 | 3 | 4 | 5;

/** The six salt/pepper shaker variants (S = salt, P = pepper; RT = red, SI = silver, SW = black). */
export type ShakerVariant = 'S-RT' | 'S-SI' | 'S-SW' | 'P-RT' | 'P-SI' | 'P-SW';

export type StationState = {
  station_id: StationId;
  status: StationStatus;
  claimed_by: string | null;
  has_error: boolean;
};

type BatchStatus = 'PRODUCED' | 'STORED' | 'REJECTED';

/** A partial production run handed from Station 3 to Station 4 (ADR: Batch Contract). */
export type Batch = {
  batch_id: string;
  variant: ShakerVariant;
  quantity: number;
  status: BatchStatus;
  is_replenishment: boolean;
  reject_reason: string | null;
  created_at: string;
};

/** Missing quantity Station 4 sent back to Station 3; display only, never added to the open amount. */
export type ReplenishmentItem = { variant: ShakerVariant; quantity: number; reason: string };

/** A customer order collected from the simulation webshop (ADR-SIM-03). */
export type Order = {
  order_id: string;
  source: 'customer';
  customer_name: string | null;
  items: Partial<Record<ShakerVariant, number>>;
  created_at: string;
};

export type OrderItem = { variant: ShakerVariant; quantity: number };

export type SimulationSession = {
  session_id: string;
  /** Starts at 1 and grows with every next day; ids of batches/orders are never reused across runs. */
  run_id: number;
  state: SimulationState;
  strategy: ProductionStrategy;
  daily_production_limits: Partial<Record<ShakerVariant, number>>;
  /** Aggregated daily order per variant (Feature 03/04); defaults to 0 on the backend. */
  daily_orders: Partial<Record<ShakerVariant, number>>;
  /** Customers that joined via QR code (any number may join). */
  customer_count: number;
  created_at: string;
  stations: StationState[];
  batches: Batch[];
  replenishment_queue: ReplenishmentItem[];
  /** Customer orders in the order they arrived; `daily_orders` holds the (editable) sum. */
  orders: Order[];
  /** Warehouse stock per variant (backend is authoritative). */
  stock: Partial<Record<ShakerVariant, number>>;
  /** Already retrieved quantity per variant. */
  retrieved: Partial<Record<ShakerVariant, number>>;
  /** Ordered but not retrieved per variant, set when the day ends (basis for the carry-over). */
  shortfall: Partial<Record<ShakerVariant, number>>;
  /** Part of `daily_orders` taken over from the previous day's shortfall (empty on a fresh day). */
  carried_over: Partial<Record<ShakerVariant, number>>;
  /** True when the teacher ended the running day by hand (not Station 5, not automatic). */
  ended_by_teacher: boolean;
};

/** ADR-SIM-02: only accepted while the session is CONFIGURING (409 otherwise). */
export type SessionConfigRequest = {
  strategy?: ProductionStrategy;
  daily_orders?: Partial<Record<ShakerVariant, number>>;
  daily_production_limits?: Partial<Record<ShakerVariant, number>>;
};

export type ProduceBatchRequest = { variant: ShakerVariant; quantity: number };

export type ClaimStationRequest = {
  student_name: string;
  station_id: StationId;
};
