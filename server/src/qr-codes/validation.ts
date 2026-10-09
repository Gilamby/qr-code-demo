/* Validatie: controleert wat de frontend stuurt, op basis van dezelfde QR-types (shared/qr-types.js).
   Zo bestaan de regels maar op één plek (frontend én server). */
import { shared } from '../config/env';

export const QR_TYPES: any[] = shared('qr-types.js');
const DESIGN = shared('design-data.js');
const { safeDesign } = DESIGN;

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_TEXT = 500;
const BACKGROUNDS = ['optimasys', 'aurora', 'city', 'mountains', 'office', 'cafe', 'restaurant', 'custom'];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const SOCIAL_NETWORKS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'youtube', 'whatsapp', 'google', 'messenger', 'threads', 'pinterest', 'snapchat', 'telegram', 'signal', 'discord', 'reddit', 'bluesky', 'mastodon', 'twitch', 'kick', 'vimeo', 'spotify', 'applemusic', 'soundcloud', 'podcasts', 'tumblr', 'medium', 'substack', 'patreon', 'behance', 'dribbble', 'github', 'flickr', 'strava', 'xing', 'quora', 'wechat', 'line', 'vk', 'weibo', 'tripadvisor', 'yelp', 'etsy', 'airbnb', 'booking'];
function validHours(arr: any) {
  return Array.isArray(arr) && arr.length === 7 && arr.every((d) => d && (!d.o || (TIME.test(d.f) && TIME.test(d.t) && ((!d.f2 && !d.t2) || (TIME.test(d.f2) && TIME.test(d.t2))))));
}
function isUrl(v: string) { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (e) { return false; } }

// E-mail: naam@domein.extensie, geen spaties of dubbele punten, extensie minstens 2 letters
export const EMAIL = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

export function validateQrCode(body: any): { errors: string[]; value?: { typeId: string; contentType: string; content: Record<string, any>; design: Record<string, any> } } {
  const errors: string[] = [];
  const type = QR_TYPES.find((t) => t.id === (body && body.typeId));
  if (!type) return { errors: ['typeId: unknown QR type'] };

  const input = (body.content && typeof body.content === 'object') ? body.content : {};
  const content: Record<string, any> = {};
  for (const field of type.fields) {
    let v = input[field.key];
    if (v == null || String(v).trim() === '') continue;        // leeg = voorbeeldwaarde gebruiken
    v = String(v).trim();
    if (field.type === 'hours') {
      let ok = false; try { ok = validHours(JSON.parse(v)); } catch (e) {}
      if (!ok) errors.push(field.key + ': invalid opening hours');
      content[field.key] = v; continue;
    }
    if (field.type === 'address') {
      let a = null; try { a = JSON.parse(v); } catch (e) {}
      if (!a || typeof a.l !== 'string' || !a.l.trim() || a.l.length > 300 || (a.lat != null && !(Math.abs(a.lat) <= 90 && Math.abs(a.lon) <= 180))) errors.push(field.key + ': must be an address chosen from the search');
      content[field.key] = v; continue;
    }
    if (field.type === 'socials') {
      let o = null; try { o = JSON.parse(v); } catch (e) {}
      if (!o || typeof o !== 'object' || Array.isArray(o) || Object.keys(o).some((k) => !SOCIAL_NETWORKS.includes(k) || (o[k] && !isUrl(o[k])))) errors.push(field.key + ': invalid social links');
      content[field.key] = v; continue;
    }
    if (field.type === 'file') {
      let o = null; try { o = JSON.parse(v); } catch (e) {}
      if (!o || typeof o.n !== 'string' || !o.n.trim() || o.n.length > 120 || !(o.s >= 0 && o.s < 200 * 1048576)) errors.push(field.key + ': invalid file');
      // Al opgeslagen bestand (bij bewerken): verwijzing naar het bestand op de server
      else if (o.f != null && (typeof o.f !== 'string' || !/^[A-Za-z0-9_-]{10,40}$/.test(o.f))) errors.push(field.key + ': invalid file reference');
      // Het bestand zelf (max. 10 MB) als data-URL; alleen PDF of audio
      else if (o.d != null && (typeof o.d !== 'string' || o.d.length > 14 * 1048576 || !(field.accept === 'application/pdf' ? /^data:application\/pdf;base64,/ : /^data:audio\/[\w.+-]+;base64,/).test(o.d))) errors.push(field.key + ': file must be a ' + (field.accept === 'application/pdf' ? 'PDF' : 'audio file') + ' under 10 MB');
      content[field.key] = v; continue;
    }
    if (field.type === 'gallery') {
      let a = null; try { a = JSON.parse(v); } catch (e) {}
      if (!Array.isArray(a) || !a.length || a.length > 6 || a.some((x) => typeof x !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(x) || x.length > 1500000)) errors.push(field.key + ': 1-6 JPG/PNG/WebP images');
      content[field.key] = v; continue;
    }
    if (field.type === 'dishes') {
      let a = null; try { a = JSON.parse(v); } catch (e) {}
      if (!Array.isArray(a) || !a.length || a.length > 30 || a.some((d) => !d || typeof d.n !== 'string' || !d.n.trim() || d.n.length > 60 || (d.p != null && !/^\d{0,5}([.,]\d{0,2})?$/.test(String(d.p))))) errors.push(field.key + ': 1-30 dishes with a name and price');
      content[field.key] = v; continue;
    }
    if (field.type === 'image') {
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(v) || v.length > 3000000) errors.push(field.key + ': must be a JPG/PNG/WebP image under 3 MB');
      content[field.key] = v; continue;
    }
    if (v.length > MAX_TEXT) errors.push(field.key + ': too long');
    if (field.type === 'url' && !isUrl(v)) errors.push(field.key + ': must be a http(s) URL');
    if (field.type === 'email' && !EMAIL.test(v)) errors.push(field.key + ': invalid email');
    if (field.type === 'tel' && !/^\+\d{7,16}$/.test(v.replace(/\s/g, ''))) errors.push(field.key + ': must be a phone number with country code (+31 …)');
    if (field.type === 'number') { const n = Number(v), lo = field.min != null ? field.min : 0, hi = field.max != null ? field.max : 100; if (isNaN(n) || n < lo || n > hi || (field.min != null && !Number.isInteger(n))) errors.push(field.key + ': must be ' + lo + '-' + hi); }
    if (field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)))) errors.push(field.key + ': must be a date (YYYY-MM-DD)');
    if (field.type === 'toggle' && v !== '1') errors.push(field.key + ': must be 1 or empty');
    if (field.type === 'password' && (v.length < 4 || v.length > 64)) errors.push(field.key + ': must be 4-64 characters');
    if (field.type === 'select' && !field.options.some((o) => o.value === v)) errors.push(field.key + ': invalid option');
    content[field.key] = v;
  }
  for (const key of Object.keys(input)) if (!type.fields.some((f) => f.key === key)) errors.push(key + ': unknown field');
  for (const f of type.fields) if (f.required && !content[f.key]) errors.push(f.key + ': required');

  const dv = validateDesign(body.design || {}, errors);
  return { errors, value: { typeId: type.id, contentType: type.contentType, content, design: dv } };
}

