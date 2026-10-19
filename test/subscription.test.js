/* Regels van het abonnement: bedenktijd halveert, minimum 3 dagen, teller weer op nul na 12 maanden */
const test = require('node:test');
const assert = require('node:assert');
const S = require('../server/dist/subscription');
const D = S.DAY, T0 = Date.parse('2026-01-01T00:00:00Z');

test('bedenktijd halveert met een minimum van 3 dagen', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5, 6].map((n) => S.graceMs(n) / D), [30, 15, 7.5, 3.75, 3, 3]);
});

test('te laat: blokkeren, waarschuwen, na de bedenktijd verwijderen', () => {
  let s = { ...S.emptySub(), periodEnd: new Date(T0).toISOString() };
  assert.strictEqual(S.stateOf(s, T0 - 1), 'active');
  assert.strictEqual(S.stateOf(s, T0 + 1), 'grace');
  let r = S.tick(s, T0 + 1000); s = r.sub;
  assert.deepStrictEqual(r.actions, ['mail:start']);
  assert.strictEqual(s.lapses, 1); assert.strictEqual(Date.parse(s.graceUntil) - T0, 30 * D);
  assert.deepStrictEqual(S.tick(s, T0 + 2 * D).actions, []);                       // niets nieuws
  r = S.tick(s, T0 + 23.5 * D); s = r.sub; assert.deepStrictEqual(r.actions, ['mail:week']);
  r = S.tick(s, T0 + 29.5 * D); s = r.sub; assert.deepStrictEqual(r.actions, ['mail:day']);
  r = S.tick(s, T0 + 30 * D + 1); s = r.sub; assert.deepStrictEqual(r.actions, ['delete', 'mail:deleted']);
  assert.strictEqual(S.stateOf(s, T0 + 31 * D), 'ended');
  assert.deepStrictEqual(S.tick(s, T0 + 40 * D).actions, []);                      // maar één keer verwijderen
});

test('betalen in de bedenktijd: alles terug; de volgende keer is de bedenktijd korter', () => {
  let s = { ...S.emptySub(), periodEnd: new Date(T0).toISOString() };
  s = S.tick(s, T0 + D).sub;
  s = S.renew(s, 'month', T0 + 5 * D);                                               // te laat betaald: nieuwe maand vanaf nu
  assert.strictEqual(S.stateOf(s, T0 + 6 * D), 'active');
  assert.strictEqual(s.graceUntil, null);
  const end = Date.parse(s.periodEnd);
  s = S.tick(s, end + 1000).sub;
  assert.strictEqual(s.lapses, 2); assert.strictEqual(Date.parse(s.graceUntil) - end, 15 * D);
});

test('op tijd betaald: periode loopt door vanaf het einde van de vorige', () => {
  const s = S.renew({ ...S.emptySub(), periodEnd: '2026-03-31T00:00:00.000Z' }, 'year', Date.parse('2026-03-20T00:00:00Z'));
  assert.strictEqual(s.periodEnd, '2027-03-31T00:00:00.000Z');
});

test('na 12 maanden zonder te laat betalen weer 30 dagen', () => {
  const s = { ...S.emptySub(), lapses: 4, lastLapseAt: new Date(T0).toISOString(), periodEnd: new Date(T0 + 400 * D).toISOString() };
  const r = S.tick(s, T0 + 401 * D);
  assert.strictEqual(r.sub.lapses, 1); assert.strictEqual(Date.parse(r.sub.graceUntil) - (T0 + 400 * D), 30 * D);
});

test('korte bedenktijd: geen weekmail, wel startmail', () => {
  const s = { ...S.emptySub(), lapses: 5, lastLapseAt: new Date(T0).toISOString(), periodEnd: new Date(T0 + 30 * D).toISOString() };
  const r = S.tick(s, T0 + 30 * D + 1000);
  assert.deepStrictEqual(r.actions, ['mail:start']);
  assert.strictEqual(Date.parse(r.sub.graceUntil) - (T0 + 30 * D), 3 * D);
});
