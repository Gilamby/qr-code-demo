/* =========================================================
   QR-ASSISTENT – zelf geschreven taal-motor (geen externe AI).
   Leest een zin zoals "Halloween in oranje en zwart met vleermuizen en de tekst 'Boe!'"
   en maakt daar ontwerpen van: 3 varianten + wat hij begreep.

   Stappen:
   1. Tekst normaliseren (kleine letters, zonder accenten) en losse stukken eruit halen: "tekst", #kleurcodes.
   2. Woorden opzoeken in woordenlijsten (10 talen): gelegenheid/branche, kleuren, vormen, frames, versiering, lettertypes.
   3. Opdrachten die het huidige ontwerp aanpassen: "donkerder", "zonder frame", "andere variant".
   4. Ontwerp bouwen: basis = passende stijl of het huidige ontwerp, daarna kleuren/vormen/frame erop.
   5. Veiligheid: contrast controleren en de kleur zo nodig donkerder maken, zodat de code altijd scant.
   Gebruikt in de browser (demo) én op de server (/api/assistant).
   ========================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./design-data'));
  else root.QRAssistant = factory(root.DESIGN_DATA);
})(typeof self !== 'undefined' ? self : this, function (DATA) {

  /* ---------- Woordenlijsten (stamvormen, zonder accenten) ---------- */
  var COLORS = {
    '#111827': ['zwart', 'black', 'negro', 'schwarz', 'noir', 'nero', 'czarn', 'preto', 'μαυρ', 'mavr', 'zi', 'zeze'],
    '#ffffff': ['wit', 'white', 'blanco', 'weiss', 'blanc', 'bianco', 'bial', 'branco', 'λευκ', 'bardh'],
    '#dc2626': ['rood', 'rode', 'red', 'rojo', 'roja', 'rot', 'rote', 'roter', 'roten', 'rotem', 'rotes', 'rouge', 'rosso', 'czerwon', 'vermelh', 'κοκκιν', 'kuq', 'kuqe'],
    '#ea580c': ['oranje', 'orange', 'naranja', 'arancio', 'pomarancz', 'laranja', 'πορτοκαλ', 'portokall'],
    '#ca8a04': ['geel', 'gele', 'yellow', 'amarill', 'gelb', 'jaune', 'giall', 'zolt', 'amarel', 'κιτριν', 'verdh'],
    '#a16207': ['goud', 'gouden', 'gold', 'dorad', 'golden', 'oro', 'zlot', 'dourad', 'χρυσ', 'flori'],
    '#16a34a': ['groen', 'green', 'verde', 'grun', 'vert', 'zielon', 'πρασιν', 'jeshil'],
    '#0d9488': ['turquoise', 'turkoois', 'teal', 'turquesa', 'petrol'],
    '#2563eb': ['blauw', 'blue', 'azul', 'blau', 'bleu', 'blu', 'niebiesk', 'μπλε', 'blu '],
    '#1e3a8a': ['marineblauw', 'navy', 'donkerblauw', 'azul marino', 'marine'],
    '#7c3aed': ['paars', 'purple', 'morado', 'lila', 'violet', 'viola', 'fiolet', 'roxo', 'μωβ', 'vjollc'],
    '#db2777': ['roze', 'pink', 'rosa', 'rose', 'roz', 'rozow', 'ροζ', 'roze'],
    '#6b7280': ['grijs', 'grey', 'gray', 'gris', 'grau', 'grigio', 'szar', 'cinza', 'γκρι', 'gri'],
    '#78350f': ['bruin', 'brown', 'marron', 'braun', 'brun', 'marrone', 'brazow', 'castanh', 'καφε', 'kafe'],
    '#b91c1c': ['bordeaux', 'wijnrood', 'burgundy', 'granate']
  };
  var DARK = ['donker', 'dark', 'oscur', 'dunkel', 'fonce', 'scuro', 'ciemn', 'escur', 'σκουρ', 'erret'];
  var LIGHT = ['licht', 'light', 'clar', 'hell', 'clair', 'chiar', 'jasn', 'ανοιχτ', 'çel', 'cel'];
  var PASTEL = ['pastel', 'zacht', 'soft', 'suave'];
  var PATTERNS = {
    dots: ['rondjes', 'stippen', 'stip', 'dots', 'dotted', 'puntos', 'punkte', 'points', 'pallini', 'kropk', 'pontos', 'κουκκιδ', 'pika'],
    heart: ['hartjes', 'hearts', 'corazones', 'herzen', 'coeurs', 'cuori', 'serca', 'coracoes', 'καρδιες'],
    star: ['sterren', 'sterretjes', 'stars', 'estrellas', 'sterne', 'etoiles', 'stelle', 'gwiazd', 'estrelas', 'αστερια'],
    smooth: ['vloeiend', 'smooth', 'liquid', 'fluid', 'organisch', 'blob'],
    rounded: ['afgerond', 'rounded', 'redondead', 'abgerundet', 'arrondi', 'arrotondat', 'zaokraglon'],
    square: ['vierkant', 'blokjes', 'square', 'cuadrad', 'quadrat', 'carre', 'quadrat', 'kwadrat', 'pixel'],
    diamond: ['ruitjes', 'ruit', 'diamond', 'rombo', 'raute', 'losange'],
    vertical: ['strepen', 'stripes', 'rayas', 'streifen', 'rayures', 'strisce', 'paski'],
    mosaic: ['mozaiek', 'mosaic', 'mosaico', 'mosaik', 'mosaique'],
    tiny: ['fijn', 'klein', 'tiny', 'fine', 'fino', 'fein', 'minimal'],
    classy: ['elegant', 'chic', 'sierlijk', 'elegante', 'elegancki'],
    cross: ['plusjes', 'kruisjes', 'crosses', 'cruces', 'kreuze', 'croix']
  };
  var FRAMES = {
    coffee: ['koffiebeker', 'beker', 'coffee cup', 'taza', 'vaso de cafe', 'kaffeebecher', 'gobelet'],
    chalkboard: ['krijtbord', 'schoolbord', 'chalkboard', 'pizarra', 'kreidetafel', 'ardoise', 'lavagna'],
    cutlery: ['bestek', 'bord', 'cutlery', 'plate', 'cubiertos', 'besteck', 'couverts', 'posate'],
    noodles: ['afhaalbakje', 'noodle', 'takeaway box', 'wok'],
    pizza: ['pizzadoos', 'pizza box', 'caja de pizza'],
    bag: ['tas', 'tasje', 'boodschappentas', 'shopping bag', 'bag', 'bolsa', 'tasche', 'sac'],
    gift: ['cadeau', 'kado', 'gift', 'present', 'regalo', 'geschenk', 'pakje'],
    pricetag: ['prijskaartje', 'label prijs', 'price tag', 'etiqueta de precio', 'preisschild'],
    envelope: ['envelop', 'brief', 'envelope', 'sobre', 'umschlag', 'enveloppe', 'busta'],
    calendar: ['kalender', 'agenda', 'calendar', 'calendario', 'calendrier'],
    receipt: ['bonnetje', 'kassabon', 'receipt', 'ticket de compra', 'kassenbon'],
    box: ['pakketje', 'doos', 'parcel', 'box', 'paquete', 'paket', 'colis'],
    ornament: ['kerstbal', 'bauble', 'ornament', 'bola de navidad'],
    balloons: ['ballon', 'ballonnen', 'balloons', 'globos', 'luftballon'],
    confetti: ['confetti', 'konfetti', 'confeti'],
    pumpkin: ['pompoen', 'pumpkin', 'calabaza', 'kurbis', 'citrouille', 'zucca'],
    pin: ['locatie', 'pin', 'kaart', 'map pin', 'ubicacion', 'standort'],
    laptop: ['laptop', 'computer', 'portatil'],
    hanger: ['deurhanger', 'door hanger', 'colgador'],
    ticket: ['ticket', 'kaartje', 'entree', 'entrada', 'billet', 'biglietto'],
    polaroid: ['polaroid', 'foto', 'photo'],
    phone: ['telefoon', 'mobiel', 'phone', 'movil', 'handy'],
    badge: ['embleem', 'badge', 'rond frame', 'cirkel', 'circle', 'stempel'],
    bubble: ['tekstballon', 'ballonnetje', 'speech bubble', 'bocadillo', 'sprechblase'],
    script: ['handgeschreven', 'met pijl', 'pijl', 'arrow', 'flecha', 'pfeil', 'fleche'],
    label: ['label', 'kader', 'frame', 'marco', 'rahmen', 'cadre', 'cornice', 'ramk', 'moldura', 'πλαισιο', 'kornize'],
    heart: ['in een hart', 'hartvorm', 'heart shape', 'forma de corazon']
  };
  var NO_FRAME = ['zonder frame', 'geen frame', 'no frame', 'without frame', 'sin marco', 'ohne rahmen', 'sans cadre', 'senza cornice', 'zonder kader', 'bez ramk', 'sem moldura', 'χωρις πλαισιο', 'pa kornize'];
  var DECOR = {
    halloween: ['vleermuis', 'vleermuizen', 'bats', 'bat ', 'murcielago', 'fledermaus', 'chauve', 'spinnenweb', 'spider', 'web'],
    winter: ['sneeuw', 'sneeuwvlok', 'snow', 'nieve', 'schnee', 'neige', 'neve', 'ijs', 'snieg', 'χιον', 'bore'],
    xmas: ['kerstmuts', 'hulst', 'holly', 'santa', 'kerstman'],
    valentine: ['hartjes erom', 'met hartjes', 'liefde', 'love', 'amor', 'liebe', 'amour'],
    easter: ['eieren', 'paaseieren', 'eggs', 'huevos', 'eier', 'oeufs'],
    spring: ['bloemetjes', 'bloemen', 'flowers', 'flores', 'blumen', 'fleurs', 'fiori'],
    newyear: ['glitter', 'sparkle', 'vuurwerk', 'fireworks', 'brillo', 'feuerwerk'],
    birthday: ['feesthoed', 'party hat', 'verjaardag', 'birthday', 'cumpleanos', 'geburtstag', 'anniversaire', 'compleanno']
  };
  var NO_DECOR = ['zonder versiering', 'geen versiering', 'no decoration', 'sin decoracion'];
  var SEASONS = {
    halloween: ['halloween', 'griezel', 'spooky', 'eng'],
    xmas: ['kerst', 'christmas', 'xmas', 'navidad', 'weihnacht', 'noel', 'natale', 'swiet', 'natal', 'χριστουγενν', 'krishtlindj', 'boze narodzen'],
    valentine: ['valentijn', 'valentine', 'san valentin', 'valentinstag', 'saint-valentin', 'san valentino', 'walentynk'],
    easter: ['pasen', 'easter', 'pascua', 'ostern', 'paques', 'pasqua', 'wielkanoc', 'pascoa', 'πασχα', 'pashk'],
    newyear: ['nieuwjaar', 'oud en nieuw', 'new year', 'ano nuevo', 'neujahr', 'nouvel an', 'capodanno', 'nowy rok', 'ano novo'],
    summer: ['zomer', 'summer', 'verano', 'sommer', 'ete ', 'estate', 'lato', 'verao', 'strand', 'beach', 'playa'],
    winter: ['winter', 'invierno', 'hiver', 'inverno', 'zima'],
    birthday: ['verjaardag', 'birthday', 'cumpleanos', 'geburtstag', 'anniversaire', 'compleanno', 'urodzin'],
    wedding: ['bruiloft', 'huwelijk', 'trouwen', 'wedding', 'boda', 'hochzeit', 'mariage', 'matrimonio', 'slub']
  };
  var FONTS = { hand: ['handgeschreven', 'handwritten', 'manuscrit', 'script'], serif: ['klassiek', 'classic', 'serif', 'deftig'], bold: ['stoer', 'bold', 'dik', 'groot'], round: ['speels', 'playful', 'kinder', 'grappig', 'fun'] };
  var CMD = {
    darker: ['donkerder', 'darker', 'mas oscuro', 'dunkler', 'plus fonce', 'piu scuro'],
    lighter: ['lichter', 'lighter', 'mas claro', 'heller', 'plus clair', 'piu chiaro'],
    gradient: ['verloop', 'kleurverloop', 'gradient', 'degradado', 'farbverlauf', 'degrade'],
    logo: ['logo'],
    simpler: ['simpeler', 'rustiger', 'simpler', 'cleaner', 'minder', 'mas simple', 'einfacher'],
    other: ['andere variant', 'iets anders', 'something else', 'otra', 'anders', 'opnieuw', 'again']
  };

  /* ---------- Hulpjes ---------- */
  var norm = function (s) { return (' ' + String(s || '') + ' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,!?;:()]/g, ' ').replace(/\s+/g, ' '); };
  // Alleen zoeken aan het begin van een woord ("rondjes" bevat dus niet "dj"); de tekst begint en eindigt met een spatie.
  // Korte woorden (max. 3 letters, bv. "zi", "rot", "web") en woorden met een spatie erachter tellen alleen als heel woord.
  var at = function (txt, w) { var k = w.trim(), whole = k.length <= 3 || / $/.test(w), p = txt.indexOf(' ' + k + (whole ? ' ' : '')); return p < 0 ? -1 : p + 1; };
  var hasAny = function (txt, words) { for (var i = 0; i < words.length; i++) if (at(txt, words[i]) >= 0) return words[i]; return null; };
  var firstKey = function (txt, dict) { var best = null, pos = 1e9; Object.keys(dict).forEach(function (k) { dict[k].forEach(function (w) { var p = at(txt, w); if (p >= 0 && p < pos) { pos = p; best = { key: k, word: w.trim() }; } }); }); return best; };
  function hex2rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgb2hex(c) { return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(''); }
  function mix(h, amt) { var c = hex2rgb(h); return rgb2hex(c.map(function (v) { return amt < 0 ? v * (1 + amt) : v + (255 - v) * amt; })); }
  function lum(h) { return hex2rgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce(function (s, v, i) { return s + v * [.2126, .7152, .0722][i]; }, 0); }
  function contrast(a, b) { var A = lum(a), B = lum(b); return (Math.max(A, B) + .05) / (Math.min(A, B) + .05); }
  function readable(code, bg) { var c = code, n = 0; while (contrast(c, bg) < 4.5 && n++ < 12) c = mix(c, -.12); return c; }   // donkerder tot hij goed scant

  /* Kleuren in volgorde van de zin, met "donker/licht/pastel" ervoor */
  function findColors(raw, txt) {
    var found = [];
    (raw.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || []).forEach(function (h) { if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; found.push({ pos: raw.indexOf(h), hex: h.toLowerCase(), word: h }); });
    Object.keys(COLORS).forEach(function (hex) {
      COLORS[hex].forEach(function (w) {
        var p = at(txt, w); if (p < 0) return;
        if (found.some(function (f) { return Math.abs(f.pos - p) < 3; })) return;
        var before = txt.slice(Math.max(0, p - 12), p), h = hex;
        if (hasAny(before, DARK)) h = mix(h, -.35); else if (hasAny(before, PASTEL)) h = mix(h, .45); else if (hasAny(before, LIGHT)) h = mix(h, .3);
        found.push({ pos: p, hex: h, word: w.trim() });
      });
    });
    found.sort(function (a, b) { return a.pos - b.pos; });
    return found.filter(function (f, i) { return found.findIndex(function (g) { return g.hex === f.hex; }) === i; });
  }

  function themeById(id) { return DATA.DESIGN_THEMES.filter(function (t) { return t.id === id; })[0]; }
  function themeFor(txt, ctx) {
    var s = firstKey(txt, SEASONS);
    if (s) { var th = s.key === 'birthday' ? themeById('birthday') : s.key === 'wedding' ? themeById('wedding') : DATA.DESIGN_THEMES.filter(function (t) { return t.season === s.key; })[0]; if (th) return { theme: th, word: s.word }; }
    var best = null, pos = 1e9;
    Object.keys(DATA.THEME_KEYWORDS).forEach(function (tag) {
      DATA.THEME_KEYWORDS[tag].forEach(function (w) {
        var p = at(txt, w); if (p < 0 || p >= pos) return;
        var th = DATA.DESIGN_THEMES.filter(function (t) { return (t.tags || [])[0] === tag; })[0] || DATA.DESIGN_THEMES.filter(function (t) { return (t.tags || []).indexOf(tag) >= 0; })[0];
        if (th) { pos = p; best = { theme: th, word: w.trim() }; }
      });
    });
    return best;
  }

  /* ---------- Hoofdfunctie ---------- */
  function parse(text, current, ctx) {
    ctx = ctx || {};
    var raw = String(text || '').slice(0, 300), txt = norm(raw), understood = [], d, base;
    var cur = Object.assign({}, current || {});
    var quoted = raw.match(/["“”'‘’«»„]([^"“”'‘’«»„]{1,32})["“”'‘’«»„]/);

    // 1. Basis: een passende stijl, of het huidige ontwerp (bij aanpassingen)
    var th = themeFor(txt, ctx);
    if (th) { base = Object.assign({}, th.theme.d || {}); base.themeId = th.theme.id; understood.push({ k: 'theme', v: th.theme.id, word: th.word }); }
    else base = Object.assign({}, cur);
    d = Object.assign({ color: '#0b0e13', background: '#ffffff' }, base);
    if (d.frameText && /^dz\./.test(d.frameText)) d.frameTextKey = d.frameText;   // vertaalsleutel; de app vult de tekst in

    // 2. Kleuren
    var cols = findColors(raw, txt).filter(function (c) { return c.hex !== '#ffffff'; });
    if (cols.length) {
      var main = cols[0].hex, second = cols[1] ? cols[1].hex : null;
      if (cols.length >= 2 && lum(main) > lum(second)) { var tmp = main; main = second; second = tmp; }    // donkerste kleur = de code
      d.color = main; d.gradient = ''; d.frameColor = second || main;
      if (second) { d.cornerColor = second; d.cornerInnerColor = ''; } else { d.cornerColor = ''; d.cornerInnerColor = ''; }
      cols.forEach(function (c) { understood.push({ k: 'color', v: c.hex, word: c.word }); });
    }
    // 3. Vormen
    var pat = firstKey(txt, PATTERNS); if (pat) { d.pattern = pat.key; understood.push({ k: 'pattern', v: pat.key, word: pat.word }); }
    if (/ronde hoeken|rounded corners|esquinas redondeadas|runde ecken/.test(txt)) { d.cornerOuter = 'extra'; d.cornerInner = 'rounded'; understood.push({ k: 'corners', v: 'extra', word: 'ronde hoeken' }); }
    // 4. Frame
    if (hasAny(txt, NO_FRAME)) { d.frame = 'none'; understood.push({ k: 'frame', v: 'none', word: hasAny(txt, NO_FRAME).trim() }); }
    else { var fr = firstKey(txt.replace(/met hartjes|hartjes/g, ' '), FRAMES); if (fr) { d.frame = fr.key; understood.push({ k: 'frame', v: fr.key, word: fr.word }); } }
    // 5. Versiering
    if (hasAny(txt, NO_DECOR)) d.decor = '';
    else { var dc = firstKey(txt, DECOR); if (dc) { d.decor = dc.key; understood.push({ k: 'decor', v: dc.key, word: dc.word }); } }
    // 6. Tekst en lettertype
    if (quoted) { d.frameText = quoted[1].trim(); delete d.frameTextKey; understood.push({ k: 'text', v: d.frameText, word: '"' + d.frameText + '"' }); if (!d.frame || d.frame === 'none') d.frame = 'label'; }
    var fo = firstKey(txt, FONTS); if (fo) { d.frameFont = fo.key; understood.push({ k: 'font', v: fo.key, word: fo.word }); }
    // 7. Opdrachten
    var cmd = {};
    Object.keys(CMD).forEach(function (k) { var w = hasAny(txt, CMD[k]); if (w) { cmd[k] = true; understood.push({ k: 'cmd', v: k, word: w.trim() }); } });
    if (cmd.darker) { d.color = mix(d.color, -.3); if (d.frameColor) d.frameColor = mix(d.frameColor, -.3); if (d.cornerColor) d.cornerColor = mix(d.cornerColor, -.3); }
    if (cmd.lighter) { d.color = mix(d.color, .25); if (d.frameColor) d.frameColor = mix(d.frameColor, .25); }
    if (cmd.gradient) { d.gradient = 'linear'; d.color2 = d.cornerColor || d.frameColor || mix(d.color, .35); }
    if (cmd.simpler) { d.decor = ''; d.gradient = ''; d.pattern = d.pattern === 'heart' || d.pattern === 'star' ? 'rounded' : d.pattern; }
    if (Object.keys(cmd).length && !th) d.themeId = '';
    if (cols.length || pat || fr || dc || quoted) d.themeId = th ? d.themeId : '';

    // 8. Veiligheid: altijd scanbaar
    var bg = d.transparent ? '#ffffff' : (d.background || '#ffffff');
    if (lum(d.color) > lum(bg)) { d.background = '#ffffff'; bg = '#ffffff'; }
    d.color = readable(d.color, bg);
    if (d.gradient && d.color2) d.color2 = readable(d.color2, bg);
    if (d.cornerColor) d.cornerColor = readable(d.cornerColor, bg);
    if (d.cornerInnerColor) d.cornerInnerColor = readable(d.cornerInnerColor, bg);

    // 9. Drie varianten: zelfde gevoel, ander frame of andere vorm
    var v1 = d, frames = th && th.theme.g === 'season' ? ['label', 'badge', 'bubble'] : ['label', 'labelTop', 'badge', 'ticket', 'bubble'];
    frames = frames.filter(function (f) { return f !== v1.frame; });
    var v2 = Object.assign({}, v1, { frame: v1.frame === 'none' ? 'none' : frames[0], pattern: v1.pattern === 'rounded' ? 'dots' : 'rounded', cornerOuter: 'extra', cornerInner: 'rounded' });
    var v3 = Object.assign({}, v1, { frame: v1.frame === 'none' ? 'none' : frames[1], pattern: v1.pattern === 'smooth' ? 'square' : 'smooth', cornerOuter: v1.cornerOuter === 'circle' ? 'rounded' : 'circle', cornerInner: 'circle' });
    if (cmd.other) { var rot = [v2, v3, v1]; v1 = rot[0]; v2 = rot[1]; v3 = rot[2]; }

    var knownWords = [].concat.apply([], understood.map(function (u) { return norm(u.word).trim().split(' '); })), noQuotes = norm(raw.replace(/["“”'‘’«»„][^"“”'‘’«»„]*["“”'‘’«»„]/g, ' '));
    var unknown = noQuotes.trim().split(' ').filter(function (w) { return w.length > 3 && !knownWords.some(function (k) { return k && (w.indexOf(k) === 0 || k.indexOf(w) === 0); }) && !/^(een|met|and|with|the|voor|for|van|de|het|code|qr-code|qrcode|graag|wil|want|maak|make|please|mijn|my|con|para|und|mit|pour|avec|tekst|text|texto|texte|testo|tekstem|tekstin|teksti|κειμενο|kleur|kleuren|colors|colours|stijl|style)$/.test(w); });
    return { variants: [v1, v2, v3], understood: understood, unknown: unknown.slice(0, 10), askLogo: !!cmd.logo, ok: understood.length > 0 };
  }

  return { parse: parse, contrast: contrast };
});
