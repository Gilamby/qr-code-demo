/* Alleen voor ingelogde gebruikers (@UseGuards(LoggedIn)), en @CurrentUser() om de gebruiker op te halen */
import { wasKicked } from '../database/database.service';
import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { fail } from '../common/http';

@Injectable()
export class LoggedIn implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) throw fail(401, req.sid && wasKicked(req.sid) ? 'device_limit' : 'Not logged in');   // device_limit: op een ander apparaat ingelogd
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request>().user);
