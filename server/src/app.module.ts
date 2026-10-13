/* =========================================================
   OPTIMASYS QR — de hele server in één overzicht
   DatabaseModule  PostgreSQL of SQLite, tabellen, versleuteling
   AuthModule      account maken, bevestigen, inloggen, Mijn account, e-mail
   QrCodesModule   QR-codes maken/bewerken/verwijderen + bestanden
   AnalyticsModule statistieken (land/stad, unieke scans, CSV)
   HelpersModule   health, qr-types, link-check, adres zoeken, e-mailcheck
   VisitorModule   korte links /q/:id: regels, scan tellen, echte pagina
   ========================================================= */
import { UploadsController } from './qr-codes/uploads.controller';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { QrCodesController } from './qr-codes/qr-codes.controller';
import { QrCodesService } from './qr-codes/qr-codes.service';
import { AdminPanelController } from './qr-codes/admin-panel.controller';
import { AnalyticsController } from './analytics/analytics.controller';
import { HelpersController, SystemController } from './helpers/helpers.controller';
import { ContactController } from './helpers/contact.controller';
import { ShortLinksController } from './visitor/short-links.controller';
import { HousekeepingService } from './housekeeping.service';
import { ErrorFilter } from './common/http';

@Module({ controllers: [QrCodesController, UploadsController, AdminPanelController], providers: [QrCodesService], imports: [AuthModule] })
export class QrCodesModule {}

@Module({ controllers: [AnalyticsController], imports: [AuthModule] })
export class AnalyticsModule {}

@Module({ controllers: [SystemController, HelpersController, ContactController], imports: [AuthModule] })
export class HelpersModule {}

@Module({ controllers: [ShortLinksController] })
export class VisitorModule {}

@Module({
  imports: [DatabaseModule, AuthModule, QrCodesModule, AnalyticsModule, HelpersModule, VisitorModule],
  providers: [HousekeepingService, { provide: APP_FILTER, useClass: ErrorFilter }],
})
export class AppModule {}
