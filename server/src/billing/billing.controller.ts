/* =========================================================
   BETALEN MET STRIPE  (/api/billing)
   POST checkout  { plan, period }  → { url }  naar de betaalpagina van Stripe
   POST portal                      → { url }  facturen, betaalgegevens en opzeggen (Stripe Customer Portal)
   POST webhook                     ← Stripe meldt: betaald, verlengd, mislukt, opgezegd
   Regels:
   - Eerste keer (nog nooit betaald): 14 dagen gratis, kaart vooraf. Daarna geen nieuwe proefperiode.
   - Ander pakket of andere periode: nieuw abonnement; het oude stopt meteen, het restbedrag wordt verrekend (Stripe).
   - Betaling mislukt of opgezegd en de periode is om: codes stoppen meteen, 30 dagen bewaard (subscription.ts).
   - Opgezegd (loopt nog tot het einde van de periode): bevestigingsmail.
   Niet voor het team en niet voor teamleden (het abonnement is van de eigenaar).
   ========================================================= */
import { validateBilling } from '../auth/billing';
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
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
  private extraLine(product: string, interval: 'month' | 'quarter' | 'year', quantity: number) {
    return { quantity, price_data: { currency: 'eur', product, unit_amount: Math.round(EXTRA_PRICE[interval] * 100), recurring: recurringOf(interval) } };
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
      const item = ((sub.items && sub.items.data) || []).find((i: any) => i.price && i.price.product === product);
      const now = item ? item.quantity : 0; if (now + n > EXTRA_MAX) throw fail(400, 'too_many');
      if (item) await stripe('POST', 'subscription_items/' + item.id, { quantity: now + n, proration_behavior: 'create_prorations' });
      else await stripe('POST', 'subscription_items', { subscription: rec.subscription, ...this.extraLine(product, toInterval(sub.metadata && sub.metadata.period), n), proration_behavior: 'create_prorations' });
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
      const { customer } = await this.customerFor(user), base = baseUrl(req);
      const meta = { uid: user.id, plan: planId, period: interval };
      await this.db.setSetting('keep:' + user.id, Array.isArray(b.keep) ? JSON.stringify(b.keep.map(String).slice(0, 500)) : null);   // welke codes aan blijven bij minder ruimte
      // Acties gelden één keer: alleen een nieuwe klant krijgt de eerste maand goedkoper (per maand) of het eerste jaar 2 maanden gratis (per jaar)
      const coupon = !first ? null : interval === 'month' ? await this.firstMonthCoupon(planId) : interval === 'year' ? await this.yearCoupon(planId) : null;
      const extras = plan.codes != null ? Number(await this.db.getSetting('extra:' + user.id)) || 0 : 0;   // gekochte losse codes gaan mee
      const extraLines = extras ? [this.extraLine(await this.extraProduct(), interval, extras)] : [];
      const common = {
        mode: 'subscription', customer, client_reference_id: user.id, locale: 'auto', payment_method_collection: 'always',
        line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: amountFor(plan, interval), recurring: recurringOf(interval), product_data: { name: planName(planId) } } }, ...extraLines],
        subscription_data: { metadata: meta, trial_period_days: first && plan.trialDays ? plan.trialDays : undefined },
        discounts: coupon ? [{ coupon }] : undefined,
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
        billing_address_collection: 'auto', tax_id_collection: { enabled: true }, customer_update: { name: 'auto', address: 'auto' },
        success_url: base + '/?checkout=success', cancel_url: base + '/?checkout=cancel',
      });
      return { url: session.url };
    } catch (e) {
      console.error('Stripe afrekenen mislukt:', (e as Error).message);
      throw fail(502, 'stripe');
    }
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
    if (ev.type === 'checkout.session.completed' && o.mode === 'subscription' && o.subscription) {
      const uid = o.client_reference_id || (o.metadata && o.metadata.uid); if (!uid || !(await this.db.getUser(uid))) return { ok: true };
      const rec = await readRecord(this.db, uid), old = rec.subscription;
      rec.customer = o.customer || rec.customer; rec.subscription = o.subscription; rec.cancelMailed = null;
      await writeRecord(this.db, uid, rec);
      // Gewisseld van pakket of periode: het oude abonnement stopt meteen, het restbedrag wordt verrekend
      if (old && old !== o.subscription) await stripe('DELETE', 'subscriptions/' + old, { prorate: true }).catch((e) => console.error('Oud abonnement stoppen mislukt:', e.message));
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
