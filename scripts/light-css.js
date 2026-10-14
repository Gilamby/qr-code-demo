/* =========================================================
   LICHT THEMA (wordt gemaakt door npm run build → public/css/light.css)
   De app is ontworpen als donker glas. Voor het lichte thema hoeft niemand alle regels opnieuw te schrijven:
   dit script leest app.css en maakt van elke regel met "donker-thema-kleuren" een lichte versie:
     - wit-transparant (randen, hover, vlakjes)   → donker-transparant
     - zwart-transparant achter invulvelden        → wit
     - lichte pastelteksten (voor op donker)        → donkere varianten van dezelfde kleur
     - donkere vlakken                              → lichte vlakken
   Alles krijgt :root[data-theme="light"] ervoor, zodat het alleen in het lichte thema geldt.
   De telefoon-voorbeelden (de pagina die bezoekers zien) blijven zoals ze zijn: die hebben hun eigen kleuren.
   Onderaan staan een paar regels met de hand (glas, zijbalk, achtergrond).
   ========================================================= */
const fs = require('fs');
const path = require('path');

const PREFIX = ':root[data-theme="light"]';
// Kopjes in app.css waarvan de regels NIET omgezet worden (telefoon en voorbeeldpagina's)
// (een kopje = commentaar dat begint met ---- of ====; de eerste regel tekst is de titel)
// Klassen van de telefoon-voorbeelden (phone-templates.js / preview.js): die blijven altijd zoals ze zijn
const PHONE = /(^|[\s>+~,(])(\.screen|\.phone|\.status|\.(pv|wl|gm|as|web|wa|fb|sx|ig|vd|wf|mp|vc|lk2|gx|mn|lk|ap|mni|bz|th)-)/;   // th- = voorbeeldjes van de thema's zelf
const isSkipTitle = (title) => /^telefoon/i.test(title) && !/^telefoon *\(≤/i.test(title);
const INK = '13,19,32';
const PASTEL = {                                                     // licht op donker → donker op licht
  '#fca5a5': '#b91c1c', '#fecaca': '#991b1b', '#f87171': '#dc2626', '#86efac': '#15803d', '#4ade80': '#15803d', '#22c55e': '#16a34a',
  '#7dd3fc': '#0369a1', '#bae6fd': '#075985', '#e0f2fe': '#075985', '#fbbf24': '#b45309', '#fde68a': '#92400e', '#38bdf8': '#0284c7',
  '#a5b4fc': '#4338ca', '#cbd5e1': '#475569', '#c4b5fd': '#6d28d9', '#f9a8d4': '#be185d', '#fdba74': '#c2410c',
};
const DARK_BG = {                                                    // donkere vlakken → lichte vlakken
  '#07090c': '#eef2f7', '#0b0e13': '#f4f6f9', '#090b10': '#ffffff', '#0b1220': '#f4f7fb', '#13171e': '#ffffff', '#151a22': '#ffffff',
  '#12161d': '#f7f9fc', '#0e2a47': '#e0f2fe', '#12315a': '#dbeafe', '#0f172a': '#e2e8f0', '#111827': '#f1f5f9', '#1f2937': '#e5e7eb',
};
const round = (n) => Math.round(n * 1000) / 1000;

function convertValue(prop, value) {
  let v = value;
  const isBg = /^(background|background-color|background-image)$/.test(prop);
  const isShadow = /shadow/.test(prop);
  const isText = /^(color|fill|stroke|caret-color|outline-color|text-decoration-color)$/.test(prop);
  v = v.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/g, (m, a) => 'rgba(' + INK + ',' + round(Math.min(+a * (isBg ? 0.75 : 0.9), 0.85)) + ')');
  v = v.replace(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/g, (m, a) =>
    isBg ? 'rgba(255,255,255,' + round(Math.min(1, 0.6 + +a)) + ')' : isShadow ? 'rgba(' + INK + ',' + round(+a * 0.35) + ')' : 'rgba(' + INK + ',' + a + ')');
  if (isText || /border/.test(prop) || isBg) v = v.replace(/#[0-9a-fA-F]{6}\b/g, (h) => PASTEL[h.toLowerCase()] && isText ? PASTEL[h.toLowerCase()] : h);
  if (isBg) v = v.replace(/#[0-9a-fA-F]{6}\b/g, (h) => DARK_BG[h.toLowerCase()] || h);
  return v;
}

/** Heel eenvoudige CSS-lezer: regels, @media-blokken (worden doorlopen), de rest wordt overgeslagen */
function walk(css, out, skipFrom) {
  let i = 0, skip = false;
  while (i < css.length) {
    // commentaar: kijk of er een over te slaan onderdeel begint (telefoon), of juist weer een gewoon onderdeel
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2), text = css.slice(i, end + 2);
      if (/^\/\* *(-{5,}|={5,})/.test(text)) {
        const title = text.replace(/^\/\*|\*\/$/g, '').split('\n').map((l) => l.replace(/[-=]{3,}/g, '').trim()).filter(Boolean)[0] || '';
        skip = isSkipTitle(title);
      }
      i = end + 2; continue;
    }
    const brace = css.indexOf('{', i); if (brace < 0) break;
    const head = css.slice(i, brace).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    // einde van het blok zoeken (met geneste haakjes)
    let depth = 1, j = brace + 1;
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const inner = css.slice(brace + 1, j - 1);
    if (head.startsWith('@media')) {
      if (!/prefers-color-scheme/.test(head)) { const sub = []; walk(inner, sub, skip); if (sub.length) out.push(head + ' {\n' + sub.join('\n') + '\n}'); }
    } else if (head.startsWith('@')) { /* @keyframes, @font-face …: niet nodig */ }
    else if (!skip && !skipFrom && head && !/data-theme/.test(head) && !PHONE.test(head)) {
      const decls = inner.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const k = d.indexOf(':'); return [d.slice(0, k).trim(), d.slice(k + 1).trim()]; });
      const changed = decls.map(([p, v]) => { const nv = convertValue(p, v); return nv !== v ? p + ': ' + nv : null; }).filter(Boolean);
      if (changed.length) {
        const sel = head.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.startsWith(':root') ? s.replace(':root', PREFIX) : /^(html|body)\b/.test(s) ? s.replace(/^html/, ':root[data-theme="light"]').replace(/^body/, PREFIX + ' body') : PREFIX + ' ' + s).join(',\n');
        out.push(sel + ' { ' + changed.join('; ') + '; }');
      }
    }
    i = j;
  }
  return out;
}

