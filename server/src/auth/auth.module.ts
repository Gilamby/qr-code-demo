import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AccountController } from './account.controller';
import { AuthService } from './auth.service';
import { MailerService } from './mailer.service';
import { LoggedIn } from './auth.guard';
import { SupportAccountService } from './support-account.service';
import { AdminController, TeamOnly } from './admin.controller';

@Module({
  controllers: [AuthController, AccountController, AdminController],
  providers: [AuthService, MailerService, LoggedIn, SupportAccountService, TeamOnly],
  exports: [AuthService, MailerService, LoggedIn, TeamOnly],
})
export class AuthModule {}
