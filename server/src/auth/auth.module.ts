import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AccountController } from './account.controller';
import { AuthService } from './auth.service';
import { MailerService } from './mailer.service';
import { LoggedIn } from './auth.guard';

@Module({
  controllers: [AuthController, AccountController],
  providers: [AuthService, MailerService, LoggedIn],
  exports: [AuthService, MailerService, LoggedIn],
})
export class AuthModule {}
