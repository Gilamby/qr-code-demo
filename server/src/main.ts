/* =========================================================
   OPTIMASYS QR — server (NestJS op Node.js)
   - serveert de app (public/ of de productieversie in build/)
   - REST-API onder /api (accounts, QR-codes, statistieken, hulpdiensten)
   - korte links /q/:id: regels toepassen, scan tellen, pagina tonen of doorsturen
   Instellingen via omgevingsvariabelen of een .env-bestand (zie .env.example).
   Starten: npm start  (bouwt eerst de TypeScript in server/src naar server/dist)
   ========================================================= */
import 'reflect-metadata';
import { PATHS, PORT, codespaceUrl, isProduction, lanIp, trustProxy } from './config/env';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { DatabaseService } from './database/database.service';
import { expressError, sameOrigin, securityHeaders } from './common/http';
import { useBundle } from './visitor/live-page';

/** Maakt de app klaar (database open, routes geregistreerd), zonder te luisteren. Gebruikt door main(), tests en scripts. */
export async function createApp(): Promise<NestExpressApplication> {
  // abortOnError: false = bij een fout (bv. database onbereikbaar) geeft main() zelf een duidelijke melding
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, abortOnError: false, logger: false });
  app.useLogger(['error', 'warn']);                           // stil tijdens het opstarten; fouten daarna wel in de log
  app.disable('x-powered-by');
  // Achter een proxy (nginx, hosting): het echte IP-adres uit X-Forwarded-For
  app.set('trust proxy', trustProxy());

  app.use(securityHeaders);
  app.use(express.json({ limit: '16mb' }));                  // ruimte voor een PDF/MP3 (max. 10 MB) of een fotogalerij
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));

  /* De app zelf.
     Productie (NODE_ENV=production + npm run build): alleen de samengevoegde, gecomprimeerde bestanden uit build/.
     De leesbare broncode (js/, shared/, css/app.css) is dan niet op te vragen. Ontwikkelen: gewoon public/. */
  let bundle = null;
  if (isProduction()) {
    try { bundle = JSON.parse(fs.readFileSync(path.join(PATHS.build, 'manifest.json'), 'utf8')); useBundle(bundle); }
    catch (e) { console.warn('Let op: geen productieversie gevonden. Draai eerst "npm run build".'); }
  }
  if (bundle) {
    app.use((req, res, next) => (req.method === 'GET' && (req.path === '/' || req.path === '/index.html') ? res.set('Cache-Control', 'no-cache').sendFile(path.join(PATHS.build, 'index.html'), { dotfiles: 'allow' }) : next()));
    app.use((req, res, next) => (/^\/(js|shared|vendor)\//.test(req.path) || /^\/css\/(app|live)\.css$/.test(req.path) || req.path === '/manifest.json' ? res.status(404).end() : next()));
    app.use(express.static(PATHS.build, { index: false, maxAge: '365d', immutable: true }));   // namen met hash: mag lang in de cache
    app.use(express.static(PATHS.public, { index: false, maxAge: '1h' }));
  } else {
    app.use(express.static(PATHS.public, { maxAge: 0 }));
    app.use('/shared', express.static(PATHS.shared));
  }

  app.use(app.get(AuthService).session);                     // req.user = wie is ingelogd (of null)
  app.use('/api', sameOrigin);                                // wijzigingen alleen vanaf onze eigen pagina's
  app.enableShutdownHooks();
  await app.init();
  app.use(expressError);                                      // fouten van de middleware hierboven (te groot, kapotte JSON)
  return app;
}

async function main() {
  let app: NestExpressApplication;
  try { app = await createApp(); } catch (e) {
    console.error('\nDe server kon niet starten: ' + e.message);
    console.error(process.env.DATABASE_URL ? 'Controleer DATABASE_URL (adres, gebruiker, wachtwoord, database) en of de database aan staat.' : 'Controleer DATA_DIR / DB_PATH.');
    process.exit(1);
  }
  const db = app.get(DatabaseService), port = PORT();
  try { await app.listen(port, process.env.HOST || undefined); } catch (e) {
    if (e.code === 'EADDRINUSE') console.error('\nPoort ' + port + ' is al bezet: de app draait waarschijnlijk al in een ander terminalvenster.\nStop die eerst (Ctrl+C in dat venster, of het prullenbakje bij die terminal) en typ dan opnieuw: npm start\n');
    else console.error(e);
    process.exit(1);
  }
  console.log('Optimasys QR (NestJS) draait op http://localhost:' + port + ' (database: ' + (db.kind === 'postgres' ? 'PostgreSQL ' : 'SQLite ') + db.label + ')');
  if (process.env.PUBLIC_URL) console.log('QR-codes wijzen naar: ' + process.env.PUBLIC_URL);
  else if (codespaceUrl()) {
    console.log('\nCodespaces: QR-codes wijzen naar ' + codespaceUrl());
    // Poort openbaar maken, zodat een telefoon hem kan openen
    exec('gh codespace ports visibility ' + port + ':public -c ' + process.env.CODESPACE_NAME, (err) => console.log(err
      ? 'Zet poort ' + port + ' op "Public": tab "Poorten" (Ports) onderin > rechtermuisknop op ' + port + ' > Port Visibility > Public.'
      : 'Poort ' + port + ' staat op Public: je telefoon kan de codes openen (ook via 4G). Open de app via dit adres: ' + codespaceUrl()));
  } else if (lanIp()) console.log('QR-codes wijzen naar: http://' + lanIp() + ':' + port + '  (scannen met je telefoon: zelfde wifi als deze computer)');
  else console.log('Let op: geen wifi-adres gevonden. Zet PUBLIC_URL in .env, anders kan een telefoon de QR-codes niet openen.');
}

if (require.main === module) main();
