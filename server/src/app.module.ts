/* =========================================================
   QR-CODEX — de hele server in één overzicht
   DatabaseModule  PostgreSQL of SQLite, tabellen, versleuteling
   AuthModule      account maken, bevestigen, inloggen, Mijn account, e-mail
   QrCodesModule   QR-codes maken/bewerken/verwijderen + bestanden
   AnalyticsModule statistieken (land/stad, unieke scans, CSV)
   HelpersModule   health, qr-types, link-check, adres zoeken, e-mailcheck
   VisitorModule   korte links /q/:id: regels, scan tellen, echte pagina
   ========================================================= */
import { LegalPagesController } from './helpers/legal-pages.controller';
import { UploadsController } from './qr-codes/uploads.controller';
import { MediaController } from './qr-codes/media.controller';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { QrCodesController } from './qr-codes/qr-codes.controller';
import { FeedbackController } from './qr-codes/feedback.controller';
import { SignupController } from './qr-codes/signup.controller';
import { FormController } from './qr-codes/form.controller';
import { QrCodesService } from './qr-codes/qr-codes.service';
import { AdminPanelController } from './qr-codes/admin-panel.controller';
import { FoldersController } from './qr-codes/folders.controller';
import { AnalyticsController } from './analytics/analytics.controller';
import { HelpersController, SystemController } from './helpers/helpers.controller';
import { UnsubscribeController } from './helpers/unsubscribe.controller';
import { ContactController } from './helpers/contact.controller';
import { TranslationsController } from './helpers/translations.controller';
import { ShortLinksController } from './visitor/short-links.controller';
import { HousekeepingService } from './housekeeping.service';
import { DomainsController } from './helpers/domains.controller';
import { TicketsController } from './helpers/tickets.controller';
import { StatusController } from './helpers/status.controller';
import { ErrorFilter } from './common/http';

@Module({ controllers: [FeedbackController, SignupController, FormController, QrCodesController, UploadsController, MediaController, AdminPanelController, FoldersController], providers: [QrCodesService], imports: [AuthModule] })
export class QrCodesModule {}

@Module({ controllers: [AnalyticsController], imports: [AuthModule] })
export class AnalyticsModule {}

@Module({ controllers: [SystemController, HelpersController, ContactController, TranslationsController, UnsubscribeController, DomainsController, StatusController, TicketsController, LegalPagesController], imports: [AuthModule] })
export class HelpersModule {}

@Module({ controllers: [ShortLinksController], imports: [AuthModule] })
export class VisitorModule {}

@Module({
  imports: [DatabaseModule, AuthModule, QrCodesModule, AnalyticsModule, HelpersModule, VisitorModule],
  providers: [HousekeepingService, { provide: APP_FILTER, useClass: ErrorFilter }],
})
export class AppModule {}
