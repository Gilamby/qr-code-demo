/* =========================================================
   STIJLEN: kant-en-klare looks, in groepen, plus aanbevelingen.
   - Klassiek is altijd de standaard en staat altijd vooraan.
   - Aanbevelingen lezen wat de gebruiker invulde (bv. "Café …" → koffie-stijlen),
     kijken naar het type (WiFi → hotel/wifi) en naar het seizoen (oktober → Halloween).
   ========================================================= */




/* Woorden in de inhoud → onderwerp. Meerdere talen, zonder accenten vergeleken. */

/* Type → onderwerpen die er (bijna) altijd bij passen */

/* Seizoen op basis van de datum van de gebruiker */
function currentSeason(now) {
  now = now || new Date();
  var m = now.getMonth() + 1, d = now.getDate();
  if (m === 2 && d <= 14) return 'valentine';
  if ((m === 3 && d >= 15) || (m === 4 && d <= 20)) return 'easter';
  if (m >= 6 && m <= 8) return 'summer';
  if (m === 10 || (m === 11 && d <= 1)) return 'halloween';
  if (m === 12 && d <= 26) return 'xmas';
  if ((m === 12 && d >= 27) || (m === 1 && d <= 6)) return 'newyear';
  if (m <= 2) return 'winter';
  return '';
}

function contentText(state) {
  var c = state.content[state.typeId] || {}, parts = [];
  Object.keys(c).forEach(function (k) { var v = c[k]; if (typeof v === 'string' && !/^data:/.test(v) && v.charAt(0) !== '[' && v.charAt(0) !== '{') parts.push(v); });
  try { var a = JSON.parse(c.address || 'null'); if (a && a.l) parts.push(a.l); } catch (e) {}
  var raw = (' ' + parts.join(' ') + ' ').toLowerCase().normalize('NFC');
  contentText.raw = raw;
  return raw.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
// Het echte woord (met accenten) uit de inhoud, bv. "cafe" → "Café"
function contentWord(state, hit) {
  var txt = contentText(state), raw = contentText.raw || '', p = txt.indexOf(hit), w = hit.trim();
  if (p >= 0) p += hit.length - hit.replace(/^ +/, '').length;
  if (p >= 0 && raw.length === txt.length) { var s = p; while (s > 0 && /[\p{L}\p{M}']/u.test(raw.charAt(s - 1))) s--; var m = raw.slice(s).match(/^[\p{L}\p{M}']+/u); if (m) w = m[0]; }
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/* Aanbevelingen: Klassiek altijd eerst, daarna max. 3 met een reden. */
function recommendThemes(state) {
  var txt = contentText(state), seen = { classic: 1 }, picks = [];
  function add(th, reason, max) { if (th && !seen[th.id] && picks.length < (max || 3)) { seen[th.id] = 1; picks.push({ theme: th, reason: reason }); } }
  // 1. Wat de gebruiker zelf schreef (max. 2)
  Object.keys(THEME_KEYWORDS).forEach(function (tag) {
    var hit = THEME_KEYWORDS[tag].filter(function (w) { return txt.indexOf(w) >= 0; })[0];
    if (!hit) return;
    DESIGN_THEMES.filter(function (th) { return (th.tags || []).indexOf(tag) >= 0; })
      .sort(function (a, b) { return a.tags.indexOf(tag) - b.tags.indexOf(tag); })     // waar het hoofdonderwerp is eerst
      .forEach(function (th) { add(th, { k: 'dz.why.word', v: contentWord(state, hit) }, 2); });
  });
  // 2. Het type QR-code (tot 2 in totaal)
  (TYPE_TAGS[state.typeId] || []).forEach(function (tag) {
    DESIGN_THEMES.filter(function (th) { return (th.tags || []).indexOf(tag) >= 0; }).forEach(function (th) { add(th, { k: 'dz.why.type', v: typeName(getType(state.typeId)) }, 2); });
  });
  // 3. Het seizoen (bv. oktober → Halloween)
  var season = currentSeason();
  if (season) add(DESIGN_THEMES.filter(function (th) { return th.season === season; })[0], { k: 'dz.why.season' });
  // 4. Aanvullen
  add(DESIGN_THEMES.filter(function (th) { return th.id === 'brand'; })[0], { k: 'dz.why.brand' });
  add(DESIGN_THEMES.filter(function (th) { return th.id === 'modern'; })[0], { k: 'dz.why.popular' });
  return [{ theme: DESIGN_THEMES[0], reason: { k: 'dz.why.classic' } }].concat(picks);
}
