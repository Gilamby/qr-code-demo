/* =========================================================
   BETALEN MET STRIPE  (/api/billing)
   POST checkout  { plan, period }  → { url }  naar de betaalpagina van Stripe
   POST portal                      → { url }  facturen, betaalgegevens en opzeggen (Stripe Customer Portal)
   POST webhook                     ← Stripe meldt: betaald, verlengd, mislukt, opgezegd
   Regels:
   - Eerste keer (nog nooit betaald): 14 dagen gratis, kaart vooraf. Daarna geen nieuwe proefperiode.
   - Groter pakket of andere periode: nieuw abonnement; het oude stopt meteen, het restbedrag wordt verrekend (Stripe).
   - Kleiner pakket (betaald abonnement): POST downgrade { plan, period, keep } plant de wissel bij Stripe (subscription schedule)
     aan het einde van de betaalde periode. Tot dan houd je alles van je huidige pakket. POST downgrade/cancel = toch niet.
   - Betaling mislukt of opgezegd en de periode is om: codes stoppen meteen, 30 dagen bewaard (subscription.ts).
   - Opgezegd (loopt nog tot het einde van de periode): bevestigingsmail.
   Niet voor het team en niet voor teamleden (het abonnement is van de eigenaar).
   ========================================================= */
import { validateBilling } from '../auth/billing';
import { readBuyer, applyBuyer, taxOn, taxBehavior, needsVies, checkVies, locationMismatch } from './tax';
import { place } from '../analytics/scan-stats';
import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import { MailerService } from '../auth/mailer.service';
import { CurrentUser, LoggedIn } from '../auth/auth.guard';
import { fail } from '../common/http';
import { baseUrl } from '../config/env';
import type { User } from '../types';
import { PLANS, EXTRA_PRICE, EXTRA_MAX } from '../plans';
import { subFor, saveSub, stateOf, toInterval, emptySub, Sub } from '../subscription';
import { fitToPlan } from '../plan-limit';
import { stripe, stripeOn, readRecord, writeRecord, amountFor, firstYearDiscount, recurringOf, planName, isPlanId, verifySignature, stripePk, ELEMENTS_VERSION } from './stripe';

