/* =========================================================
   ONTWERP-DATA: stijlen, trefwoorden en alle keuzes voor stap 3.
   Gedeeld door de app (browser) én de server (assistent + validatie), zodat alles op één plek staat.
   ========================================================= */
(function (root, factory) {
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else { root.DESIGN_DATA = data; Object.keys(data).forEach(function (k) { root[k] = data[k]; }); }
})(typeof self !== 'undefined' ? self : this, function () {
  var THEME_GROUPS = ['basic', 'food', 'shop', 'business', 'stay', 'care', 'party', 'season'];

  var DESIGN_THEMES = [
    /* Basis */
    { id: 'classic',  g: 'basic', d: {} },
    { id: 'brand',    g: 'basic', brand: true },
    { id: 'modern',   g: 'basic', tags: ['links', 'tech'], d: { color: '#0f2a4a', pattern: 'smooth', cornerOuter: 'extra', cornerInner: 'rounded', frame: 'label', frameColor: '#0f2a4a', frameText: 'dz.text.scan' } },
    { id: 'minimal',  g: 'basic', d: { color: '#1f2937', pattern: 'dots', cornerOuter: 'circle', cornerInner: 'circle' } },
    { id: 'bold',     g: 'basic', d: { color: '#000000', pattern: 'square', cornerOuter: 'square', cornerInner: 'square', frame: 'labelTop', frameColor: '#000000', frameFont: 'bold', frameText: 'dz.text.scanUpper2' } },

    /* Horeca */
    { id: 'coffee',    g: 'food', tags: ['coffee', 'bakery'], d: { color: '#3b2416', pattern: 'rounded', cornerOuter: 'extra', cornerInner: 'circle', frame: 'coffee', frameColor: '#6f4e37', frameText: 'dz.text.coffee' } },
    { id: 'restaurant',g: 'food', tags: ['restaurant', 'menu'], d: { color: '#14382c', pattern: 'classy', cornerOuter: 'leaf', cornerInner: 'leaf', cornerColor: '#a16207', frame: 'label', frameColor: '#14382c', frameFont: 'serif', frameText: 'dz.text.menu' } },
    { id: 'chalk',     g: 'food', tags: ['menu', 'restaurant', 'bar', 'coffee'], d: { color: '#111827', pattern: 'rounded', cornerOuter: 'rounded', cornerInner: 'rounded', frame: 'chalkboard', frameColor: '#24332c', frameText: 'dz.text.menuToday' } },
    { id: 'pizza',     g: 'food', tags: ['pizza', 'takeaway'], d: { color: '#991b1b', pattern: 'dots', cornerOuter: 'rounded', cornerInner: 'circle', frame: 'pizza', frameColor: '#b91c1c', frameText: 'dz.text.order' } },
    { id: 'bakery',    g: 'food', tags: ['bakery', 'coffee'], d: { color: '#7c2d12', pattern: 'rounded', cornerOuter: 'extra', cornerInner: 'rounded', cornerColor: '#c2410c', frame: 'ribbon', frameColor: '#c2410c', frameFont: 'serif', frameText: 'dz.text.fresh' } },
    { id: 'bar',       g: 'food', tags: ['bar', 'music'], d: { color: '#701a75', gradient: 'linear', color2: '#be185d', pattern: 'dots', cornerOuter: 'chamfer', cornerInner: 'square', frame: 'badge', frameColor: '#701a75', frameText: 'dz.text.cheers' } },
    { id: 'takeaway',  g: 'food', tags: ['takeaway', 'restaurant', 'pizza'], d: { color: '#1f2937', pattern: 'smooth', cornerOuter: 'extra', cornerInner: 'rounded', frame: 'bag', frameColor: '#dc2626', frameText: 'dz.text.order' } },

    /* Winkel */
    { id: 'shop',     g: 'shop', tags: ['shop'], d: { color: '#0f172a', pattern: 'square', cornerOuter: 'chamfer', cornerInner: 'chamfer', frame: 'bag', frameColor: '#0f766e', frameText: 'dz.text.shop' } },
    { id: 'sale',     g: 'shop', tags: ['coupon', 'shop'], d: { color: '#b91c1c', pattern: 'square', cornerOuter: 'rounded', cornerInner: 'rounded', frame: 'pricetag', frameColor: '#dc2626', frameFont: 'bold', frameText: 'dz.text.sale' } },
    { id: 'giftcard', g: 'shop', tags: ['coupon', 'shop', 'flowers'], d: { color: '#831843', pattern: 'rounded', cornerOuter: 'extra', cornerInner: 'rounded', frame: 'gift', frameColor: '#be185d', frameText: 'dz.text.gift' } },
    { id: 'parcel',   g: 'shop', tags: ['shop', 'apps'], d: { color: '#422006', pattern: 'square', cornerOuter: 'rounded', cornerInner: 'square', frame: 'label', frameColor: '#a16207', frameText: 'dz.text.track' } },
    { id: 'florist',  g: 'shop', tags: ['flowers'], d: { color: '#14532d', pattern: 'classy', cornerOuter: 'leaf', cornerInner: 'rounded', cornerColor: '#db2777', frame: 'label', frameColor: '#166534', frameFont: 'serif', frameText: 'dz.text.flowers', decor: 'spring' } },

    /* Zakelijk */
    { id: 'business', g: 'business', tags: ['vcard', 'pdf', 'business'], d: { color: '#1e293b', pattern: 'rounded', cornerOuter: 'rounded', cornerInner: 'rounded', frame: 'labelTop', frameColor: '#1e293b', frameText: 'dz.text.info' } },
    { id: 'tech',     g: 'business', tags: ['tech', 'apps', 'website'], d: { color: '#1d4ed8', gradient: 'linear', color2: '#0891b2', pattern: 'dots', cornerOuter: 'extra', cornerInner: 'rounded', frame: 'label', frameColor: '#1e3a8a', frameText: 'dz.text.visit' } },
    { id: 'realestate',g: 'business', tags: ['realestate'], d: { color: '#0c4a6e', pattern: 'rounded', cornerOuter: 'leaf', cornerInner: 'circle', frame: 'bubble', frameColor: '#0369a1', frameText: 'dz.text.viewHome' } },
    { id: 'event',    g: 'business', tags: ['event', 'music'], d: { color: '#312e81', pattern: 'dots', cornerOuter: 'rounded', cornerInner: 'circle', cornerColor: '#7c3aed', frame: 'ticket', frameColor: '#4338ca', frameText: 'dz.text.ticket' } },
    { id: 'thanks',   g: 'business', tags: ['coupon', 'shop', 'restaurant'], d: { color: '#111827', pattern: 'square', cornerOuter: 'rounded', cornerInner: 'square', frame: 'label', frameColor: '#111827', frameText: 'dz.text.review' } },

    /* Hotel & reizen */
    { id: 'hotel',    g: 'stay', tags: ['hotel', 'wifi'], d: { color: '#1e3a8a', pattern: 'classy', cornerOuter: 'extra', cornerInner: 'leaf', cornerColor: '#a16207', frame: 'tag', frameColor: '#1e3a8a', frameFont: 'serif', frameText: 'dz.text.welcome' } },
    { id: 'wifi',     g: 'stay', tags: ['wifi', 'hotel', 'coffee'], d: { color: '#0f172a', pattern: 'dots', cornerOuter: 'circle', cornerInner: 'circle', cornerColor: '#0284c7', frame: 'scanner', frameColor: '#0284c7', frameText: 'dz.text.wifi' } },
    { id: 'travel',   g: 'stay', tags: ['hotel', 'realestate', 'business'], d: { color: '#065f46', pattern: 'rounded', cornerOuter: 'rounded', cornerInner: 'circle', frame: 'bubble', frameColor: '#059669', frameText: 'dz.text.findUs' } },

    /* Beauty & sport */
    { id: 'salon',    g: 'care', tags: ['beauty'], d: { color: '#831843', pattern: 'dots', cornerOuter: 'leaf', cornerInner: 'rounded', cornerColor: '#be185d', frame: 'label', frameColor: '#9d174d', frameFont: 'serif', frameText: 'dz.text.book' } },
    { id: 'spa',      g: 'care', tags: ['beauty', 'fitness'], d: { color: '#365314', pattern: 'smooth', cornerOuter: 'extra', cornerInner: 'leaf', cornerColor: '#65a30d', frame: 'polaroid', frameColor: '#4d7c0f', frameText: 'dz.text.relax' } },
    { id: 'gym',      g: 'care', tags: ['fitness'], d: { color: '#0a0a0a', pattern: 'square', cornerOuter: 'chamfer', cornerInner: 'chamfer', cornerColor: '#65a30d', frame: 'labelTop', frameColor: '#0a0a0a', frameFont: 'bold', frameText: 'dz.text.train' } },

    /* Feest */
    { id: 'party',    g: 'party', tags: ['event', 'social', 'music'], d: { color: '#1d4ed8', pattern: 'square', cornerOuter: 'rounded', cornerInner: 'rounded', cornerColor: '#db2777', frame: 'confetti', frameColor: '#db2777', frameText: 'dz.text.party' } },
    { id: 'birthday', g: 'party', tags: ['event'], d: { color: '#6d28d9', pattern: 'dots', cornerOuter: 'extra', cornerInner: 'circle', cornerColor: '#db2777', frame: 'balloons', frameColor: '#7c3aed', frameFont: '', frameText: 'dz.text.birthday', decor: 'birthday' } },
    { id: 'wedding',  g: 'party', tags: ['event', 'flowers'], d: { color: '#44403c', pattern: 'classy', cornerOuter: 'leaf', cornerInner: 'rounded', cornerColor: '#a16207', frame: 'ribbon', frameColor: '#a16207', frameFont: 'serif', frameText: 'dz.text.wedding' } },

    /* Seizoenen */
    { id: 'valentine',g: 'season', season: 'valentine', d: { color: '#e11d48', pattern: 'dots', cornerOuter: 'rounded', cornerInner: 'rounded', cornerColor: '#be123c', frame: 'label', frameColor: '#be123c', frameText: 'dz.text.love', decor: 'valentine' } },
    { id: 'easter',   g: 'season', season: 'easter', d: { color: '#7c3aed', pattern: 'dots', cornerOuter: 'extra', cornerInner: 'rounded', cornerColor: '#db2777', frame: 'label', frameColor: '#a78bfa', frameFont: '', frameText: 'dz.text.easter', decor: 'easter' } },
    { id: 'summer',   g: 'season', season: 'summer', d: { color: '#ea580c', gradient: 'linear', color2: '#db2777', pattern: 'classy', cornerOuter: 'leaf', cornerInner: 'leaf', frame: 'tag', frameColor: '#ea580c', frameText: 'dz.text.summer' } },
    { id: 'halloween',g: 'season', season: 'halloween', d: { color: '#1c1917', pattern: 'dots', cornerOuter: 'leaf', cornerInner: 'circle', cornerColor: '#ea580c', frame: 'pumpkin', frameColor: '#f97316', frameText: 'dz.text.boo', decor: 'halloween' } },
    { id: 'xmas',     g: 'season', season: 'xmas', d: { color: '#b91c1c', gradient: 'linear', color2: '#166534', pattern: 'dots', cornerOuter: 'circle', cornerInner: 'circle', cornerColor: '#166534', cornerInnerColor: '#b91c1c', frame: 'ornament', frameColor: '#b91c1c', frameText: 'dz.text.xmas', decor: 'xmas' } },
    { id: 'winter',   g: 'season', season: 'winter', d: { color: '#1e3a8a', pattern: 'smooth', cornerOuter: 'extra', cornerInner: 'square', cornerColor: '#2563eb', frame: 'label', frameColor: '#1d4ed8', frameText: 'dz.text.winter', decor: 'winter' } },
    { id: 'newyear',  g: 'season', season: 'newyear', d: { color: '#111827', pattern: 'dots', cornerOuter: 'chamfer', cornerInner: 'square', cornerColor: '#a16207', frame: 'badge', frameColor: '#111827', frameFont: 'serif', frameText: 'dz.text.newyear', decor: 'newyear' } }
  ];

  var THEME_KEYWORDS = {
    coffee: ['cafe', 'koffie', 'coffee', 'espresso', 'barista', 'cafeteria', 'kaffee', 'latte', 'cappuccino', 'lunchroom', 'tea', 'thee'],
    restaurant: ['restaurant', 'restaurante', 'bistro', 'brasserie', 'eetcafe', 'keuken', 'kitchen', 'food', 'diner', 'tapas', 'sushi', 'grill', 'steak', 'trattoria', 'eten'],
    menu: ['menu', 'menukaart', 'carta', 'speisekarte', 'gerechten', 'dishes'],
    pizza: ['pizza', 'pizzeria', 'pasta', 'italiaans', 'italian'],
    takeaway: ['afhaal', 'takeaway', 'take-away', 'bezorg', 'delivery', 'to go', 'noodle', 'wok', 'burger', 'kebab'],
    bakery: ['bakker', 'bakkerij', 'bakery', 'panaderia', 'pasteleria', 'patisserie', 'brood', 'bread', 'taart', 'cake', 'croissant'],
    bar: ['bar', 'cocktail', 'bier', 'beer', 'wijn', 'wine', 'pub', 'lounge', 'club', 'drinks', 'chiringuito'],
    flowers: ['bloem', 'bloemen', 'flower', 'florist', 'flores', 'floristeria', 'bloom', 'plant', 'boeket', 'bouquet', 'garden', 'tuin'],
    hotel: ['hotel', 'hostel', 'b&b', 'bnb', 'apartment', 'apartamento', 'resort', 'villa', 'camping', 'guesthouse', 'airbnb', 'suite', 'kamer', 'room'],
    shop: ['winkel', 'shop', 'store', 'boutique', 'mode', 'fashion', 'kleding', 'tienda', 'webshop', 'outlet', 'collectie', 'collection'],
    beauty: ['salon', 'kapper', 'kapsalon', 'hair', 'beauty', 'nails', 'nagel', 'spa', 'wellness', 'massage', 'peluqueria', 'barber', 'kosmetik', 'skincare', 'lashes'],
    fitness: ['gym', 'fitness', 'sport', 'yoga', 'crossfit', 'pilates', 'training', 'personal trainer', 'boxing', 'padel'],
    tech: ['software', 'tech', 'digital', 'development', 'saas', 'startup', 'cloud', 'data', ' ai', 'it-'],
    realestate: ['makelaar', 'real estate', 'inmobiliaria', 'woning', 'property', 'vastgoed', 'huis te koop', 'te huur', 'for sale', 'bezichtiging', 'immobilien'],
    event: ['event', 'evento', 'concert', 'festival', 'feest', 'party', 'fiesta', 'wedding', 'bruiloft', 'boda', 'ticket', 'verjaardag', 'birthday', 'cumpleanos'],
    music: ['muziek', 'music', 'musica', 'dj', 'band', 'podcast', 'radio', 'spotify']
  };

  var TYPE_TAGS = {
    wifi: ['wifi', 'hotel'], menu: ['menu', 'restaurant'], coupon: ['coupon'], vcard: ['vcard'], pdf: ['pdf'], business: ['business'],
    apps: ['apps'], website: ['website'], links: ['links'], instagram: ['social'], facebook: ['social'], social: ['social'],
    mp3: ['music'], video: ['music'], images: ['event'], whatsapp: ['business']
  };

  // Alleen opties die er netjes uitzien én altijd goed scannen (opgeschoond 8 okt).
  var DESIGN_PATTERNS = ['square', 'rounded', 'smooth', 'dots', 'classy'];

  var DESIGN_OUTER = ['square', 'rounded', 'extra', 'circle', 'leaf', 'chamfer'];

  var DESIGN_INNER = ['square', 'rounded', 'circle', 'chamfer', 'leaf'];

  var FRAME_GROUPS = {
    basic: ['none', 'label', 'labelTop', 'bubble', 'tag', 'scanner', 'ribbon', 'ticket', 'stamp', 'polaroid', 'badge'],
    food:  ['coffee', 'chalkboard', 'pizza'],
    shop:  ['bag', 'gift', 'pricetag'],
    party: ['heart', 'ornament', 'balloons', 'confetti', 'pumpkin']
  };

  var FRAME_FONTS = ['', 'hand', 'serif', 'bold'];

  var DESIGN_DECOR = ['', 'xmas', 'winter', 'newyear', 'valentine', 'easter', 'spring', 'halloween', 'birthday'];

  /* ---------- safeDesign: elk ontwerp is netjes en scant altijd ----------
     Gebruikt door de app (stijlen, assistent, zelf aanpassen) én de server.
     - Opties die we weggehaald hebben worden de dichtstbijzijnde nette optie (ook voor oude codes).
     - Witte achtergrond, nooit transparant.
     - Kleuren worden zo nodig donkerder tot het contrast met wit minstens 4,5 is (frame: 3). Zo is er nooit een contrastmelding nodig. */
  var REPLACE = {
    pattern: { tiny: 'dots', mosaic: 'square', vertical: 'square', horizontal: 'square', diamond: 'dots', cross: 'square', heart: 'dots', star: 'dots' },
    cornerOuter: { drop: 'leaf', dots: 'rounded' },
    cornerInner: { diamond: 'square', plus: 'square', flower: 'rounded', heart: 'rounded', star: 'circle' },
    frame: { phone: 'label', script: 'label', cutlery: 'label', noodles: 'bag', envelope: 'label', calendar: 'labelTop', receipt: 'label', box: 'label', pin: 'bubble', laptop: 'label', hanger: 'tag' },
    frameFont: { modern: '', round: '' },
    gradient: { radial: 'linear' }
  };
  function rgb(h) { var n = parseInt(String(h).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function lum(h) { return rgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce(function (s, v, i) { return s + v * [.2126, .7152, .0722][i]; }, 0); }
  function contrastWhite(h) { return 1.05 / (lum(h) + .05); }
  function darken(h, min) {
    if (!/^#[0-9a-f]{6}$/i.test(h || '')) return h;
    var c = rgb(h), n = 0, hex = h;
    while (contrastWhite(hex) < min && n++ < 30) { c = c.map(function (v) { return v * .9; }); hex = '#' + c.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
    return hex.toLowerCase();
  }
  function safeDesign(design) {
    var d = Object.assign({}, design);
    Object.keys(REPLACE).forEach(function (k) { if (d[k] !== undefined && REPLACE[k][d[k]] !== undefined) d[k] = REPLACE[k][d[k]]; });
    d.background = '#ffffff'; d.transparent = false; d.frameGradient = false; d.frameColor2 = '';
    ['color', 'color2', 'cornerColor', 'cornerInnerColor'].forEach(function (k) { if (d[k]) d[k] = darken(d[k], 4.5); });
    if (d.frameColor) d.frameColor = darken(d.frameColor, 3);
    return d;
  }

  return { THEME_GROUPS: THEME_GROUPS, DESIGN_THEMES: DESIGN_THEMES, THEME_KEYWORDS: THEME_KEYWORDS, TYPE_TAGS: TYPE_TAGS,
    DESIGN_PATTERNS: DESIGN_PATTERNS, DESIGN_OUTER: DESIGN_OUTER, DESIGN_INNER: DESIGN_INNER, FRAME_GROUPS: FRAME_GROUPS, FRAME_FONTS: FRAME_FONTS, DESIGN_DECOR: DESIGN_DECOR, safeDesign: safeDesign };
});
