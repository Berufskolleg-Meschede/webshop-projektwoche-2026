import { MAX_ORDER_LINE_QUANTITY, VARIANTS, getVariantLabel } from './production';
import {
  SIMULATION_CATALOG,
  articleIdForVariant,
  describeMissingParts,
  getVariantName,
  variantForArticleId,
} from './simulationCatalog';

describe('simulation catalogue', () => {
  it('has one orderable article per variant with stable ids 1–6', () => {
    expect(SIMULATION_CATALOG.map((article) => article.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(SIMULATION_CATALOG.every((article) => article.availableQuantity > 0)).toBe(true);
    expect(SIMULATION_CATALOG[0].availableQuantity).toBe(MAX_ORDER_LINE_QUANTITY);
    expect(new Set(SIMULATION_CATALOG.map((article) => article.name)).size).toBe(6);
  });

  it('names a variant in German and labels its lid and housing', () => {
    expect(getVariantName('S-RT')).toBe('Roter Salzstreuer');
    expect(getVariantLabel('P-SW')).toBe('Pfeffer (Deckel grün) · Gehäuse schwarz');
  });

  it('maps article ids and variants in both directions', () => {
    for (const variant of VARIANTS) {
      expect(variantForArticleId(articleIdForVariant(variant))).toBe(variant);
    }
    expect(articleIdForVariant('S-RT')).toBe(1);
    expect(articleIdForVariant('P-SW')).toBe(6);
    expect(variantForArticleId(0)).toBeNull();
    expect(variantForArticleId(7)).toBeNull();
  });

  it('words the missing parts grouped by shaker type', () => {
    expect(describeMissingParts([])).toBe('');
    expect(describeMissingParts([{ variant: 'P-RT', quantity: 1 }])).toBe('Pfefferstreuer Rot 1');
    expect(
      describeMissingParts([
        { variant: 'P-RT', quantity: 1 },
        { variant: 'P-SW', quantity: 3 },
      ])
    ).toBe('Pfefferstreuer Rot 1 und Schwarz 3');
    expect(
      describeMissingParts([
        { variant: 'S-SI', quantity: 2 },
        { variant: 'P-RT', quantity: 1 },
        { variant: 'P-SI', quantity: 1 },
        { variant: 'P-SW', quantity: 3 },
      ])
    ).toBe('Salzstreuer Silber 2; Pfefferstreuer Rot 1, Silber 1 und Schwarz 3');
  });
});
