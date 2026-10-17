import { COLOR_WORDS, LID_COLOR_WORDS, sum } from './production';
import type { ShakerVariant, SimulationSession } from './simulation';
import { getTargets } from './simulationRules';

export type SupplyItem = {
  key: string;
  label: string;
  /** Row title on the station screen, e.g. "Deckel Blau". */
  name: string;
  /** Row subtitle, e.g. "Salzstreuer" or "Salz 4 · Pfeffer 1". */
  sub: string;
  /** Colour word of the part, e.g. "Blau" or "Rot". */
  colour: string;
  quantity: number;
  swatchClass: string;
};

function sumVariants(
  quantities: Partial<Record<ShakerVariant, number>>,
  variants: ShakerVariant[]
): number {
  return sum(variants.map((variant) => quantities[variant] ?? 0));
}

/** "Salz 4 · Pfeffer 1" (only the parts that are needed), for housings shared by both contents. */
function describeSplit(salt: number, pepper: number): string {
  return [salt > 0 ? `Salz ${salt}` : '', pepper > 0 ? `Pfeffer ${pepper}` : '']
    .filter(Boolean)
    .join(' · ');
}

/** Station 1: blue lids for salt shakers, green lids for pepper shakers. */
export function getLidSupply(session: SimulationSession): SupplyItem[] {
  const planned = getTargets(session);
  return [
    {
      key: 'lid-blue',
      label: 'Deckel blau (Salz)',
      name: 'Deckel Blau',
      sub: 'Salzstreuer',
      colour: LID_COLOR_WORDS.S,
      quantity: sumVariants(planned, ['S-RT', 'S-SI', 'S-SW']),
      swatchClass: 'bg-accent-blue',
    },
    {
      key: 'lid-green',
      label: 'Deckel grün (Pfeffer)',
      name: 'Deckel Grün',
      sub: 'Pfefferstreuer',
      colour: LID_COLOR_WORDS.P,
      quantity: sumVariants(planned, ['P-RT', 'P-SI', 'P-SW']),
      swatchClass: 'bg-accent-green',
    },
  ];
}

/** Station 2: housings by colour, summed over salt and pepper. */
export function getHousingSupply(session: SimulationSession): SupplyItem[] {
  const planned = getTargets(session);
  return [
    {
      key: 'housing-red',
      label: 'Gehäuse rot',
      name: 'Gehäuse Rot',
      sub: describeSplit(sumVariants(planned, ['S-RT']), sumVariants(planned, ['P-RT'])),
      colour: COLOR_WORDS.RT,
      quantity: sumVariants(planned, ['S-RT', 'P-RT']),
      swatchClass: 'bg-primary',
    },
    {
      key: 'housing-silver',
      label: 'Gehäuse silber',
      name: 'Gehäuse Silber',
      sub: describeSplit(sumVariants(planned, ['S-SI']), sumVariants(planned, ['P-SI'])),
      colour: COLOR_WORDS.SI,
      quantity: sumVariants(planned, ['S-SI', 'P-SI']),
      swatchClass: 'bg-chip',
    },
    {
      key: 'housing-black',
      label: 'Gehäuse schwarz',
      name: 'Gehäuse Schwarz',
      sub: describeSplit(sumVariants(planned, ['S-SW']), sumVariants(planned, ['P-SW'])),
      colour: COLOR_WORDS.SW,
      quantity: sumVariants(planned, ['S-SW', 'P-SW']),
      swatchClass: 'bg-ink',
    },
  ];
}
