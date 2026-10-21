/* =========================================================
   HTTP: foutmeldingen, beveiligingsheaders en CSRF-bescherming
   Alle API-fouten hebben dezelfde vorm: { error, details? } met de juiste statuscode.
   ========================================================= */
import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { codespaceHost, publicUrl } from '../config/env';

/** API-fout met onze vaste vorm: throw fail(400, 'Invalid QR code', { details }) */
export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => new HttpException({ error, ...extra }, status);
/** Antwoord met een andere statuscode dan normaal, bv. throw reply(503, { ok: false }) */
export const reply = (status: number, body: Record<string, unknown>) => new HttpException(body, status);

/** Eén plek voor alle fouten: nette antwoorden, nooit interne details naar buiten */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(err: any, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<Request>(), res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    if (err && err.constructor === HttpException) return res.status(err.getStatus()).json(err.getResponse());   // onze eigen fouten (fail, reply)
    if (err instanceof NotFoundException) {
      // Onbekende route (Nest zelf)
      return req.path.startsWith('/api') ? res.status(404).json({ error: 'Not found' }) : res.status(404).type('text').send('Not found');
    }
    if (err instanceof BadRequestException) {
      // Nest zet kapotte JSON (body-parser) en kapotte adressen om naar een 400 met technische tekst: die tonen we niet
      return res.status(400).json({ error: req.is('json') ? 'Invalid JSON' : 'Bad request' });
    }
    if (err instanceof HttpException) {
      const body: any = err.getResponse();
      return res.status(err.getStatus()).json({ error: typeof body === 'string' ? body : body.message || 'Error' });
    }
    return expressError(err, req, res, () => undefined);
  }
}

/** Laatste onverwachte serverfouten (alleen in het geheugen, max. 50): voor de waarschuwingen op het beheer-dashboard.
 *  Bevat alleen tijd, methode, pad (zonder ?query) en de foutmelding: nooit wachtwoorden, tokens of inhoud. */
export const recentErrors: { at: string; method: string; path: string; message: string }[] = [];
function remember(err: any, req: Request) {
  recentErrors.unshift({ at: new Date().toISOString(), method: req.method, path: String(req.path || '').replace(/[A-Za-z0-9_-]{20,}/g, '…').slice(0, 120), message: String((err && err.message) || err).slice(0, 200) });
  recentErrors.length = Math.min(recentErrors.length, 50);
}

/** Fouten van Express-middleware (bv. te groot bestand, kapotte JSON) en onverwachte fouten */
export function expressError(err: any, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Too large (max. 10 MB per file)' });
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  remember(err, req);
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Something went wrong' });
}

/* Chatbot (Optimasys webchat, zie public/index.html): alleen deze adressen mag hij gebruiken.
   - webchat-api.optimasys.es: het script, de chat, de live-verbinding en het venster
   - cdn.socket.io / cdn.jsdelivr.net: hulpbibliotheken (live-verbinding, telefoonnummer-veld)
   - ipapi.co: land van de bezoeker (voor het telefoonnummer-veld) */
const CHAT = 'https://webchat-api.optimasys.es';
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https:",                                  // logo/icoon van de chatbot
  "media-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline' " + CHAT + ' https://cdn.jsdelivr.net https://fonts.googleapis.com',
  "script-src 'self' 'unsafe-inline' " + CHAT + ' https://cdn.socket.io https://cdn.jsdelivr.net',
  "font-src 'self' " + CHAT + ' https://fonts.gstatic.com',
  "connect-src 'self' " + CHAT + ' wss://webchat-api.optimasys.es https://ipapi.co https://cdn.jsdelivr.net',
  'frame-src ' + CHAT,
  "frame-ancestors 'self'", "base-uri 'self'", "form-action 'self'",
].join('; ');

/** Beveiligingsheaders voor elke pagina */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(self "' + CHAT + '"), geolocation=(), payment=()',   // microfoon: alleen voor spraak in de chatbot
    'Content-Security-Policy': CSP,
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

const hostOf = (u: string) => { try { return u ? new URL(u).host : ''; } catch (e) { return ''; } };
/** Wijzigingen (POST, PUT, …) alleen vanaf onze eigen pagina's, niet via een andere website (CSRF) */
export function sameOrigin(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].indexOf(req.method) >= 0 || req.apiUser) return next();   // API-sleutel: geen browser, dus geen cross-site risico
  const site = req.get('sec-fetch-site'), origin = req.get('origin');
  if (site === 'same-origin') return next();                          // de browser zelf bevestigt: van onze eigen pagina
  if (site && site !== 'none') return res.status(403).json({ error: 'Cross-site request blocked' });
  if (origin) {
    // Achter een proxy (Codespaces, hosting) kan "Host" anders zijn dan het adres in de browser
    const ok = [req.get('host'), req.get('x-forwarded-host'), hostOf(publicUrl()), codespaceHost()].filter(Boolean);
    try { if (ok.indexOf(new URL(origin).host) < 0) return res.status(403).json({ error: 'Cross-site request blocked' }); } catch (e) { return res.status(403).json({ error: 'Bad origin' }); }
  }
  next();
}