export function validateDesign(design: any, errors: string[]) {
  design = Object.assign({ color: '#0b0e13', background: '#ffffff' }, design);
  if (!HEX.test(design.color || '')) errors.push('design.color: must be #rrggbb');
  if (!HEX.test(design.background || '')) errors.push('design.background: must be #rrggbb');

  if (design.pageColor !== undefined && !HEX.test(design.pageColor)) errors.push('design.pageColor: must be #rrggbb');
  if (design.accentColor !== undefined && !HEX.test(design.accentColor)) errors.push('design.accentColor: must be #rrggbb');
  const cleanDesign: Record<string, any> = { color: design.color, background: design.background };
  // Uitgebreid ontwerp (stap 3): alleen bekende waarden doorlaten
  const ENUMS: Record<string, string[]> = {
    // huidige opties + oude namen (die safeDesign omzet naar de dichtstbijzijnde nette optie)
    pattern: DESIGN.DESIGN_PATTERNS.concat(Object.keys(DESIGN.REPLACE.pattern)),
    cornerOuter: DESIGN.DESIGN_OUTER.concat(Object.keys(DESIGN.REPLACE.cornerOuter)),
    cornerInner: DESIGN.DESIGN_INNER.concat(Object.keys(DESIGN.REPLACE.cornerInner)),
    frame: [].concat.apply([], Object.values(DESIGN.FRAME_GROUPS)).concat(Object.keys(DESIGN.REPLACE.frame)),
    frameFont: DESIGN.FRAME_FONTS.concat(Object.keys(DESIGN.REPLACE.frameFont)),
    decor: DESIGN.DESIGN_DECOR,
    gradient: ['', 'linear', 'radial'] };
  for (const [k, list] of Object.entries(ENUMS)) if (design[k] !== undefined) { if (!list.includes(design[k])) errors.push('design.' + k + ': unknown value'); else cleanDesign[k] = design[k]; }
  for (const k of ['color2', 'frameColor', 'frameColor2', 'cornerColor', 'cornerInnerColor']) if (design[k]) { if (!HEX.test(design[k])) errors.push('design.' + k + ': must be #rrggbb'); else cleanDesign[k] = design[k]; }
  if (design.transparent !== undefined) cleanDesign.transparent = !!design.transparent;
  if (typeof design.themeId === 'string' && /^[a-z]{0,20}$/.test(design.themeId)) cleanDesign.themeId = design.themeId;
  if (design.frameGradient !== undefined) cleanDesign.frameGradient = !!design.frameGradient;
  if (design.frameText) { if (typeof design.frameText !== 'string' || design.frameText.length > 32) errors.push('design.frameText: max 32 characters'); else cleanDesign.frameText = design.frameText; }
  if (design.logo) { if (!(typeof design.logo === 'string' && /^data:image\/(jpeg|png|webp|svg\+xml);base64,/.test(design.logo) && design.logo.length < 1500000)) errors.push('design.logo: must be an image under 1 MB'); else cleanDesign.logo = design.logo; }
  if (design.pageColor) cleanDesign.pageColor = design.pageColor;
  if (design.accentColor) cleanDesign.accentColor = design.accentColor;
  return errors.length ? cleanDesign : safeDesign(cleanDesign);   // altijd netjes en scanbaar opslaan
}

export function validateMe(body: any) {
  const errors: string[] = [], value: { background?: string; customBackground?: string | null } = {};
  if (body.background !== undefined) {
    if (!BACKGROUNDS.includes(body.background)) errors.push('background: unknown');
    else value.background = body.background;
  }
  if (body.customBackground !== undefined) {
    const v = body.customBackground;
    if (v !== null && !(typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length < 3000000)) errors.push('customBackground: must be a JPG/PNG/WebP data URL under 3 MB');
    else value.customBackground = v;
  }
  return { errors, value };
}

