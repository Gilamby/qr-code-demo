import { GoogleController } from './google.controller';
import { MicrosoftController } from './microsoft.controller';
import { BillingController } from '../billing/billing.controller';
import { InvoicesAdminController, InvoiceFileController } from '../billing/invoices-admin.controller';
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AccountController } from './account.controller';
import { AuthService } from './auth.service';
import { MailerService } from './mailer.service';
import { LoggedIn } from './auth.guard';
import { SupportAccountService } from './support-account.service';
import { AdminController, TeamOnly, SuperOnly } from './admin.controller';
import { TeamController } from './team.controller';

@Module({
  controllers: [AuthController, GoogleController, MicrosoftController, BillingController, AccountController, AdminController, TeamController, InvoicesAdminController, InvoiceFileController],
  providers: [AuthService, MailerService, LoggedIn, SupportAccountService, TeamOnly, SuperOnly],
  exports: [AuthService, MailerService, LoggedIn, TeamOnly],
})
export class AuthModule {}
