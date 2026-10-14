/* =========================================================
   VERTALINGEN BEHEREN
   De teksten staan in public/locales/<taal>.json. Admins kunnen elke tekst per taal aanpassen
   zonder programmeur: die aanpassingen staan in de database (settings 'i18n:<taal>') en gaan
   bij het laden over de bestanden heen. Herstellen = de aanpassing weghalen.
   Publiek (voor iedereen):
     GET  /api/i18n/:lang                         aanpassingen voor die taal { "sleutel.pad": "tekst" }
   Alleen admins:
     GET  /api/admin/translations                 alle aanpassingen + DeepL-status (en verbruik)
     PUT  /api/admin/translations/:lang           { key, value }   value leeg = herstellen
     POST /api/admin/translations/translate       { texts: [...], to, from? }   via DeepL
     PUT  /api/admin/deepl                        { key }  (alleen super-admin; versleuteld opgeslagen)
     DELETE /api/admin/deepl                      sleutel weghalen
   DeepL-sleutel: DEEPL_API_KEY in .env, of via de pagina Instellingen.
   ========================================================= */
import { Body, Controller, Delete, Get, HttpCode, HttpException, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { encrypt, decrypt } from '../database/secret';
import { LoggedIn } from '../auth/auth.guard';
import { TeamOnly } from '../auth/admin.controller';
import { AuthService } from '../auth/auth.service';
import { PATHS } from '../config/env';
import { fail } from '../common/http';
import { LANGS, overridesOf } from './i18n-overrides';

// DeepL-taalcodes (doeltaal). Albanees kent DeepL (nog) niet: dan een nette melding.
const DEEPL_TARGET: Record<string, string> = { en: 'EN-GB', nl: 'NL', fr: 'FR', es: 'ES', it: 'IT', de: 'DE', pt: 'PT-PT', pl: 'PL', el: 'EL' };
const DEEPL_SOURCE: Record<string, string> = { en: 'EN', nl: 'NL', fr: 'FR', es: 'ES', it: 'IT', de: 'DE', pt: 'PT', pl: 'PL', el: 'EL' };

/** Alle bestaande sleutels (uit het Engelse bestand): alleen die mogen aangepast worden */
let known: Set<string> = null;
function knownKeys() {
  if (known) return known;
  const flat = (o: any, pre = '', out = new Set<string>()) => { for (const [k, v] of Object.entries(o || {})) { const key = pre ? pre + '.' + k : k; if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out); else out.add(key); } return out; };
  try { known = flat(JSON.parse(fs.readFileSync(path.join(PATHS.locales, 'en.json'), 'utf8'))); } catch (e) { known = new Set(); }
  return known;
}

@Controller()
export class TranslationsController {
  constructor(private readonly db: DatabaseService, private readonly auth: AuthService) {}

  /** Voor iedereen: de app legt dit over de taalbestanden heen */
  @Get('api/i18n/:lang')
  async publicOverrides(@Param('lang') lang: string, @Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', 'no-cache');
    return overridesOf(this.db, lang);
  }

  @Get('api/admin/translations')
  @UseGuards(LoggedIn, TeamOnly)
  async all() {
    const overrides: Record<string, Record<string, string>> = {};
    for (const l of LANGS) overrides[l] = await overridesOf(this.db, l);
    const key = await this.deeplKey(), deepl: any = { configured: !!key, fromEnv: !!process.env.DEEPL_API_KEY, langs: Object.keys(DEEPL_TARGET) };
    if (key) {
      try {
        const r = await fetch(this.deeplUrl(key) + '/v2/usage', { headers: { Authorization: 'DeepL-Auth-Key ' + key }, signal: AbortSignal.timeout(5000) });
        if (r.ok) { const u: any = await r.json(); deepl.used = u.character_count; deepl.limit = u.character_limit; } else deepl.error = r.status === 403 ? 'key' : 'unavailable';
      } catch (e) { deepl.error = 'unavailable'; }
    }
    return { langs: LANGS, overrides, deepl };
  }