const HAND = `
/* ---------- Met de hand: glas, zijbalk, achtergrond ---------- */
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="light"] body { background: #eef2f7; }
:root[data-theme="light"] body::after { background: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,.55)); }
:root[data-theme="light"] .glass { background: linear-gradient(140deg, rgba(255,255,255,.92), rgba(255,255,255,.78) 45%, rgba(255,255,255,.86)); border: 1px solid rgba(13,19,32,.08); box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 24px 60px -32px rgba(13,19,32,.28); }
:root[data-theme="light"] .sidebar { background: linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,.78)) !important; border-right: 1px solid rgba(13,19,32,.08) !important; box-shadow: none; }
:root[data-theme="light"] .topbar { background: rgba(244,246,249,.7); }
:root[data-theme="light"] select option { color: #0d1320; background: #fff; }
:root[data-theme="light"] .acct-av, :root[data-theme="light"] .acct-photo-av { color: #0369a1; }
:root[data-theme="light"] .acct-idc .acct-av > span:first-child { border-color: #fff; }
:root[data-theme="light"] .acct-av-cam { border-color: #fff; }
:root[data-theme="light"] .an-grid { stroke: rgba(13,19,32,.08); }
:root[data-theme="light"] .adm-label, :root[data-theme="light"] .adm-label em { color: #0369a1; }
:root[data-theme="light"] .mc-qr, :root[data-theme="light"] .hm-qr { box-shadow: 0 0 0 1px rgba(13,19,32,.08); }
`;

function build(root) {
  const src = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
  const rules = walk(src, []);
  const css = '/* Gemaakt door scripts/light-css.js uit app.css. Niet met de hand aanpassen: pas app.css of het script aan. */\n' + rules.join('\n') + '\n' + HAND;
  fs.writeFileSync(path.join(root, 'public', 'css', 'light.css'), css);
  return css;
}
module.exports = { build };
if (require.main === module) { const css = build(path.join(__dirname, '..')); console.log('light.css: ' + Math.round(css.length / 1024) + ' KB'); }