@Controller('api/billing')
export class BillingController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService, private readonly mailer: MailerService) {}

  /** Klant bij Stripe (één per account), aangemaakt bij de eerste betaling */
  private async customerFor(user: User) {
    const rec = await readRecord(this.db, user.id);
    if (rec.customer) return { rec, customer: rec.customer };
    const c = await stripe('POST', 'customers', { email: user.email, name: user.name || undefined, metadata: { uid: user.id } });
    rec.customer = c.id; await writeRecord(this.db, user.id, rec);
    return { rec, customer: c.id };
  }

  /** Coupon voor het eerste jaar (2 maanden gratis), per pakket één keer aangemaakt en onthouden */
  private async yearCoupon(planId: string) {
    const off = firstYearDiscount(PLANS[planId]); if (!off) return null;
    const key = 'stripe:coupon:' + planId + ':' + off, have = await this.db.getSetting(key);
    if (have) return have;
    const c = await stripe('POST', 'coupons', { amount_off: off, currency: 'eur', duration: 'once', name: '2 maanden gratis (1e jaar)' });
    await this.db.setSetting(key, c.id); return c.id;
  }

  /** Nieuwe klant per maand: eerste betaalde maand (na de proef) voor de actieprijs (priceFirstMonth). 'repeating' 1 maand vanaf de start,
   *  zodat de korting zeker op de eerste echte factuur valt (niet op de factuur van € 0 bij de proef). */
  private async firstMonthCoupon(planId: string) {
    const P = PLANS[planId]; if (P.price == null || P.priceFirstMonth == null) return null;
    const off = Math.round(P.price * 100) - Math.round(P.priceFirstMonth * 100); if (off <= 0) return null;
    const key = 'stripe:coupon1m:' + planId + ':' + off, have = await this.db.getSetting(key);
    if (have) return have;
    const c = await stripe('POST', 'coupons', { amount_off: off, currency: 'eur', duration: 'repeating', duration_in_months: 1, name: 'Actie eerste maand' });
    await this.db.setSetting(key, c.id); return c.id;
  }
  /** Product "Extra QR-code" bij Stripe (één keer aangemaakt en onthouden): zo herkennen we extra codes in een abonnement */
  private async extraProduct() {
    const have = await this.db.getSetting('stripe:extraProduct'); if (have) return have;
    const p = await stripe('POST', 'products', { name: 'QR-Codex extra QR-code' });
    await this.db.setSetting('stripe:extraProduct', p.id); return p.id;
  }
  /** Product per pakket bij Stripe (één keer aangemaakt): nodig voor een geplande wissel (subscription schedule) */
  private async planProduct(planId: string) {
    const key = 'stripe:product:' + planId, have = await this.db.getSetting(key); if (have) return have;
    const p = await stripe('POST', 'products', { name: planName(planId) });
    await this.db.setSetting(key, p.id); return p.id;
  }
  private schedId(sub: any): string | null { return !sub || !sub.schedule ? null : typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id; }
  /** Geplande wissel naar een kleiner pakket weghalen (bij Stripe en bij ons) */
  private async dropNext(uid: string, sub: any) {
    const id = this.schedId(sub); if (id) await stripe('POST', 'subscription_schedules/' + id + '/release', {});
    const rec = await readRecord(this.db, uid); if (rec.next) { rec.next = null; await writeRecord(this.db, uid, rec); }
    await this.db.setSetting('keepNext:' + uid, null);
  }
  private extraLine(product: string, interval: 'month' | 'quarter' | 'year', quantity: number, buyerType?: string) {
    return { quantity, price_data: { currency: 'eur', product, unit_amount: Math.round(EXTRA_PRICE[interval] * 100), recurring: recurringOf(interval), tax_behavior: taxBehavior(buyerType) } };
  }

  /** Losse QR-code(s) erbij: komt als extra regel in het lopende abonnement (Stripe verrekent het deel van deze periode) */
  @Post('extra')
  @UseGuards(LoggedIn)
  @HttpCode(200)
  async extra(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (!stripeOn()) throw fail(403, 'off');
    if (this.auth.isAdmin(user) || (req as any).member) throw fail(403, 'team');
    const rec = await readRecord(this.db, user.id); if (!rec.subscription) throw fail(409, 'no_subscription');
    const n = Math.min(10, Math.max(1, Math.floor(Number(b.n) || 1)));
    try {
      const sub = await stripe('GET', 'subscriptions/' + rec.subscription), product = await this.extraProduct();
      if (this.schedId(sub)) throw fail(409, 'pending_change');                // wissel naar kleiner pakket gepland: eerst die intrekken
      const item = ((sub.items && sub.items.data) || []).find((i: any) => i.price && i.price.product === product);
      const now = item ? item.quantity : 0; if (now + n > EXTRA_MAX) throw fail(400, 'too_many');
      if (item) await stripe('POST', 'subscription_items/' + item.id, { quantity: now + n, proration_behavior: 'create_prorations' });
      else await stripe('POST', 'subscription_items', { subscription: rec.subscription, ...this.extraLine(product, toInterval(sub.metadata && sub.metadata.period), n, rec.buyer), proration_behavior: 'create_prorations' });
      await this.apply(await stripe('GET', 'subscriptions/' + rec.subscription));
      await this.db.addActivity(user.id, 'extra_bought', this.auth.meta(req)).catch(() => {});
      return { ok: true };
    } catch (e: any) {
      if (e && typeof e.getStatus === 'function') throw e;
      console.error('Stripe extra code mislukt:', e.message);
      throw fail(502, 'stripe');
    }
  }

  @Post('checkout')
  @UseGuards(LoggedIn)
  @HttpCode(200)
  async checkout(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (!stripeOn()) throw fail(403, 'off');
    if (this.auth.isAdmin(user) || (req as any).member) throw fail(403, 'team');
    if (!isPlanId(b.plan)) throw fail(400, 'plan');
    if (this.auth.limited('checkout:' + user.id, 20, 60)) throw fail(429, 'too_many');
    const planId = b.plan, interval = toInterval(b.period), plan = PLANS[planId];
    const first = stateOf(await subFor(this.db, user.id)) === 'unpaid';
    try {
      const { customer, rec } = await this.customerFor(user), base = baseUrl(req);
      // Bedrijf of particulier (uit het betaalscherm): adres en btw-nummer naar Stripe, zodat de btw klopt
      let buyerType: string | undefined = rec.buyer;
      if (b.buyer) {
        const r = readBuyer(b.buyer); if (!r.buyer) throw fail(400, 'buyer', { details: r.errors });
        const away = locationMismatch(r.buyer, place(req.ip)); if (away) throw fail(400, 'buyer', { details: ['location'], where: away });   // land moet kloppen met waar je bent
        // Btw verleggen mag alleen met een btw-nummer dat in VIES geregistreerd staat
        const vies = needsVies(r.buyer) ? await checkVies(r.buyer.vat) : undefined;
        if (vies && vies.state !== 'valid') throw fail(400, 'buyer', { details: [vies.state === 'down' ? 'viesDown' : 'vies'] });
        await applyBuyer(customer, r.buyer, user.email, user.name || '', vies);
        buyerType = r.buyer.type; rec.buyer = r.buyer.type; await writeRecord(this.db, user.id, rec);
        const bl = validateBilling({ type: r.buyer.type, companyName: r.buyer.companyName, taxId: r.buyer.vat, address: r.buyer.address, postalCode: r.buyer.postalCode, city: r.buyer.city, country: r.buyer.country });
        if (bl.value && r.buyer.type === 'company') await this.db.setBilling(user.id, bl.value);   // factuurgegevens in de app gelijk houden
      }
      const tax = await taxOn();
      const meta = { uid: user.id, plan: planId, period: interval };
      await this.db.setSetting('keep:' + user.id, Array.isArray(b.keep) ? JSON.stringify(b.keep.map(String).slice(0, 500)) : null);   // welke codes aan blijven bij minder ruimte
      // Acties gelden één keer: alleen een nieuwe klant krijgt de eerste maand goedkoper (per maand) of het eerste jaar 2 maanden gratis (per jaar)
      const coupon = !first ? null : interval === 'month' ? await this.firstMonthCoupon(planId) : interval === 'year' ? await this.yearCoupon(planId) : null;
      const extras = plan.codes != null ? Number(await this.db.getSetting('extra:' + user.id)) || 0 : 0;   // gekochte losse codes gaan mee
      const extraLines = extras ? [this.extraLine(await this.extraProduct(), interval, extras, (await readRecord(this.db, user.id)).buyer || (b.buyer && b.buyer.type))] : [];
      const common = {
        mode: 'subscription', customer, client_reference_id: user.id, locale: 'auto', payment_method_collection: 'always',
        line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: amountFor(plan, interval), recurring: recurringOf(interval), tax_behavior: taxBehavior(buyerType), product_data: { name: planName(planId) } } }, ...extraLines],
        automatic_tax: tax ? { enabled: true } : undefined,
        subscription_data: { metadata: meta, trial_period_days: first && plan.trialDays ? plan.trialDays : undefined },
        discounts: coupon ? [{ coupon }] : undefined,
        allow_promotion_codes: coupon ? undefined : true,                 // kortingscode invullen (niet samen met de actie voor nieuwe klanten)
        metadata: meta,
      };
      // Betalen in de app zelf (eigen ontwerp, velden van Stripe). Lukt dat niet, dan gewoon de betaalpagina van Stripe.
      if (b.embedded && stripePk()) {
        try {
          const s2 = await stripe('POST', 'checkout/sessions', { ...common, ui_mode: 'elements', return_url: base + '/?checkout=success&session_id={CHECKOUT_SESSION_ID}' }, ELEMENTS_VERSION);
          if (s2.client_secret) return { clientSecret: s2.client_secret };
        } catch (e) { console.error('Stripe betalen in de app mislukt, terug naar de betaalpagina van Stripe:', (e as Error).message); }
      }
      const session = await stripe('POST', 'checkout/sessions', {
        ...common,
        // Factuurgegevens door Stripe laten vragen: adres alleen als het nodig is; bedrijven vinken "Ik koop als bedrijf" aan voor naam + btw-nummer
        // Geen btw-nummer via Stripe: dat loopt alleen via ons betaalscherm, waar het eerst bij VIES gecontroleerd wordt.
        // Land/adres van ons betaalscherm niet laten overschrijven (anders kan de btw van een ander land gerekend worden).
        billing_address_collection: tax && !b.buyer ? 'required' : 'auto', customer_update: b.buyer ? { name: 'auto' } : { name: 'auto', address: 'auto' },
        success_url: base + '/?checkout=success', cancel_url: base + '/?checkout=cancel',
      });
      return { url: session.url };
    } catch (e) {
      if (e && (e as any).getStatus) throw e;                              // onze eigen fout (bv. gegevens koper): zo doorgeven
      console.error('Stripe afrekenen mislukt:', (e as Error).message);
      throw fail(502, 'stripe');
    }
  }

  /* ---------- Abonnement beheren in de app zelf (in plaats van de klantportal van Stripe) ---------- */
  private async mySub(user: User) {
    if (!stripeOn()) throw fail(403, 'off');
    if ((user as any).member) throw fail(403, 'team');
    const rec = await readRecord(this.db, user.id);
    if (!rec.subscription) throw fail(404, 'no_subscription');
    return { rec, sub: await stripe('GET', 'subscriptions/' + rec.subscription) };
  }

  /** Naar een kleiner pakket: gaat in aan het einde van de betaalde periode (zoals bij de meeste apps). Tot dan blijft alles zoals het is.
   *  keep = de codes die daarna aan blijven (als het nieuwe pakket minder codes toestaat). */
  @Post('downgrade')
  @UseGuards(LoggedIn)
  @HttpCode(200)
  async downgrade(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if (this.auth.isAdmin(user) || (req as any).member) throw fail(403, 'team');
    if (!isPlanId(b.plan)) throw fail(400, 'plan');
    if (this.auth.limited('subchange:' + user.id, 20, 60)) throw fail(429, 'too_many');
    const ORDER = ['standard', 'pro', 'business'], interval = toInterval(b.period), plan = PLANS[b.plan];
    try {
      const { rec, sub } = await this.mySub(user);
      if (sub.status !== 'active' || sub.cancel_at_period_end) throw fail(409, 'not_active');
      if (ORDER.indexOf(b.plan) >= ORDER.indexOf(sub.metadata && sub.metadata.plan)) throw fail(400, 'not_lower');
      if (this.schedId(sub)) await stripe('POST', 'subscription_schedules/' + this.schedId(sub) + '/release', {});   // eerdere planning vervangen
      const sch = await stripe('POST', 'subscription_schedules', { from_subscription: sub.id }), p0 = sch.phases[0];
      const extras = plan.codes != null ? Number(await this.db.getSetting('extra:' + user.id)) || 0 : 0, tax = await taxOn();
      const items: any[] = [{ quantity: 1, price_data: { currency: 'eur', product: await this.planProduct(b.plan), unit_amount: amountFor(plan, interval), recurring: recurringOf(interval), tax_behavior: taxBehavior(rec.buyer) } }];
      if (extras) items.push(this.extraLine(await this.extraProduct(), interval, extras, rec.buyer));
      const idOf = (x: any) => (x && typeof x === 'object' ? x.id : x);
      await stripe('POST', 'subscription_schedules/' + sch.id, {
        end_behavior: 'release', proration_behavior: 'none',
        phases: [
          { items: p0.items.map((i: any) => ({ price: idOf(i.price), quantity: i.quantity })), start_date: p0.start_date, end_date: p0.end_date,
            discounts: (p0.discounts || []).map((d: any) => (d.discount ? { discount: idOf(d.discount) } : d.coupon ? { coupon: idOf(d.coupon) } : null)).filter(Boolean),
            automatic_tax: p0.automatic_tax && p0.automatic_tax.enabled ? { enabled: true } : undefined },
          { items, iterations: 1, metadata: { uid: user.id, plan: b.plan, period: interval }, automatic_tax: tax ? { enabled: true } : undefined },
        ],
      });
      const at = new Date(Number(p0.end_date) * 1000).toISOString();
      rec.next = { plan: b.plan, period: interval, at }; await writeRecord(this.db, user.id, rec);
      await this.db.setSetting('keepNext:' + user.id, Array.isArray(b.keep) ? JSON.stringify(b.keep.map(String).slice(0, 500)) : null);
      await this.db.addActivity(user.id, 'plan_scheduled', this.auth.meta(req)).catch(() => {});
      return { ok: true, next: rec.next };
    } catch (e: any) { if (e && e.getStatus) throw e; console.error('Wissel plannen mislukt:', e.message); throw fail(502, 'stripe'); }
  }

  /** Geplande wissel naar een kleiner pakket intrekken */
  @Post('downgrade/cancel')
  @UseGuards(LoggedIn)
  @HttpCode(200)
  async downgradeCancel(@Req() req: Request, @CurrentUser() user: User) {
    if ((req as any).member) throw fail(403, 'team');
    if (this.auth.limited('subchange:' + user.id, 20, 60)) throw fail(429, 'too_many');
    try { const { sub } = await this.mySub(user); await this.dropNext(user.id, sub); return { ok: true }; }
    catch (e: any) { if (e && e.getStatus) throw e; console.error('Wissel intrekken mislukt:', e.message); throw fail(502, 'stripe'); }
  }

  /** Opzeggen. In de gratis proef: meteen stoppen (er is niets betaald). Betaald: loopt door tot het einde van de periode. */
  @Post('cancel')
  @UseGuards(LoggedIn)
  @HttpCode(200)
  async cancel(@Req() req: Request, @CurrentUser() user: User, @Body() b: any = {}) {
    if ((req as any).member) throw fail(403, 'team');
    if (this.auth.limited('subchange:' + user.id, 20, 60)) throw fail(429, 'too_many');
    try {
      const { sub } = await this.mySub(user);
      if (this.schedId(sub) || (await readRecord(this.db, user.id)).next) await this.dropNext(user.id, sub);   // opzeggen gaat voor een geplande wissel
      // Reden van opzeggen (optioneel): bij Stripe bewaard, zo zie je waarom klanten stoppen
      const REASONS = ['too_expensive', 'missing_features', 'switched_service', 'unused', 'too_complex', 'other'];
      const why = REASONS.includes(b.reason) ? { feedback: b.reason, comment: String(b.comment || '').slice(0, 500) || undefined } : undefined;
      const next = sub.status === 'trialing' ? await stripe('DELETE', 'subscriptions/' + sub.id, { cancellation_details: why }) : await stripe('POST', 'subscriptions/' + sub.id, { cancel_at_period_end: true, cancellation_details: why });
      await this.apply(sub.status === 'trialing' ? { ...next, metadata: next.metadata || sub.metadata } : next);
      return { ok: true, ended: next.status === 'canceled' };
    } catch (e: any) { if (e && e.getStatus) throw e; console.error('Opzeggen mislukt:', e.message); throw fail(502, 'stripe'); }
  }

  /** Toch doorgaan (opzegging intrekken), zolang de periode nog loopt */
  @Post('resume')
  @UseGuards(LoggedIn)
  @HttpCode(200)
  async resume(@Req() req: Request, @CurrentUser() user: User) {
    if ((req as any).member) throw fail(403, 'team');
    if (this.auth.limited('subchange:' + user.id, 20, 60)) throw fail(429, 'too_many');
    try {
      const { sub } = await this.mySub(user);
      if (sub.status === 'canceled') throw fail(409, 'ended');
      await this.apply(await stripe('POST', 'subscriptions/' + sub.id, { cancel_at_period_end: false }));
      return { ok: true };
    } catch (e: any) { if (e && e.getStatus) throw e; console.error('Doorgaan mislukt:', e.message); throw fail(502, 'stripe'); }
  }

  /** Huidige betaalmethode (kaart, SEPA, PayPal …), alleen merk en laatste cijfers */
  @Get('method')
  @UseGuards(LoggedIn)
  async method(@CurrentUser() user: User) {
    if (!stripeOn()) return { method: null };
    const rec = await readRecord(this.db, user.id); if (!rec.customer) return { method: null };
    try {
      let pm: any = null;
      if (rec.subscription) { const sub = await stripe('GET', 'subscriptions/' + rec.subscription, { 'expand[]': 'default_payment_method' }); pm = sub.default_payment_method; }
      if (!pm || typeof pm === 'string') { const c = await stripe('GET', 'customers/' + rec.customer, { 'expand[]': 'invoice_settings.default_payment_method' }); pm = c.invoice_settings && c.invoice_settings.default_payment_method; }
      return { method: describePm(pm) };
    } catch (e: any) { console.error('Betaalmethode ophalen mislukt:', e.message); return { method: null }; }
  }

  /** Andere betaalmethode: Checkout Session in 'setup'-modus met de betaalvelden in onze eigen pagina (of de pagina van Stripe) */
  @Post('method')
  @UseGuards(LoggedIn)
  @HttpCode(200)
  async newMethod(@Req() req: Request, @CurrentUser() user: User) {
    if (!stripeOn()) throw fail(403, 'off');
    if ((req as any).member) throw fail(403, 'team');
    if (this.auth.limited('pm:' + user.id, 20, 60)) throw fail(429, 'too_many');
    const rec = await readRecord(this.db, user.id); if (!rec.customer) throw fail(404, 'no_customer');
    const base = baseUrl(req), common = { mode: 'setup', customer: rec.customer, currency: 'eur', client_reference_id: user.id, metadata: { uid: user.id, kind: 'method' }, setup_intent_data: { metadata: { uid: user.id } } };
    try {
      if (stripePk()) {
        const s = await stripe('POST', 'checkout/sessions', { ...common, ui_mode: 'elements', return_url: base + '/?go=plan&pm={CHECKOUT_SESSION_ID}' }, ELEMENTS_VERSION);
        if (s.client_secret) return { clientSecret: s.client_secret };
      }
      const s = await stripe('POST', 'checkout/sessions', { ...common, success_url: base + '/?go=plan&pm={CHECKOUT_SESSION_ID}', cancel_url: base + '/?go=plan' });
      return { url: s.url };
    } catch (e: any) { console.error('Betaalmethode wijzigen mislukt:', e.message); throw fail(502, 'stripe'); }
  }

  /** Terug van het opslaan van een nieuwe betaalmethode: meteen als standaard zetten (de webhook doet hetzelfde, voor de zekerheid) */
  @Post('method/done')
  @UseGuards(LoggedIn)
  @HttpCode(200)
  async methodDone(@CurrentUser() user: User, @Body() b: any = {}) {
    const id = String(b.session || ''); if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw fail(400, 'session');
    try { return { ok: await this.useSetup(await stripe('GET', 'checkout/sessions/' + id), user.id) }; }
    catch (e: any) { console.error('Betaalmethode instellen mislukt:', e.message); throw fail(502, 'stripe'); }
  }
  /** Nieuwe betaalmethode uit een afgeronde setup-sessie: standaard voor de klant en het abonnement */
  async useSetup(o: any, uid: string) {
    if (!o || o.mode !== 'setup' || o.status !== 'complete' || !o.setup_intent) return false;
    const rec = await readRecord(this.db, uid);
    if (!rec.customer || o.customer !== rec.customer) return false;            // alleen je eigen sessie
    const si = await stripe('GET', 'setup_intents/' + (typeof o.setup_intent === 'string' ? o.setup_intent : o.setup_intent.id));
    const pm = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method && si.payment_method.id; if (!pm) return false;
    await stripe('POST', 'customers/' + rec.customer, { invoice_settings: { default_payment_method: pm } });
    if (rec.subscription) await stripe('POST', 'subscriptions/' + rec.subscription, { default_payment_method: pm });
    return true;
  }

  @Post('portal')
  @UseGuards(LoggedIn)
  @HttpCode(200)
  async portal(@Req() req: Request, @CurrentUser() user: User) {
    if (!stripeOn()) throw fail(403, 'off');
    const rec = await readRecord(this.db, user.id);
    if (!rec.customer) throw fail(404, 'no_customer');
    try {
      const s = await stripe('POST', 'billing_portal/sessions', { customer: rec.customer, return_url: baseUrl(req) + '/?go=plan' });
      return { url: s.url };
    } catch (e) {
      console.error('Stripe portal mislukt:', (e as Error).message);
      throw fail(502, 'stripe');
    }
  }

  /** Meldingen van Stripe. Alleen met een geldige handtekening (STRIPE_WEBHOOK_SECRET). */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request) {
    const raw: Buffer = (req as any).rawBody;
    if (!stripeOn() || !verifySignature(raw, String(req.get('stripe-signature') || ''), String(process.env.STRIPE_WEBHOOK_SECRET || ''))) throw fail(400, 'signature');
    const ev = JSON.parse(raw.toString('utf8')), o = ev.data && ev.data.object;
    if (!o) return { ok: true };
    if (ev.type === 'checkout.session.completed' && o.mode === 'setup') {
      const uid = o.client_reference_id || (o.metadata && o.metadata.uid);
      if (uid) await this.useSetup(o, uid).catch((e) => console.error('Betaalmethode (webhook) mislukt:', e.message));
    } else if (ev.type === 'checkout.session.completed' && o.mode === 'subscription' && o.subscription) {
      const uid = o.client_reference_id || (o.metadata && o.metadata.uid); if (!uid || !(await this.db.getUser(uid))) return { ok: true };
      const rec = await readRecord(this.db, uid), old = rec.subscription;
      rec.customer = o.customer || rec.customer; rec.subscription = o.subscription; rec.cancelMailed = null; rec.next = null;   // ander pakket gekozen: geplande wissel vervalt
      await writeRecord(this.db, uid, rec);
      // Gewisseld van pakket of periode: het oude abonnement stopt meteen, het restbedrag wordt verrekend
      if (old && old !== o.subscription) await stripe('DELETE', 'subscriptions/' + old, { prorate: true, invoice_now: true }).catch((e) => console.error('Oud abonnement stoppen mislukt:', e.message));
      await this.apply(await stripe('GET', 'subscriptions/' + o.subscription));
      await this.db.addActivity(uid, old ? 'plan_changed' : 'plan_chosen', {} as any).catch(() => {});
      await this.fillBilling(uid, o.customer_details).catch((e) => console.error('Factuurgegevens overnemen mislukt:', e.message));
    } else if (/^customer\.subscription\.(created|updated|deleted)$/.test(ev.type)) {
      await this.apply(o);
    }
    return { ok: true };
  }

  /** Factuurgegevens nog leeg? Dan overnemen wat de klant bij Stripe invulde (naam, adres, bedrijfsnaam, btw-nummer).
   *  Zo hoeft niemand na het betalen nog iets in te vullen. Onvolledig (bv. alleen een kaart zonder adres): niets opslaan. */
  async fillBilling(uid: string, d: any) {
    if (!d || await this.db.getBilling(uid)) return;
    const a = d.address || {}, tax = (d.tax_ids || [])[0], biz = d.business_name || (tax ? d.name : '');
    const parts = String(d.individual_name || (biz ? '' : d.name) || '').trim().split(/\s+/);
    const { value } = validateBilling({
      type: biz ? 'company' : 'private', companyName: biz, taxId: tax && tax.value,
      firstName: parts[0] || '', lastName: parts.slice(1).join(' '),
      address: [a.line1, a.line2].filter(Boolean).join(', '), postalCode: a.postal_code, city: a.city, country: a.country,
    });
    if (value) await this.db.setBilling(uid, value);
  }

  /** Stand van een Stripe-abonnement overnemen in de app (pakket, periode, tot wanneer betaald) */
  async apply(s: any) {
    const uid = s && s.metadata && s.metadata.uid; if (!uid) return;
    const user = await this.db.getUser(uid); if (!user) return;
    const rec = await readRecord(this.db, uid);
    if (rec.subscription && rec.subscription !== s.id) return;               // een oud (vervangen) abonnement: niets doen
    if (!rec.subscription) { rec.subscription = s.id; rec.customer = s.customer || rec.customer; }
    // Opgezegd in de gratis proefperiode: meteen stoppen (er is niets betaald). Betaald abonnement: loopt door tot het einde van de periode.
    const trialCancel = s.status === 'trialing' && !!(s.cancel_at_period_end || s.cancel_at);
    if (trialCancel) {
      try { s = await stripe('DELETE', 'subscriptions/' + s.id, {}); } catch (e) { console.error('Proef stoppen mislukt:', (e as Error).message); }
    }
    const cur: Sub = (await subFor(this.db, uid)) || emptySub(), now = Date.now();
    // Nieuwere Stripe-versies zetten current_period_end per regel (items) in plaats van op het abonnement: beide lezen
    const pe = s.current_period_end || Math.max(0, ...(((s.items && s.items.data) || []).map((i: any) => Number(i.current_period_end) || 0)));
    const end = (Number(s.trial_end && s.status === 'trialing' ? s.trial_end : pe) || 0) * 1000;
    let periodEnd: number;
    if (s.status === 'active' || s.status === 'trialing') periodEnd = end;
    else if (s.status === 'past_due' || s.status === 'unpaid' || s.status === 'incomplete') periodEnd = Math.min(end || now, now);   // niet betaald: codes stoppen
    else periodEnd = Math.min(cur.periodEnd ? Date.parse(cur.periodEnd) : now, now, end || now);  // canceled / incomplete_expired
    // Geplande wissel naar een kleiner pakket is ingegaan (of het abonnement is gestopt): gekozen codes toepassen, planning weg
    if (rec.next && (s.metadata.plan === rec.next.plan || s.status === 'canceled')) {
      if (s.metadata.plan === rec.next.plan) { const kn = await this.db.getSetting('keepNext:' + uid); if (kn) await this.db.setSetting('keep:' + uid, kn); }
      rec.next = null; await this.db.setSetting('keepNext:' + uid, null);
    }
    const before = await this.db.getSetting('plan:' + uid);
    if (isPlanId(s.metadata.plan)) await this.db.setSetting('plan:' + uid, s.metadata.plan);
    const xp = await this.db.getSetting('stripe:extraProduct');                 // losse QR-codes in dit abonnement
    if (xp && s.items && s.items.data) { const n = s.items.data.filter((i: any) => i.price && i.price.product === xp).reduce((a: number, i: any) => a + (i.quantity || 0), 0); await this.db.setSetting('extra:' + uid, n ? String(n) : null); }
    // Ander pakket of andere hoeveelheid: codes laten passen (gekozen codes blijven aan, de rest gepauzeerd; meer ruimte = weer aan)
    let keep: string[] | null = null; try { keep = JSON.parse((await this.db.getSetting('keep:' + uid)) || 'null'); } catch { keep = null; }
    if (before !== s.metadata.plan || keep) { await fitToPlan(this.db, uid, keep); await this.db.setSetting('keep:' + uid, null); } else await fitToPlan(this.db, uid);
    const paid = periodEnd > now;
    await saveSub(this.db, uid, { ...cur, interval: toInterval(s.metadata.period), periodEnd: new Date(periodEnd).toISOString(), mustPay: false,
      ...(paid ? { graceUntil: null, notified: [], deletedAt: null } : {}) });
    // Opgezegd (loopt nog tot het einde van de periode): één keer een bevestigingsmail
    const trialStopped = s.status === 'canceled' && (trialCancel || rec.status === 'trialing');      // proef opgezegd: meteen gestopt, ook dan één bevestiging
    if ((trialStopped || (s.cancel_at_period_end && s.status !== 'canceled')) && rec.cancelMailed !== s.id) {
      rec.cancelMailed = s.id;
      this.mailer.sendCancelled(user, periodEnd, trialStopped).catch((e) => console.error('Mail opzeggen mislukt:', e.message));
    }
    if (!s.cancel_at_period_end && rec.cancelMailed === s.id) rec.cancelMailed = null;   // toch weer doorgaan
    rec.status = s.status; rec.cancelAtEnd = !!s.cancel_at_period_end;                  // voor 'Abonnement en facturen': proefperiode / opgezegd
    await writeRecord(this.db, uid, rec);
  }
}

/** Betaalmethode in het kort voor de app: soort, merk, laatste 4 cijfers (nooit meer dan dat) */
export function describePm(pm: any) {
  if (!pm || typeof pm !== 'object') return null;
  const t = pm.type, d = pm[t] || {};
  if (t === 'card') return { type: 'card', brand: d.brand || null, last4: d.last4 || null, exp: d.exp_month && d.exp_year ? String(d.exp_month).padStart(2, '0') + '/' + String(d.exp_year).slice(-2) : null };
  if (t === 'sepa_debit') return { type: 'sepa_debit', last4: d.last4 || null };
  if (t === 'paypal') return { type: 'paypal', email: d.payer_email || null };
  return { type: t, last4: d.last4 || null };
}