  @Put('api/admin/translations/:lang')
  @UseGuards(LoggedIn, TeamOnly)
  async save(@Param('lang') lang: string, @Body() b: any = {}) {
    if (!LANGS.includes(lang)) throw fail(400, 'lang');
    const key = String(b.key || '');
    if (!/^[A-Za-z0-9_.-]{1,160}$/.test(key) || !knownKeys().has(key)) throw fail(400, 'key');
    const o = await overridesOf(this.db, lang);
    const value = b.value == null ? '' : String(b.value);
    if (value.length > 4000) throw fail(400, 'too_long');
    if (value.trim()) o[key] = value; else delete o[key];
    await this.db.setSetting('i18n:' + lang, Object.keys(o).length ? JSON.stringify(o) : null);
    return { key, value: o[key] || null, count: Object.keys(o).length };
  }

  /** Teksten laten vertalen door DeepL. {naam}-plekken blijven staan. */
  @Post('api/admin/translations/translate')
  @HttpCode(200)
  @UseGuards(LoggedIn, TeamOnly)
  async translate(@Req() req: Request, @Body() b: any = {}) {
    const key = await this.deeplKey(); if (!key) throw fail(400, 'no_deepl');
    if (this.auth.limited('deepl:' + (req.user && req.user.id), 60, 10)) throw fail(429, 'too_many');
    const to = String(b.to || ''), from = String(b.from || 'en');
    if (!DEEPL_TARGET[to]) throw fail(400, 'unsupported_lang');
    const texts: string[] = Array.isArray(b.texts) ? b.texts.slice(0, 50).map((x: unknown) => String(x == null ? '' : x).slice(0, 4000)) : [];
    if (!texts.length) throw fail(400, 'texts');
    // {naam} beschermen: DeepL laat alles binnen <x>…</x> ongemoeid
    const wrap = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{(\w+)\}/g, '<x>{$1}</x>');
    const unwrap = (s: string) => s.replace(/<x>(\{\w+\})<\/x>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    let r: globalThis.Response;
    try {
      r = await fetch(this.deeplUrl(key) + '/v2/translate', {
        method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { Authorization: 'DeepL-Auth-Key ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texts.map(wrap), target_lang: DEEPL_TARGET[to], source_lang: DEEPL_SOURCE[from] || 'EN', tag_handling: 'xml', ignore_tags: ['x'], preserve_formatting: true }),
      });
    } catch (e) { throw fail(502, 'deepl_unavailable'); }
    if (r.status === 403) throw fail(400, 'deepl_key');
    if (r.status === 456) throw fail(400, 'deepl_quota');
    if (!r.ok) throw fail(502, 'deepl_unavailable');
    const out: any = await r.json();
    return { texts: (out.translations || []).map((x: any) => unwrap(String(x.text || ''))) };
  }

  /** DeepL-sleutel opslaan (versleuteld) of weghalen: alleen de super-admin */
  @Put('api/admin/deepl')
  @UseGuards(LoggedIn, TeamOnly)
  async setKey(@Req() req: Request, @Body() b: any = {}) {
    if (!this.auth.isSuper(req.user)) throw fail(403, 'super_only');
    const key = String(b.key || '').trim();
    if (!/^[A-Za-z0-9-]{20,80}(:fx)?$/.test(key)) throw fail(400, 'key_format');
    // Even controleren of de sleutel werkt
    try {
      const r = await fetch(this.deeplUrl(key) + '/v2/usage', { headers: { Authorization: 'DeepL-Auth-Key ' + key }, signal: AbortSignal.timeout(8000) });
      if (r.status === 403) throw fail(400, 'deepl_key');
    } catch (e) { if (e instanceof HttpException) throw e; /* DeepL even niet bereikbaar: toch opslaan */ }
    await this.db.setSetting('deepl_key', encrypt(key));
    return { configured: true };
  }
  @Delete('api/admin/deepl')
  @UseGuards(LoggedIn, TeamOnly)
  @HttpCode(204)
  async removeKey(@Req() req: Request) {
    if (!this.auth.isSuper(req.user)) throw fail(403, 'super_only');
    await this.db.setSetting('deepl_key', null);
  }

  private async deeplKey() {
    if (process.env.DEEPL_API_KEY) return process.env.DEEPL_API_KEY.trim();
    const v = await this.db.getSetting('deepl_key');
    try { return v ? decrypt(v) : null; } catch (e) { return null; }
  }
  /** Gratis sleutels eindigen op ":fx" en gebruiken een ander adres */
  private deeplUrl(key: string) { return /:fx$/.test(key) ? 'https://api-free.deepl.com' : 'https://api.deepl.com'; }
}
