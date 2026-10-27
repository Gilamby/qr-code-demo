/* QR-types: de ENIGE plek waar types en hun velden staan.
   Gebruikt door de frontend (window.QR_TYPES) én de backend (require) voor validatie.

   Velden per type:
     id           unieke sleutel, ook gebruikt voor vertalingen (types.<id>.name / .desc)
     icon         icoon-sleutel uit public/js/config.js (ICONS)
     image        kaartafbeelding (optioneel, voor later)
     previewImage foto bovenin de telefoon-preview; zet een bestand met deze naam in public/assets/previews/
     contentType  bepaalt hoe de QR-data wordt opgebouwd (zie public/js/qr.js en server/validate.js)
     previewType  welk preview-sjabloon gebruikt wordt (public/js/preview.js)
     color        accentkleur in de preview
     theme        [hoofdkleur, knopkleur] van de telefoonpagina: elk type zijn eigen sfeer (de gebruiker kan ze aanpassen)
     fields       invulvelden in stap Inhoud: key, type, label (vertaalsleutel), sample (voorbeeld), options
     Extra veldopties:
       or        dit verplichte veld mag leeg als het genoemde andere veld is ingevuld (link óf bestand)
       needs     alleen in gebruik als het genoemde veld is ingevuld (bv. videotitel alleen bij een eigen video)
       show      [keuzeveld, waarde]: alleen in gebruik bij die keuze (bv. menu: link / uploaden / zelf maken)
       domains   URL moet naar één van deze websites gaan; pattern: vaste vorm (bv. Instagram-naam)
     page: false  geen eigen pagina (doorsturen of de QR-code bevat alles zelf, zoals een contactkaart): geen kleuren
     colors: false wel een pagina, maar zonder instelbare kleuren (fotogalerij: de foto's zijn de hoofdzaak)
     pageIf       de bezoeker krijgt alleen een eigen pagina als dit veld is ingevuld, of bij [keuzeveld, waarde]
*/
(function (root, data) {
  var find = function (type, key) { return type.fields.filter(function (f) { return f.key === key; })[0]; };
  // Gekozen optie van een keuzeveld. Leeg = oude code (legacy-velden ingevuld) of de eerste optie.
  data.choice = function (type, key, content) {
    var f = find(type, key), v = content && content[key];
    if (!f) return '';
    if (v && f.options.some(function (o) { return o.value === v; })) return v;
    if (f.legacy && f.legacy.value && f.legacy.when.some(function (k) { return content && content[k]; })) return f.legacy.value;
    return f.options[0].value;
  };
  // Is dit veld nu in gebruik (zichtbaar, verplicht, bewaard)?
  data.active = function (type, f, content) {
    if (f.needs && !(content && content[f.needs])) return false;
    if (f.show) return data.choice(type, f.show[0], content) === f.show[1];
    return true;
  };
  // Krijgt de bezoeker een eigen pagina? (anders: doorsturen naar de link of het bestand)
  data.hasPage = function (type, content) {
    if (!type || type.page === false) return false;
    var p = type.pageIf; if (!p) return true;
    return Array.isArray(p) ? data.choice(type, p[0], content) === p[1] : !!(content && content[p]);
  };
  // Voor alle dynamische codes (niet vCard en wifi: die bevatten alles zelf en gaan niet via onze server):
  // - Plannen (KB Q224): startdatum en einddatum onder "Meer opties"
  // - Google Analytics (KB Q222): UTM-labels aan de links van de pagina, als die links heeft
  var NO_LINKS = ['pdf', 'facebook', 'instagram', 'whatsapp', 'review', 'feedback'];
  data.forEach(function (type) {
    if (type.id === 'vcard' || type.id === 'wifi') return;
    var has = function (k) { return type.fields.some(function (f) { return f.key === k; }); };
    if (!has('starts')) type.fields.push({ key: 'starts', type: 'date', label: 'fields.starts', advanced: true, hint: 'hint.starts' });
    if (!has('startsTime')) type.fields.splice(type.fields.findIndex(function (f) { return f.key === 'starts'; }) + 1, 0, { key: 'startsTime', type: 'time', label: 'fields.startsTime', advanced: true, needs: 'starts', hint: 'hint.time' });
    if (!has('expires')) type.fields.push({ key: 'expires', type: 'date', label: 'fields.expires', advanced: true, hint: 'hint.expires' });
    // Plannen met tijd (in de tijdzone van de eigenaar) en een andere link na afloop (einddatum of max. aantal scans)
    if (!has('expiresTime')) type.fields.splice(type.fields.findIndex(function (f) { return f.key === 'expires'; }) + 1, 0, { key: 'expiresTime', type: 'time', label: 'fields.expiresTime', advanced: true, needs: 'expires', hint: 'hint.time' });
    if (!has('afterUrl')) type.fields.splice(type.fields.findIndex(function (f) { return f.key === 'maxScans' || f.key === 'expiresTime'; }) + 1, 0, { key: 'afterUrl', type: 'url', label: 'fields.afterUrl', advanced: true, hint: 'hint.afterUrl' });
    if (!has('alertAt')) type.fields.push({ key: 'alertAt', type: 'number', min: 1, max: 100000000, label: 'fields.alertAt', advanced: true, hint: 'hint.alertAt' });   // mail bij een zelfgekozen aantal scans
    if (!has('utm') && NO_LINKS.indexOf(type.id) < 0) type.fields.push({ key: 'utm', type: 'toggle', label: 'fields.utm', advanced: true, hint: 'hint.utmPage' });
  });
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.QR_TYPES = data;
})(typeof self !== 'undefined' ? self : this, [
  { id: 'website', page: false,   icon: 'globe',  image: 'assets/qr-types/website.jpg',   contentType: 'url',      previewType: 'card',    color: '#1576c9', theme: ['#1576c9', '#0f172a'],
    fields: [
      { key: 'url', type: 'url', label: 'fields.url', sample: 'https://optimasys.com', required: true, check: true },
      { key: 'title', label: 'fields.qrName', sample: { t: 'pv.website.title' }, hint: 'hint.qrName' },
      // Meer opties (dichtgeklapt): worden toegepast bij het scannen, zie server/links.js
      { key: 'password', type: 'password', label: 'fields.password', advanced: true, hint: 'hint.password' },
      { key: 'starts', type: 'date', label: 'fields.starts', advanced: true, hint: 'hint.starts' },
      { key: 'expires', type: 'date', label: 'fields.expires', advanced: true, hint: 'hint.expires' },
      { key: 'maxScans', type: 'number', min: 1, max: 1000000, label: 'fields.maxScans', advanced: true, hint: 'hint.maxScans' },
      { key: 'alertAt', type: 'number', min: 1, max: 100000000, label: 'fields.alertAt', advanced: true, hint: 'hint.alertAt' },
      // Slim doorsturen: andere link per taal, land, tijd of apparaat (zie routeUrl in server/src/visitor/rules.ts)
      { key: 'route', type: 'route', label: 'fields.route', advanced: true, hint: 'hint.route' },
      // A/B-test: een deel van de scans naar een tweede link (zie server/src/visitor/rules.ts)
      { key: 'abUrl', type: 'url', label: 'fields.abUrl', advanced: true, hint: 'hint.abUrl' },
      { key: 'abShare', type: 'number', min: 1, max: 99, label: 'fields.abShare', advanced: true, needs: 'abUrl', sample: '50', hint: 'hint.abShare' },
      { key: 'utm', type: 'toggle', label: 'fields.utm', advanced: true, hint: 'hint.utm' } ] },
  { id: 'pdf', page: false, icon: 'pdf',    image: 'assets/qr-types/pdf.jpg',       contentType: 'file',     previewType: 'card',    color: '#c0392b', theme: ['#c0392b', '#1f2937'],
    fields: [
      { key: 'file', type: 'file', accept: 'application/pdf', label: 'fields.pdfFile', required: true, sample: { t: 'sample.pdfFile' } },
      // Bij het scannen opent de PDF meteen: geen eigen pagina, dus geen kleuren of teksten nodig
      { key: 'title', label: 'fields.qrName', sample: { t: 'pv.pdf.title' }, hint: 'hint.qrNameOwn' } ] },
  { id: 'links',     icon: 'links',  image: 'assets/qr-types/links.jpg', previewImage: 'assets/previews/links.jpg',     contentType: 'links',    previewType: 'card',   color: '#2bb5f0', theme: ['#c2410c', '#4d7c0f'],
    fields: [ { key: 'title', label: 'fields.title', sample: { t: 'sample.linksTitle' } }, { key: 'photo', type: 'image', label: 'fields.profilePhoto', small: true } ].concat(
      // Link 1-3 zichtbaar, 4 t/m 10 verborgen tot je op "+ Link toevoegen" klikt.
      // Bij elke link (optioneel): een naam (linkNName) en een foto of logo (linkNImg); die staan in het formulier in het blok van de link.
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reduce(function (all, n) {
        var k = 'link' + n, sample = { 1: 'pv.links.website', 2: 'pv.links.jobs', 3: 'pv.links.support' }[n], f = { key: k, label: 'fields.link', n: n };
        if (sample) f.sample = { t: sample }; else f.extra = true;
        if (n === 1) f.required = true;   // een linkpagina zonder links heeft geen zin
        return all.concat([f, { key: k + 'Name', label: 'fields.linkName', sub: k, max: 60 }, { key: k + 'Img', type: 'image', label: 'fields.linkImage', sub: k, small: true }]);
      }, [])) },
  { id: 'vcard', page: false, icon: 'vcard',  image: 'assets/qr-types/vcard.jpg', previewImage: 'assets/previews/vcard.jpg',     contentType: 'contact',  previewType: 'card',    color: '#2bb5f0', theme: ['#0f766e', '#0b3b36'],
    fields: [ { key: 'name', label: 'fields.name', required: true, sample: { t: 'sample.vcardName' } }, { key: 'role', label: 'fields.role', sample: { t: 'pv.vcard.role' } }, { key: 'phone', type: 'tel', label: 'fields.phone', sample: { t: 'sample.vcardPhone' } }, { key: 'email', type: 'email', label: 'fields.email', sample: { t: 'sample.vcardEmail' } },
      { key: 'company', label: 'fields.company', sample: { t: 'sample.vcardCompany' } }, { key: 'website', type: 'url', label: 'fields.website', sample: { t: 'sample.vcardWebsite' } }, { key: 'address', type: 'address', label: 'fields.address', sample: { t: 'sample.vcardAddress' } } ] },
  { id: 'business',  icon: 'biz',    image: 'assets/qr-types/business.jpg', previewImage: 'assets/previews/business.jpg',  contentType: 'business', previewType: 'card',    color: '#d08b2c', theme: ['#d08b2c', '#3b2a20'],
    fields: [
      { key: 'cover', type: 'image', label: 'fields.cover' },
      { key: 'name', label: 'fields.name', sample: { t: 'sample.bizName' }, required: true },
      { key: 'description', label: 'fields.description', sample: { t: 'pv.business.descSample' } },
      { key: 'address', type: 'address', label: 'fields.address', sample: { t: 'sample.bizAddress' } },
      { key: 'hours', type: 'hours', label: 'fields.hours' },
      { key: 'phone', type: 'tel', label: 'fields.phone', sample: { t: 'sample.bizPhone' } },
      { key: 'email', type: 'email', label: 'fields.email', sample: { t: 'sample.bizEmail' } },
      { key: 'website', type: 'url', label: 'fields.website', sample: { t: 'sample.bizWebsite' } },
      { key: 'socials', type: 'socials', label: 'fields.socials', sample: { t: 'sample.bizSocials' } } ] },
  { id: 'video', pageIf: 'file', icon: 'video',  image: 'assets/qr-types/video.jpg', previewImage: 'assets/previews/video.jpg?v=2',     contentType: 'url',      previewType: 'card',    color: '#2563eb', theme: ['#2563eb', '#0f172a'],
    fields: [
      // Een link (YouTube, Vimeo …) óf een eigen videobestand: één van de twee is genoeg (or)
      { key: 'url', type: 'url', label: 'fields.videoUrl', required: true, or: 'file', sample: { t: 'sample.videoUrl' }, hint: 'hint.videoUrl' },
      { key: 'file', type: 'file', accept: 'video/*', label: 'fields.videoFile', or: 'url' },
      // Titel, tekst en kleuren alleen bij een eigen video: een link stuurt meteen door naar YouTube enz.
      { key: 'title', label: 'fields.title', sample: { t: 'pv.video.title' }, needs: 'file' },
      { key: 'description', label: 'fields.description', sample: { t: 'pv.video.desc' }, needs: 'file' } ] },
  { id: 'images', colors: false, icon: 'img',    image: 'assets/qr-types/images.jpg',    contentType: 'gallery',  previewType: 'card', color: '#2f9e8f', theme: ['#2f9e8f', '#134e4a'],
    fields: [
      { key: 'photos', type: 'gallery', label: 'fields.photos', required: true, max: 30 },   // max. 30: elk ~250 kB na verkleinen, als los bestand op de server
      { key: 'title', label: 'fields.title', sample: { t: 'pv.images.title' } },
      { key: 'description', label: 'fields.description', sample: { t: 'pv.images.desc' } } ] },
  { id: 'facebook', page: false, icon: 'fb',     image: 'assets/qr-types/facebook.jpg', previewImage: 'assets/previews/facebook.jpg',  contentType: 'profile',  previewType: 'card', color: '#1877f2', theme: ['#1877f2', '#0b3d91'],
    fields: [
      // Bij het scannen opent Facebook zelf: alleen de link is nodig. domains: alleen een Facebook-link (ook fb.com, m.facebook.com …)
      { key: 'url', type: 'url', label: 'fields.fbUrl', required: true, domains: ['facebook.com', 'fb.com', 'fb.me'], sample: { t: 'sample.fbUrl' } },
      { key: 'title', label: 'fields.qrName', sample: { t: 'sample.fbPage' }, hint: 'hint.qrNameOwn', advanced: true } ] },
  { id: 'instagram', page: false, icon: 'ig',     image: 'assets/qr-types/instagram.jpg', previewImage: 'assets/previews/instagram.jpg', contentType: 'profile',  previewType: 'card', color: '#d6249f', theme: ['#d6249f', '#515bd4'],
    // Gebruikersnaam (met of zonder @) óf de link naar het profiel: één van de twee is genoeg
    fields: [
      { key: 'username', label: 'fields.username', required: true, or: 'url', pattern: '^@?[A-Za-z0-9._]{1,30}$', patternError: 'validate.igUser', sample: { t: 'sample.igUser' }, hint: 'hint.igUser' },
      { key: 'url', type: 'url', label: 'fields.igUrl', or: 'username', domains: ['instagram.com', 'instagr.am'], sample: { t: 'sample.igUrl' } } ] },
  { id: 'social',    icon: 'social', image: 'assets/qr-types/social.jpg', previewImage: 'assets/previews/social.jpg',    contentType: 'links',    previewType: 'card',   color: '#5b6cf0', theme: ['#5b6cf0', '#ec4899'],
    fields: [
      { key: 'title', label: 'fields.title', sample: { t: 'sample.socialTitle' } },
      { key: 'description', label: 'fields.description', sample: { t: 'pv.social.desc' } },
      { key: 'socials', type: 'socials', label: 'fields.socials', required: true, sample: { t: 'sample.socials' } } ] },
  { id: 'whatsapp', page: false,  icon: 'wa',     image: 'assets/qr-types/whatsapp.jpg', previewImage: 'assets/previews/whatsapp.jpg',  contentType: 'message',  previewType: 'card',    color: '#00a884', theme: ['#00a884', '#075e54'],
    // WhatsApp of SMS (KB Q48–49): één tegel, bovenaan kiezen. Oude codes zonder keuze: WhatsApp (eerste optie).
    fields: [
      { key: 'channel', type: 'choice', label: 'fields.msgChannel',
        options: [ { value: 'whatsapp', label: 'msg.whatsapp', hint: 'msg.whatsappHint' }, { value: 'sms', label: 'msg.sms', hint: 'msg.smsHint' } ] },
      { key: 'phone', type: 'tel', label: 'fields.phone', required: true, sample: { t: 'sample.waPhone' } }, { key: 'message', label: 'fields.message', sample: { t: 'pv.whatsapp.m2' } } ] },
  { id: 'mp3',       icon: 'mp3',    image: 'assets/qr-types/mp3.jpg', previewImage: 'assets/previews/mp3.jpg',       contentType: 'file',     previewType: 'card',    color: '#8b5cf6', theme: ['#8b5cf6', '#ec4899'],
    fields: [
      { key: 'file', type: 'file', accept: 'audio/*', label: 'fields.audioFile', required: true, sample: { t: 'sample.mp3File' } },
      { key: 'title', label: 'fields.title', sample: { t: 'pv.mp3.title' } },
      { key: 'artist', label: 'fields.artist', sample: { t: 'sample.mp3Artist' } },
      { key: 'cover', type: 'image', label: 'fields.coverArt' } ] },
  { id: 'menu', pageIf: ['mode', 'build'], icon: 'menu',   image: 'assets/qr-types/menu.jpg', previewImage: 'assets/previews/menu.jpg',      contentType: 'menu',     previewType: 'card',    color: '#e07a2f', theme: ['#e07a2f', '#6a994e'],
    // Drie manieren: link naar een bestaand menu (eerst en makkelijkst), menu uploaden (PDF/foto) of zelf maken.
    // Oude codes zonder keuze maar met gerechten: "zelf maken" (legacy).
    fields: [
      { key: 'mode', type: 'choice', label: 'fields.menuMode', legacy: { when: ['dishes', 'restaurant'], value: 'build' },
        options: [ { value: 'link', label: 'menu.modeLink', hint: 'menu.modeLinkHint' }, { value: 'upload', label: 'menu.modeUpload', hint: 'menu.modeUploadHint' }, { value: 'build', label: 'menu.modeBuild', hint: 'menu.modeBuildHint' } ] },
      { key: 'menuUrl', type: 'url', label: 'fields.menuUrl', required: true, show: ['mode', 'link'], sample: { t: 'sample.menuUrl' }, hint: 'hint.menuUrl' },
      { key: 'menuFile', type: 'file', accept: 'application/pdf,image/jpeg,image/png,image/webp', label: 'fields.menuFile', required: true, show: ['mode', 'upload'] },
      { key: 'restaurant', label: 'fields.restaurant', required: true, show: ['mode', 'build'], sample: { t: 'pv.menu.sub' } },
      { key: 'cover', type: 'image', label: 'fields.cover', show: ['mode', 'build'] },
      { key: 'dishes', type: 'dishes', label: 'fields.dishes', required: true, show: ['mode', 'build'], sample: { t: 'pv.menu.sampleDishes' } } ] },
  { id: 'apps',      icon: 'apps',   image: 'assets/qr-types/apps.jpg', previewImage: 'assets/previews/apps.jpg',      contentType: 'app',      previewType: 'card',    color: '#2bb5f0', theme: ['#0ea5e9', '#6366f1'],
    fields: [
      // Alleen de downloadlinks: minstens één (or). Telefoon gaat bij het scannen meteen naar de juiste winkel.
      { key: 'ios', type: 'url', label: 'fields.appStore', required: true, or: 'android', domains: ['apps.apple.com', 'itunes.apple.com'], sample: { t: 'sample.appIos' } },
      { key: 'android', type: 'url', label: 'fields.playStore', required: true, or: 'ios', domains: ['play.google.com'], sample: { t: 'sample.appAndroid' } },
      { key: 'appName', label: 'fields.appName', sample: { t: 'pv.apps.title' } } ] },
  { id: 'coupon',    icon: 'coupon', image: 'assets/qr-types/coupon.jpg',    contentType: 'coupon',   previewType: 'card',    color: '#d4a017', theme: ['#b7791f', '#7c2d12'],
    fields: [
      { key: 'company', label: 'fields.company', sample: { t: 'sample.couponCompany' } },
      { key: 'title', label: 'fields.title', required: true, sample: { t: 'pv.coupon.title' } },
      { key: 'discount', type: 'number', label: 'fields.discount', sample: '15' },
      { key: 'code', label: 'fields.code', sample: { t: 'sample.couponCode' }, hint: 'hint.couponCode' },
      // Hoe de kassa de code leest: QR-code, streepjescode (Code 128) of alleen de tekst
      { key: 'scan', type: 'select', label: 'fields.couponScan', needs: 'code', sample: 'qr', options: [ { value: 'qr', label: { t: 'fields.scanQr' } }, { value: 'barcode', label: { t: 'fields.scanBarcode' } }, { value: 'none', label: { t: 'fields.scanNone' } } ] },
      // Na deze datum toont de link "verlopen" (gecontroleerd op de server, zie visitor/rules.ts)
      { key: 'expires', type: 'date', label: 'fields.validUntil' },
      { key: 'terms', label: 'fields.terms', sample: { t: 'pv.coupon.termsSample' } },
      // Optioneel: knop naar de webshop of boekingspagina (de code moet daar ook ingesteld zijn)
      { key: 'buttonUrl', type: 'url', label: 'fields.couponUrl', hint: 'hint.couponUrl' },
      { key: 'buttonLabel', label: 'fields.buttonLabel', max: 30, needs: 'buttonUrl', sample: { t: 'pv.coupon.shopNow' } } ] },
  { id: 'wifi', page: false,      icon: 'wifi',   image: 'assets/qr-types/wifi.jpg',      contentType: 'wifi',     previewType: 'card',    color: '#2bb5f0', theme: ['#2bb5f0', '#0f172a'],
    fields: [ { key: 'ssid', label: 'fields.ssid', sample: { t: 'sample.wifiSsid' } }, { key: 'password', label: 'fields.password', sample: '' },
              { key: 'security', type: 'select', label: 'fields.security', options: [ { value: 'WPA', label: 'WPA/WPA2' }, { value: 'WEP', label: 'WEP' }, { value: 'nopass', label: { t: 'fields.securityNone' } } ], sample: 'WPA' } ] },
  // Review: klanten in één scan naar het venster "Review schrijven" (Google, Tripadvisor, Trustpilot …). Doorsturen, geen eigen pagina.
  { id: 'review', page: false, icon: 'review', contentType: 'url', previewType: 'card', color: '#f5a524', theme: ['#f5a524', '#1f2937'],
    fields: [
      { key: 'url', type: 'url', label: 'fields.reviewUrl', required: true, check: true, sample: { t: 'sample.reviewUrl' }, hint: 'hint.reviewUrl' },
      { key: 'title', label: 'fields.bizName', sample: { t: 'sample.bizName' }, hint: 'hint.reviewName' } ] },
  // Evenement: pagina met datum, tijd, plaats en "Zet in agenda" (.ics voor iPhone/Outlook, plus Google Agenda)
  { id: 'event', icon: 'event', contentType: 'event', previewType: 'card', color: '#7c3aed', theme: ['#7c3aed', '#1e1b4b'],
    fields: [
      { key: 'cover', type: 'image', label: 'fields.cover' },
      { key: 'title', label: 'fields.eventName', required: true, max: 100, sample: { t: 'sample.eventName' } },
      { key: 'startDate', type: 'date', label: 'fields.eventStart', required: true },
      { key: 'startTime', type: 'time', label: 'fields.eventStartTime' },
      { key: 'endDate', type: 'date', label: 'fields.eventEnd', hint: 'hint.eventEnd' },
      { key: 'endTime', type: 'time', label: 'fields.eventEndTime' },
      { key: 'address', type: 'address', label: 'fields.eventPlace', sample: { t: 'sample.bizAddress' } },
      { key: 'description', label: 'fields.description', max: 1000, sample: { t: 'sample.eventDesc' } },
      { key: 'url', type: 'url', label: 'fields.eventUrl', sample: { t: 'sample.bizWebsite' }, hint: 'hint.eventUrl' } ] },
  // Feedback: sterren + opmerking, eventueel e-mail (alleen met toestemming). Antwoorden: Mijn QR-codes > ⋯ > Antwoorden (server: feedback.controller.ts)
  { id: 'feedback', icon: 'feedback', contentType: 'feedback', previewType: 'card', color: '#0e9f6e', theme: ['#0e9f6e', '#064e3b'],
    fields: [
      { key: 'logo', type: 'image', label: 'fields.logo', small: true },
      { key: 'title', label: 'fields.fbName', required: true, max: 80, sample: { t: 'sample.bizName' } },
      { key: 'question', label: 'fields.fbQuestion', max: 140, sample: { t: 'sample.fbQuestion' } },
      { key: 'askEmail', type: 'toggle', label: 'fields.fbAskEmail', hint: 'hint.fbAskEmail' },
      { key: 'thanks', label: 'fields.fbThanks', max: 200, sample: { t: 'sample.fbThanks' } },
      { key: 'reviewUrl', type: 'url', label: 'fields.fbReview', hint: 'hint.fbReview', advanced: true } ] }
]);
