/* Alleen voor ingelogde gebruikers (@UseGuards(LoggedIn)), en @CurrentUser() om de gebruiker op te halen */
import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { fail } from '../common/http';

@Injectable()
export class LoggedIn implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    if (!ctx.switchToHttp().getRequest<Request>().user) throw fail(401, 'Not logged in');
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request>().user);
