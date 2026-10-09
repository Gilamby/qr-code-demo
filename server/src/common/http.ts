/* =========================================================
   HTTP: foutmeldingen, beveiligingsheaders en CSRF-bescherming
   Alle API-fouten hebben dezelfde vorm: { error, details? } met de juiste statuscode.
   ========================================================= */
import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { codespaceHost } from '../config/env';

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

/** Fouten van Express-middleware (bv. te groot bestand, kapotte JSON) en onverwachte fouten */
export function expressError(err: any, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Too large (max. 10 MB per file)' });
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Something went wrong' });
}

/** Beveiligingsheaders voor elke pagina */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

const hostOf = (u: string) => { try { return u ? new URL(u).host : ''; } catch (e) { return ''; } };
/** Wijzigingen (POST, PUT, …) alleen vanaf onze eigen pagina's, niet via een andere website (CSRF) */
export function sameOrigin(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].indexOf(req.method) >= 0) return next();
  const site = req.get('sec-fetch-site'), origin = req.get('origin');
  if (site === 'same-origin') return next();                          // de browser zelf bevestigt: van onze eigen pagina
  if (site && site !== 'none') return res.status(403).json({ error: 'Cross-site request blocked' });
  if (origin) {
    // Achter een proxy (Codespaces, hosting) kan "Host" anders zijn dan het adres in de browser
    const ok = [req.get('host'), req.get('x-forwarded-host'), hostOf(process.env.PUBLIC_URL), codespaceHost()].filter(Boolean);
    try { if (ok.indexOf(new URL(origin).host) < 0) return res.status(403).json({ error: 'Cross-site request blocked' }); } catch (e) { return res.status(403).json({ error: 'Bad origin' }); }
  }
  next();
}
