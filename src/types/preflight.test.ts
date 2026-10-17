import { makeSession } from '@/test/fixtures';

import { getPreflight } from './preflight';

function ready(overrides = {}) {
  const session = makeSession({ daily_orders: { 'S-RT': 1 }, ...overrides });
  session.stations = session.stations.map((s) => ({ ...s, claimed_by: 'x' }));
  return session;
}

describe('getPreflight', () => {
  it('is ready with claimed stations and an order (Pull)', () => {
    expect(getPreflight(ready())).toMatchObject({ canStart: true, warnings: [] });
  });

  it('blocks the start only without an order', () => {
    expect(getPreflight(ready({ daily_orders: {} })).canStart).toBe(false);
    expect(getPreflight(ready({ daily_orders: {} })).warnings).toContain(
      'Es liegt noch kein Auftrag vor.'
    );
  });

  it('warns about unclaimed stations but does not block the start (decision B)', () => {
    const noOne = makeSession({ daily_orders: { 'S-RT': 1 } });
    const result = getPreflight(noOne);
    expect(result.allStationsClaimed).toBe(false);
    expect(result.canStart).toBe(true);
    expect(result.warnings).toEqual(['Nicht alle Stationen 1–5 sind besetzt.']);
  });

  it('does not treat a partial station list as complete', () => {
    const partial = ready();
    partial.stations = partial.stations.slice(0, 3);
    expect(getPreflight(partial).allStationsClaimed).toBe(false);
  });

  it('warns per variant when a Push plan cannot cover the order but still allows the start', () => {
    const push = ready({
      strategy: 'PUSH',
      daily_orders: { 'S-RT': 2, 'P-SW': 1 },
      daily_production_limits: { 'S-RT': 1, 'P-SW': 5 },
    });
    const result = getPreflight(push);
    expect(result.isPlanSufficient).toBe(false);
    expect(result.canStart).toBe(true);
    expect(result.warnings).toEqual([
      'Plan für Salz (Deckel blau) · Gehäuse rot (1) liegt unter dem Auftrag (2).',
    ]);
  });

  it('warns when the Push plan is missing but does not block', () => {
    const result = getPreflight(ready({ strategy: 'PUSH' }));
    expect(result.hasProductionPlan).toBe(false);
    expect(result.canStart).toBe(true);
    expect(result.warnings).toEqual(['Im Push-Modus fehlen die Tages-Produktionsmengen.']);
  });

  it('judges the plan per variant, not by the total (wrong mix does not help)', () => {
    const wrongMix = ready({
      strategy: 'PUSH',
      daily_orders: { 'S-RT': 2 },
      daily_production_limits: { 'P-SW': 9 },
    });
    expect(getPreflight(wrongMix)).toMatchObject({ isPlanSufficient: false });
  });

  it('never reports a shortfall in Pull', () => {
    expect(getPreflight(ready({ strategy: 'PULL' })).isPlanSufficient).toBe(true);
  });

  it('allows a Push start with a plan but no order, without an order warning', () => {
    const result = getPreflight(
      ready({
        strategy: 'PUSH',
        daily_orders: {},
        daily_production_limits: { 'S-RT': 3 },
      })
    );
    expect(result.canStart).toBe(true);
    expect(result.hasOrder).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it('blocks a Push start with neither order nor plan', () => {
    const result = getPreflight(ready({ strategy: 'PUSH', daily_orders: {} }));
    expect(result.canStart).toBe(false);
  });

  it('still blocks a Pull start without an order even if a plan is stored', () => {
    const result = getPreflight(
      ready({ strategy: 'PULL', daily_orders: {}, daily_production_limits: { 'S-RT': 3 } })
    );
    expect(result.canStart).toBe(false);
    expect(result.warnings).toContain('Es liegt noch kein Auftrag vor.');
  });
});
