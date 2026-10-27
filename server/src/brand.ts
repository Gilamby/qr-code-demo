/* =========================================================
   EIGEN MERK OP SCANPAGINA'S (white label, Business)
   - Klant zet een naam en logo (Mijn account > Eigen merk). Settings 'brand:<id>' = { name, logo: data-URL ≤ 150 KB }.
   - Scanpagina's van die klant: zijn logo als icoon in het tabblad (i.p.v. QR-Codex), en op de kleine pagina's
     (wachtwoord, gepauzeerd, verlopen, nog niet begonnen) zijn logo en naam bovenaan.
   - Icoon: GET /b/:id/icon (het logo als afbeelding, een dag in de cache).
   ========================================================= */
import type { DatabaseService } from './database/database.service';
import { planFor } from './plans';

export type Brand = { name: string; logo: string | null };
const LOGO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const esc = (s: string) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

export async function readBrand(db: DatabaseService, uid: string): Promise<Brand | null> {
  try { const v = JSON.parse((await db.getSetting('brand:' + uid)) || 'null'); return v && (v.name || v.logo) ? { name: String(v.name || ''), logo: v.logo || null } : null; } catch (e) { return null; }
}
export function cleanBrand(b: any): Brand | string {
  const name = String((b && b.name) || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const logo = b && b.logo ? String(b.logo) : null;
  if (logo && (!LOGO.test(logo) || logo.length > 200000)) return 'logo';
  if (!name && !logo) return 'empty';
  return { name, logo };
}
/** Merk van een eigenaar als zijn pakket het toestaat (10 min. onthouden; scans komen vaak achter elkaar) */
const cache = new Map<string, { at: number; b: Brand | null }>();
export async function activeBrand(db: DatabaseService, uid: string): Promise<Brand | null> {
  const c = cache.get(uid); if (c && Date.now() - c.at < 600e3) return c.b;
  let b: Brand | null = null;
  try { if ((await planFor(db, uid)).api) b = await readBrand(db, uid); } catch (e) { b = null; }
  cache.set(uid, { at: Date.now(), b }); return b;
}
export const forgetBrand = (uid: string) => cache.delete(uid);

/** In een kant-en-klare pagina: icoon in het tabblad en (kleine pagina's) logo + naam bovenaan */
export function withBrand(html: string, uid: string, b: Brand | null) {
  if (!b) return html;
  let out = html;
  if (b.logo) out = out.replace('</head>', '<link rel="icon" href="/b/' + encodeURIComponent(uid) + '/icon"></head>');
  const head = (b.logo ? '<img src="/b/' + encodeURIComponent(uid) + '/icon" alt="" style="width:56px;height:56px;border-radius:14px;object-fit:cover;display:block;margin:0 auto 10px">' : '') +
    (b.name ? '<div style="font-weight:700;font-size:14px;color:#5b6472;margin-bottom:14px">' + esc(b.name) + '</div>' : '');
  return out.replace(/<div class="ic">[^<]*<\/div>/, head || '$&');
}
