import type { Article } from '@/api/articles/listArticlesApi';

import {
  COLOR_WORDS,
  LID_COLOR_WORDS,
  MAX_ORDER_LINE_QUANTITY,
  VARIANTS,
  getVariantLabel,
  parseVariant,
} from './production';
import type { ShakerVariant } from './simulation';

const CONTENT_NAMES = { S: 'Salzstreuer', P: 'Pfefferstreuer' } as const;
const COLOR_NAMES = { RT: 'Roter', SI: 'Silberner', SW: 'Schwarzer' } as const;

/** Row title used in lists, e.g. "Salzstreuer · Rot" for `S-RT`. */
export function getVariantTitle(variant: ShakerVariant): string {
  const { content, color } = parseVariant(variant);
  return `${CONTENT_NAMES[content]} · ${COLOR_WORDS[color]}`;
}

/** Parts of a variant for the order list: "Deckel Blau · Gehäuse Rot". */
export function getVariantParts(variant: ShakerVariant): string {
  const { content, color } = parseVariant(variant);
  return `Deckel ${LID_COLOR_WORDS[content]} · Gehäuse ${COLOR_WORDS[color]}`;
}

/**
 * Missing parts as a sentence fragment, grouped by shaker type, e.g.
 * "Pfefferstreuer Rot 1 und Schwarz 3".
 */
export function describeMissingParts(
  missing: { variant: ShakerVariant; quantity: number }[]
): string {
  const groups = (['S', 'P'] as const).flatMap((content) => {
    const entries = missing.filter((entry) => entry.variant.startsWith(`${content}-`));
    if (entries.length === 0) return [];
    const colors = entries.map((entry) => {
      return `${COLOR_WORDS[parseVariant(entry.variant).color]} ${entry.quantity}`;
    });
    const joined =
      colors.length > 1 ? `${colors.slice(0, -1).join(', ')} und ${colors.at(-1)}` : colors[0];
    return [`${CONTENT_NAMES[content]} ${joined}`];
  });
  return groups.join('; ');
}

/** Token classes for the colour dots of a variant: lid colour and housing colour. */
export function getVariantSwatches(variant: ShakerVariant): { lid: string; housing: string } {
  const { content, color } = parseVariant(variant);
  return {
    lid: { S: 'bg-accent-blue', P: 'bg-accent-green' }[content],
    housing: { RT: 'bg-primary', SI: 'bg-chip', SW: 'bg-ink' }[color],
  };
}

/** Display name, e.g. "Roter Salzstreuer" for `S-RT`. */
export function getVariantName(variant: ShakerVariant): string {
  const { content, color } = parseVariant(variant);
  return `${COLOR_NAMES[color]} ${CONTENT_NAMES[content]}`;
}

/**
 * Static six-variant catalogue of the simulation webshop (ADR-SIM-03). Article ids are the
 * 1-based position in `VARIANTS` — this is the single place that maps article id ↔ variant.
 */
export const SIMULATION_CATALOG: Article[] = VARIANTS.map((variant, index) => ({
  id: index + 1,
  name: getVariantName(variant),
  description: getVariantLabel(variant),
  price: null,
  imageUrl: null,
  availableQuantity: MAX_ORDER_LINE_QUANTITY,
}));

export function variantForArticleId(articleId: number): ShakerVariant | null {
  return VARIANTS[articleId - 1] ?? null;
}

export function articleIdForVariant(variant: ShakerVariant): number {
  return VARIANTS.indexOf(variant) + 1;
}
