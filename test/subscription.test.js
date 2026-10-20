/* Regels van het abonnement: codes stoppen meteen, worden 30 dagen bewaard en daarna verwijderd */
const test = require('node:test');
const assert = require('node:assert');
const S = require('../server/dist/subscription');
const D = S.DAY, T0 = Date.parse('2026-01-01T00:00:00Z');

test('bewaartijd is altijd 30 dagen', () => {
  assert.deepStrictEqual([1, 2, 5].map((n) => S.graceMs(n) / D), [30, 30, 30]);
});

test('te laat: blokkeren, waarschuwen, na de bedenktijd verwijderen', () => {
  let s = { ...S.emptySub(), periodEnd: new Date(T0).toISOString() };
  assert.strictEqual(S.stateOf(s, T0 - 1), 'active');
  assert.strictEqual(S.stateOf(s, T0 + 1), 'grace');
  let r = S.tick(s, T0 + 1000); s = r.sub;
  assert.deepStrictEqual(r.actions, ['mail:start']);
  assert.strictEqual(s.lapses, 1); assert.strictEqual(Date.parse(s.graceUntil) - T0, 30 * D);
  assert.deepStrictEqual(S.tick(s, T0 + 10 * D).actions, []);                      // niets nieuws, nog niet verwijderd
  assert.strictEqual(S.stateOf(s, T0 + 20 * D), 'grace');                         // na 20 dagen nog steeds te redden
  r = S.tick(s, T0 + 23.5 * D); s = r.sub; assert.deepStrictEqual(r.actions, ['mail:week']);
  r = S.tick(s, T0 + 29.5 * D); s = r.sub; assert.deepStrictEqual(r.actions, ['mail:day']);
  r = S.tick(s, T0 + 30 * D + 1); s = r.sub; assert.deepStrictEqual(r.actions, ['delete', 'mail:deleted']);
  assert.strictEqual(S.stateOf(s, T0 + 31 * D), 'ended');
  assert.deepStrictEqual(S.tick(s, T0 + 400 * D).actions, []);                     // maar één keer verwijderen
});

test('betalen binnen 30 dagen: alles terug; de volgende keer weer 30 dagen', () => {
  let s = { ...S.emptySub(), periodEnd: new Date(T0).toISOString() };
  s = S.tick(s, T0 + D).sub;
  s = S.renew(s, 'month', T0 + 5 * D);                                               // te laat betaald: nieuwe maand vanaf nu
  assert.strictEqual(S.stateOf(s, T0 + 6 * D), 'active');
  assert.strictEqual(s.graceUntil, null);
  const end = Date.parse(s.periodEnd);
  s = S.tick(s, end + 1000).sub;
  assert.strictEqual(s.lapses, 2); assert.strictEqual(Date.parse(s.graceUntil) - end, 30 * D);
});

test('op tijd betaald: periode loopt door vanaf het einde van de vorige', () => {
  const s = S.renew({ ...S.emptySub(), periodEnd: '2026-03-31T00:00:00.000Z' }, 'year', Date.parse('2026-03-20T00:00:00Z'));
  assert.strictEqual(s.periodEnd, '2027-03-31T00:00:00.000Z');
});

test('teller te laat: na 12 maanden weer de eerste keer', () => {
  const s = { ...S.emptySub(), lapses: 4, lastLapseAt: new Date(T0).toISOString(), periodEnd: new Date(T0 + 400 * D).toISOString() };
  const r = S.tick(s, T0 + 401 * D);
  assert.strictEqual(r.sub.lapses, 1); assert.strictEqual(Date.parse(r.sub.graceUntil) - (T0 + 400 * D), 30 * D);
});

test('zelf geregistreerd: eerst betalen, dan pas codes', () => {
  const s = { ...S.emptySub(), mustPay: true };
  assert.strictEqual(S.stateOf(s), 'unpaid');
  assert.deepStrictEqual(S.tick(s).actions, [], 'geen mails of verwijderen');
  S.rebuildBlocked([['u1', s]]); assert.strictEqual(S.isBlocked('u1'), true);
  const paid = S.renew(s, 'month'); assert.strictEqual(S.stateOf(paid), 'active'); assert.strictEqual(paid.mustPay, false);
  S.rebuildBlocked([['u1', paid]]); assert.strictEqual(S.isBlocked('u1'), false);
});

test('per kwartaal: de periode loopt 3 maanden', () => {
  const s = S.renew(S.emptySub(), 'quarter', Date.parse('2026-01-15T00:00:00Z'));
  assert.strictEqual(s.interval, 'quarter'); assert.strictEqual(s.periodEnd, '2026-04-15T00:00:00.000Z');
  assert.strictEqual(S.toInterval('quarter'), 'quarter'); assert.strictEqual(S.toInterval('onzin'), 'month');
});
