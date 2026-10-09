/* Opruimen, elk uur: verlopen sessies en links, nooit bevestigde accounts (na 7 dagen) */
import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Injectable()
export class HousekeepingService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout;
  constructor(private readonly db: DatabaseService) {}

  onApplicationBootstrap() {
    const tidy = () => this.db.cleanup().catch((e) => console.error('Opruimen mislukt:', e.message));
    tidy();
    this.timer = setInterval(tidy, 3600e3); this.timer.unref();
  }
  onApplicationShutdown() { clearInterval(this.timer); }
}
