import { makeSession } from '@/test/fixtures';

import { getHousingSupply, getLidSupply } from './materialSupply';

const orders = { 'S-RT': 2, 'S-SI': 1, 'S-SW': 0, 'P-RT': 3, 'P-SI': 0, 'P-SW': 4 };

describe('materialSupply', () => {
  it('sums lids per colour (salt = blue, pepper = green) from the order in Pull', () => {
    const items = getLidSupply(makeSession({ strategy: 'PULL', daily_orders: orders }));
    expect(items.map((i) => i.quantity)).toEqual([3, 7]);
  });

  it('sums housings per colour over salt and pepper', () => {
    const items = getHousingSupply(makeSession({ strategy: 'PULL', daily_orders: orders }));
    expect(items.map((i) => i.quantity)).toEqual([5, 1, 4]);
  });

  it('uses the production plan in Push and treats missing variants as 0', () => {
    const session = makeSession({
      strategy: 'PUSH',
      daily_orders: orders,
      daily_production_limits: { 'S-RT': 10 },
    });
    expect(getLidSupply(session).map((i) => i.quantity)).toEqual([10, 0]);
    expect(getHousingSupply(session).map((i) => i.quantity)).toEqual([10, 0, 0]);
  });

  it('describes each row for the station screen (name and sub)', () => {
    const session = makeSession({
      strategy: 'PULL',
      daily_orders: { 'S-RT': 4, 'P-RT': 1, 'S-SI': 2, 'P-SW': 3 },
    });
    expect(getLidSupply(session).map((i) => [i.name, i.sub, i.quantity])).toEqual([
      ['Deckel Blau', 'Salzstreuer', 6],
      ['Deckel Grün', 'Pfefferstreuer', 4],
    ]);
    expect(getHousingSupply(session).map((i) => [i.name, i.sub, i.quantity])).toEqual([
      ['Gehäuse Rot', 'Salz 4 · Pfeffer 1', 5],
      ['Gehäuse Silber', 'Salz 2', 2],
      ['Gehäuse Schwarz', 'Pfeffer 3', 3],
    ]);
  });
});
