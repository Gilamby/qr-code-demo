/* =========================================================
   PRIVACYVERKLARING · VOORWAARDEN · COOKIES als eigen pagina's
   GET /privacy   GET /terms   GET /cookies   (?lang=nl; anders de taal uit de app of de browser)
   Openbaar (ook zonder account), op de server opgebouwd: werkt zonder JavaScript, is te printen en heeft een eigen adres.
   De app opent ze in een nieuw tabblad. Teksten: public/locales/<taal>.json (sleutels legal.*) met de aanpassingen
   uit Beheer > Vertalingen eroverheen. Opbouw: legal.<doc>.title, .updated, .intro, s1t/s1, s2t/s2 …
   In een tekst: lege regel = nieuwe alinea, regel die begint met "- " = opsomming, **vet**.
   ========================================================= */
import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { PATHS } from '../config/env';
import { LANGS, fromAcceptLanguage, overridesOf } from './i18n-overrides';
import { legalInfo } from './helpers.controller';
import { PICK_LANG } from '../visitor/rules';

const DOCS = ['privacy', 'terms', 'cookies'];
const NAMES: Record<string, string> = { bg: 'Български', ca: 'Català', da: 'Dansk', de: 'Deutsch', el: 'Ελληνικά', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano', lv: 'Latviešu', nl: 'Nederlands', nb: 'Norsk', pl: 'Polski', pt: 'Português', ro: 'Română', sq: 'Shqip', sk: 'Slovenčina', fi: 'Suomi', sv: 'Svenska' };
const files: Record<string, any> = {};
function file(l: string) {
  if (!files[l]) { try { files[l] = JSON.parse(fs.readFileSync(path.join(PATHS.locales, l + '.json'), 'utf8')); } catch (e) { files[l] = {}; } }
  return files[l];
}
const get = (o: any, key: string) => key.split('.').reduce((x, k) => (x && x[k] != null ? x[k] : undefined), o);
const esc = (s: unknown) => String(s == null ? '' : s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
/** Alinea's en opsommingen (zelfde regels als de app) */
function paragraphs(text: string) {
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  return String(text).split(/\n\s*\n/).map((block) => {
    let out = '', list: string[] = [], txt: string[] = [];
    const flushList = () => { if (list.length) { out += '<ul>' + list.map((l) => '<li>' + inline(l) + '</li>').join('') + '</ul>'; list = []; } };
    const flushText = () => { if (txt.length) { out += '<p>' + txt.map(inline).join('<br>') + '</p>'; txt = []; } };
    block.split('\n').forEach((l) => { if (/^\s*- /.test(l)) { flushText(); list.push(l.replace(/^\s*- /, '')); } else { flushList(); txt.push(l); } });
    flushText(); flushList();
    return out;
  }).join('');
}

@Controller()
export class LegalPagesController {
  constructor(private readonly db: DatabaseService) {}

  @Get(['privacy', 'terms', 'cookies'])
  async page(@Req() req: Request, @Res() res: Response) {
    const doc = req.path.replace(/^\/|\/$/g, '');
    if (!DOCS.includes(doc)) return res.status(404).end();
    const q = String((req.query as any).lang || '').toLowerCase();
    const l = LANGS.includes(q) ? q : fromAcceptLanguage(req.get('accept-language'));
    const over = await overridesOf(this.db, l), en = file('en'), mine = file(l);
    const co = await legalInfo(this.db);
    const vars: Record<string, string> = { company: co.name, email: co.email };
    const t = (key: string) => {
      const v = over[key] != null ? over[key] : get(mine, key) != null ? get(mine, key) : get(en, key);
      return v == null ? '' : String(v).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    };
    const secs: { id: string; title: string; text: string }[] = [];
    for (let i = 1; t('legal.' + doc + '.s' + i + 't'); i++) secs.push({ id: 's' + i, title: t('legal.' + doc + '.s' + i + 't'), text: t('legal.' + doc + '.s' + i) });
    const href = (d: string, lang = l) => '/' + d + '?lang=' + lang;
    const company = [co.name, co.address, co.kvk ? t('legal.kvk').replace('{n}', co.kvk) : '', co.vat ? t('legal.vat').replace('{n}', co.vat) : '', co.email, co.phone].filter(Boolean);
    const html = '<!doctype html><html lang="' + l + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(t('legal.' + doc + '.title')) + ' · QR-Codex</title><meta name="description" content="' + esc(t('legal.' + doc + '.title')) + ' – QR-Codex by Optimasys">' +
      '<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/css/fonts.css">' + PICK_LANG +
      '<style>' +
      ':root{color-scheme:light dark;--bg:#f6f8fb;--card:#fff;--fg:#0f172a;--muted:#5b6678;--line:#e3e8ef;--accent:#0a68a0;--soft:#eef6fd}' +
      '@media (prefers-color-scheme:dark){:root{--bg:#070d18;--card:#0d1626;--fg:#eef3fb;--muted:#9aa6b5;--line:#1d2a3d;--accent:#4cb4f2;--soft:#10233a}}' +
      '*{box-sizing:border-box}html{scroll-behavior:smooth}@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}' +
      'body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 Manrope,system-ui,-apple-system,"Segoe UI",sans-serif}' +
      'a{color:var(--accent)}a:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}' +
      '.top{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}' +
      '.top-in{max-width:1080px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}' +
      '.brand{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;font-weight:800;margin-right:auto}.brand img{width:32px;height:32px}.brand span{color:var(--accent)}.brand small{font-weight:600;color:var(--muted);font-size:12px}' +
      '.tabs{display:flex;gap:4px;flex-wrap:wrap}.tabs a{padding:7px 12px;border-radius:999px;color:var(--muted);text-decoration:none;font-weight:600;font-size:14px}.tabs a[aria-current]{background:var(--soft);color:var(--accent)}.tabs a:hover{color:var(--fg)}' +
      'select{font:inherit;font-size:14px;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:6px 10px}' +
      '.wrap{max-width:1080px;margin:0 auto;padding:40px 20px 80px;display:grid;grid-template-columns:240px minmax(0,1fr);gap:48px;align-items:start}' +
      '.toc{position:sticky;top:84px;font-size:14px}.toc b{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:10px}.toc ol{list-style:none;margin:0;padding:0;display:grid;gap:2px}.toc a{display:block;padding:5px 10px;border-radius:8px;color:var(--muted);text-decoration:none;line-height:1.35}.toc a:hover{background:var(--soft);color:var(--fg)}' +
      'article{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:44px 48px}' +
      'h1{font-size:clamp(28px,4vw,38px);line-height:1.15;letter-spacing:-.02em;margin:0 0 8px}.upd{color:var(--muted);font-size:14px;margin:0 0 26px}' +
      '.intro{font-size:17px;padding-bottom:22px;border-bottom:1px solid var(--line);margin-bottom:8px}' +
      'section{scroll-margin-top:90px;padding-top:22px}h2{font-size:20px;margin:0 0 8px;display:flex;gap:10px;align-items:baseline}h2 span{color:var(--accent);font-variant-numeric:tabular-nums;font-size:16px}' +
      'p{margin:0 0 12px}ul{margin:0 0 12px;padding-left:22px}li{margin:4px 0}' +
      '.company{margin-top:34px;padding:18px 20px;border-radius:14px;background:var(--soft);font-size:14.5px}.company b{display:block;margin-bottom:4px}' +
      '@media (max-width:860px){.wrap{grid-template-columns:minmax(0,1fr);gap:20px;padding-top:24px}.toc{display:none}.top{position:static}article{padding:28px 22px;border-radius:16px}}' +
      '@media print{.top,.toc{display:none}body{background:#fff;color:#000}.wrap{display:block;padding:0}article{border:0;padding:0}}' +
      '</style></head><body>' +
      '<header class="top"><div class="top-in"><a class="brand" href="/"><img src="/icons/logo-badge.png" alt=""><b>QR-<span>Codex</span></b><small>by Optimasys</small></a>' +
      '<nav class="tabs" aria-label="' + esc(t('legal.nav')) + '">' + DOCS.map((d) => '<a href="' + href(d) + '"' + (d === doc ? ' aria-current="page"' : '') + '>' + esc(t('legal.' + d + '.short')) + '</a>').join('') + '</nav>' +
      '<select aria-label="Language" onchange="location.href=this.value">' + LANGS.slice().sort((a, b) => NAMES[a].localeCompare(NAMES[b])).map((x) => '<option value="' + href(doc, x) + '"' + (x === l ? ' selected' : '') + '>' + NAMES[x] + '</option>').join('') + '</select></div></header>' +
      '<div class="wrap">' +
      (secs.length ? '<nav class="toc" aria-label="' + esc(t('legal.toc')) + '"><b>' + esc(t('legal.toc')) + '</b><ol>' + secs.map((s, n) => '<li><a href="#' + s.id + '">' + (n + 1) + '. ' + esc(s.title) + '</a></li>').join('') + '</ol></nav>' : '<span></span>') +
      '<article><h1>' + esc(t('legal.' + doc + '.title')) + '</h1><p class="upd">' + esc(t('legal.updated').replace('{date}', t('legal.' + doc + '.updated'))) + '</p>' +
      '<div class="intro">' + paragraphs(t('legal.' + doc + '.intro')) + '</div>' +
      secs.map((s, n) => '<section id="' + s.id + '"><h2><span>' + (n + 1) + '.</span>' + esc(s.title) + '</h2>' + paragraphs(s.text) + '</section>').join('') +
      '<div class="company"><b>' + esc(t('legal.contact')) + '</b>' + company.map(esc).join('<br>') + '</div></article></div></body></html>';
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  }
}
