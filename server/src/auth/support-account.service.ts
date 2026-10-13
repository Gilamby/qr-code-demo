/* =========================================================
   VAST ACCOUNT VOOR HET TEAM (bijvoorbeeld support@…)
   Zet in .env op de server:
     SUPPORT_EMAIL=support@voorbeeld.com
     SUPPORT_PASSWORD=een lange geheime zin
     SUPPORT_NAME=Optimasys Support        (optioneel)
   Bij het opstarten maakt de app dit account aan als het nog niet bestaat, al bevestigd,
   zodat het team meteen kan inloggen. Het wachtwoord staat alleen op de server, niet in de code.
   Bestaat het account al, dan blijft alles zoals het is (een gewijzigd wachtwoord wordt niet overschreven),
   behalve met SUPPORT_RESET_PASSWORD=true: dan krijgt het weer het wachtwoord uit .env.
   ========================================================= */
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EMAIL } from '../qr-codes/validation';
import { AuthService } from './auth.service';

@Injectable()
export class SupportAccountService implements OnApplicationBootstrap {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  async onApplicationBootstrap() {
    const email = String(process.env.SUPPORT_EMAIL || '').trim().toLowerCase(), password = String(process.env.SUPPORT_PASSWORD || '');
    if (!email) return;
    if (!EMAIL.test(email)) return console.warn('SUPPORT_EMAIL is geen geldig e-mailadres: ' + email);
    const problem = this.auth.passwordProblem(password);
    if (problem) return console.warn('SUPPORT_PASSWORD is niet goed genoeg (' + problem + '): het account ' + email + ' is niet aangemaakt. Gebruik minstens 8 tekens met een hoofdletter, een cijfer en een speciaal teken.');
    const existing = await this.db.userByEmail(email);
    if (!existing) {
      const user = await this.db.createUser({ email, name: String(process.env.SUPPORT_NAME || 'Optimasys Support').slice(0, 80), passwordHash: await this.auth.hashPassword(password) });
      await this.db.markVerified(user.id);
      console.log('Account voor het team staat klaar: ' + email);
      return;
    }
    if (!(await this.db.isVerified(existing.id))) await this.db.markVerified(existing.id);
    if (process.env.SUPPORT_RESET_PASSWORD === 'true') {
      await this.db.updateUser(existing.id, { passwordHash: await this.auth.hashPassword(password) });
      await this.db.deleteSessionsOf(existing.id);
      console.log('Wachtwoord van ' + email + ' teruggezet naar SUPPORT_PASSWORD.');
    }
  }
}
