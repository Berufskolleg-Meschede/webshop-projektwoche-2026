import { MAX_DAILY_QUANTITY } from '@/types/production';
import type { ShakerVariant } from '@/types/simulation';

export type Quantities = Partial<Record<ShakerVariant, number>>;

/** Same cap as the server (`MAX_DAILY_QUANTITY`); the summed customer orders are checked there. */
export const MAX_QUANTITY = MAX_DAILY_QUANTITY;
export const QUANTITY_HINT_ID = 'quantity-hint';

export type InvalidChangeHandler = (label: string, isInvalid: boolean) => void;
