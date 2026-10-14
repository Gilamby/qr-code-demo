/* Elk uur: opruimen (verlopen sessies en links, nooit bevestigde accounts na 7 dagen) en scanoverzichten per e-mail versturen */
import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { MailerService } from './auth/mailer.service';
import { sendDueReports } from './reports';

@Injectable()
export class HousekeepingService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout;
  constructor(private readonly db: DatabaseService, private readonly mailer: MailerService) {}

  onApplicationBootstrap() {
    const tidy = () => { this.db.cleanup().catch((e) => console.error('Opruimen mislukt:', e.message)); sendDueReports(this.db, this.mailer).catch((e) => console.error('Scanoverzichten mislukt:', e.message)); };
    tidy();
    this.timer = setInterval(tidy, 3600e3); this.timer.unref();
  }
  onApplicationShutdown() { clearInterval(this.timer); }
}
