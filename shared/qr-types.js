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
*/
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.QR_TYPES = data;
})(typeof self !== 'undefined' ? self : this, [
  { id: 'website', page: false,   icon: 'globe',  image: 'assets/qr-types/website.jpg', previewImage: 'assets/previews/website.jpg',   contentType: 'url',      previewType: 'card',    color: '#1576c9', theme: ['#1576c9', '#0f172a'],
    fields: [
      { key: 'url', type: 'url', label: 'fields.url', sample: 'https://optimasys.com', required: true, check: true },
      { key: 'title', label: 'fields.qrName', sample: { t: 'pv.website.title' }, hint: 'hint.qrName' },
      // Meer opties (dichtgeklapt): worden toegepast bij het scannen, zie server/links.js
      { key: 'password', type: 'password', label: 'fields.password', advanced: true, hint: 'hint.password' },
      { key: 'expires', type: 'date', label: 'fields.expires', advanced: true, hint: 'hint.expires' },
      { key: 'utm', type: 'toggle', label: 'fields.utm', advanced: true, hint: 'hint.utm' } ] },
  { id: 'pdf',       icon: 'pdf',    image: 'assets/qr-types/pdf.jpg', previewImage: 'assets/previews/pdf.jpg',       contentType: 'file',     previewType: 'card',    color: '#c0392b', theme: ['#c0392b', '#1f2937'],
    fields: [
      { key: 'file', type: 'file', accept: 'application/pdf', label: 'fields.pdfFile', required: true, sample: { t: 'sample.pdfFile' } },
      { key: 'title', label: 'fields.title', sample: { t: 'pv.pdf.title' } },
      { key: 'description', label: 'fields.description', sample: { t: 'pv.pdf.desc' } },
      { key: 'company', label: 'fields.company', sample: { t: 'sample.pdfCompany' } } ] },
  { id: 'links',     icon: 'links',  image: 'assets/qr-types/links.jpg', previewImage: 'assets/previews/links.jpg',     contentType: 'links',    previewType: 'card',   color: '#2bb5f0', theme: ['#7c3aed', '#f59e0b'],
    fields: [ { key: 'title', label: 'fields.title', sample: { t: 'sample.linksTitle' } }, { key: 'link1', label: 'fields.link', n: 1, sample: { t: 'pv.links.website' } }, { key: 'link2', label: 'fields.link', n: 2, sample: { t: 'pv.links.jobs' } }, { key: 'link3', label: 'fields.link', n: 3, sample: { t: 'pv.links.support' } } ] },
  { id: 'vcard',     icon: 'vcard',  image: 'assets/qr-types/vcard.jpg', previewImage: 'assets/previews/vcard.jpg',     contentType: 'contact',  previewType: 'card',    color: '#2bb5f0', theme: ['#0f766e', '#0b3b36'],
    fields: [ { key: 'name', label: 'fields.name', sample: { t: 'sample.vcardName' } }, { key: 'role', label: 'fields.role', sample: { t: 'pv.vcard.role' } }, { key: 'phone', type: 'tel', label: 'fields.phone', sample: { t: 'sample.vcardPhone' } }, { key: 'email', type: 'email', label: 'fields.email', sample: { t: 'sample.vcardEmail' } },
      { key: 'company', label: 'fields.company', sample: { t: 'sample.vcardCompany' } }, { key: 'website', type: 'url', label: 'fields.website', sample: { t: 'sample.vcardWebsite' } }, { key: 'address', label: 'fields.address', sample: { t: 'sample.vcardAddress' } } ] },
  { id: 'business',  icon: 'biz',    image: 'assets/qr-types/business.jpg', previewImage: 'assets/previews/business.jpg',  contentType: 'business', previewType: 'card',    color: '#d08b2c', theme: ['#d08b2c', '#3b2a20'],
    fields: [
      { key: 'cover', type: 'image', label: 'fields.cover', required: true },
      { key: 'name', label: 'fields.name', sample: { t: 'sample.bizName' }, required: true },
      { key: 'description', label: 'fields.description', sample: { t: 'pv.business.descSample' } },
      { key: 'address', type: 'address', label: 'fields.address', required: true, sample: { t: 'sample.bizAddress' } },
      { key: 'hours', type: 'hours', label: 'fields.hours' },
      { key: 'phone', type: 'tel', label: 'fields.phone', sample: { t: 'sample.bizPhone' } },
      { key: 'email', type: 'email', label: 'fields.email', sample: { t: 'sample.bizEmail' } },
      { key: 'website', type: 'url', label: 'fields.website', sample: { t: 'sample.bizWebsite' } },
      { key: 'socials', type: 'socials', label: 'fields.socials', sample: '{"instagram":"https://instagram.com/bloomandco","facebook":"https://facebook.com/bloomandco","google":"https://g.page/bloomandco","whatsapp":"https://wa.me/34600000000"}' } ] },
  { id: 'video',     icon: 'video',  image: 'assets/qr-types/video.jpg', previewImage: 'assets/previews/video.jpg',     contentType: 'url',      previewType: 'card',    color: '#e5484d', theme: ['#e5484d', '#18181b'],
    fields: [
      { key: 'url', type: 'url', label: 'fields.videoUrl', required: true, sample: 'https://youtu.be/cafe-aurora', hint: 'hint.videoUrl' },
      { key: 'title', label: 'fields.title', sample: { t: 'pv.video.title' } },
      { key: 'description', label: 'fields.description', sample: { t: 'pv.video.desc' } } ] },
  { id: 'images',    icon: 'img',    image: 'assets/qr-types/images.jpg', previewImage: 'assets/previews/images.jpg',    contentType: 'gallery',  previewType: 'card', color: '#2f9e8f', theme: ['#2f9e8f', '#134e4a'],
    fields: [
      { key: 'photos', type: 'gallery', label: 'fields.photos', required: true },
      { key: 'title', label: 'fields.title', sample: { t: 'pv.images.title' } },
      { key: 'description', label: 'fields.description', sample: { t: 'pv.images.desc' } } ] },
  { id: 'facebook',  icon: 'fb',     image: 'assets/qr-types/facebook.jpg', previewImage: 'assets/previews/facebook.jpg',  contentType: 'profile',  previewType: 'card', color: '#1877f2', theme: ['#1877f2', '#0b3d91'],
    fields: [
      { key: 'url', type: 'url', label: 'fields.fbUrl', required: true, sample: { t: 'sample.fbUrl' } },
      { key: 'pageName', label: 'fields.pageName', sample: { t: 'sample.fbPage' } },
      { key: 'description', label: 'fields.description', sample: { t: 'pv.facebook.desc' } } ] },
  { id: 'instagram', page: false, icon: 'ig',     image: 'assets/qr-types/instagram.jpg', previewImage: 'assets/previews/instagram.jpg', contentType: 'profile',  previewType: 'card', color: '#d6249f', theme: ['#d6249f', '#515bd4'],
    fields: [ { key: 'username', label: 'fields.username', sample: { t: 'sample.igUser' } } ] },
  { id: 'social',    icon: 'social', image: 'assets/qr-types/social.jpg', previewImage: 'assets/previews/social.jpg',    contentType: 'links',    previewType: 'card',   color: '#5b6cf0', theme: ['#5b6cf0', '#ec4899'],
    fields: [
      { key: 'title', label: 'fields.title', sample: { t: 'sample.socialTitle' } },
      { key: 'description', label: 'fields.description', sample: { t: 'pv.social.desc' } },
      { key: 'socials', type: 'socials', label: 'fields.socials', required: true, sample: '{"instagram":"https://instagram.com/surfschoolola","facebook":"https://facebook.com/surfschoolola","tiktok":"https://tiktok.com/@surfschoolola","youtube":"https://youtube.com/@surfschoolola","linkedin":"https://linkedin.com/company/surfschoolola"}' } ] },
  { id: 'whatsapp', page: false,  icon: 'wa',     image: 'assets/qr-types/whatsapp.jpg', previewImage: 'assets/previews/whatsapp.jpg',  contentType: 'message',  previewType: 'card',    color: '#00a884', theme: ['#00a884', '#075e54'],
    fields: [ { key: 'phone', type: 'tel', label: 'fields.phone', sample: { t: 'sample.waPhone' } }, { key: 'message', label: 'fields.message', sample: { t: 'pv.whatsapp.m2' } } ] },
  { id: 'mp3',       icon: 'mp3',    image: 'assets/qr-types/mp3.jpg', previewImage: 'assets/previews/mp3.jpg',       contentType: 'file',     previewType: 'card',    color: '#8b5cf6', theme: ['#8b5cf6', '#ec4899'],
    fields: [
      { key: 'file', type: 'file', accept: 'audio/*', label: 'fields.audioFile', required: true, sample: { t: 'sample.mp3File' } },
      { key: 'title', label: 'fields.title', sample: { t: 'pv.mp3.title' } },
      { key: 'artist', label: 'fields.artist', sample: { t: 'sample.mp3Artist' } },
      { key: 'cover', type: 'image', label: 'fields.coverArt' } ] },
  { id: 'menu',      icon: 'menu',   image: 'assets/qr-types/menu.jpg', previewImage: 'assets/previews/menu.jpg',      contentType: 'menu',     previewType: 'card',    color: '#e07a2f', theme: ['#e07a2f', '#6a994e'],
    fields: [
      { key: 'restaurant', label: 'fields.restaurant', required: true, sample: { t: 'pv.menu.sub' } },
      { key: 'cover', type: 'image', label: 'fields.cover' },
      { key: 'dishes', type: 'dishes', label: 'fields.dishes', required: true, sample: { t: 'pv.menu.sampleDishes' } } ] },
  { id: 'apps',      icon: 'apps',   image: 'assets/qr-types/apps.jpg', previewImage: 'assets/previews/apps.jpg',      contentType: 'app',      previewType: 'card',    color: '#2bb5f0', theme: ['#0ea5e9', '#6366f1'],
    fields: [
      { key: 'appName', label: 'fields.appName', required: true, sample: { t: 'pv.apps.title' } },
      { key: 'description', label: 'fields.description', sample: { t: 'pv.apps.desc' } },
      { key: 'logo', type: 'image', label: 'fields.appIcon' },
      { key: 'ios', type: 'url', label: 'fields.appStore', sample: 'https://apps.apple.com/app/fitplan' },
      { key: 'android', type: 'url', label: 'fields.playStore', sample: 'https://play.google.com/store/apps/details?id=fitplan' } ] },
  { id: 'coupon',    icon: 'coupon', image: 'assets/qr-types/coupon.jpg', previewImage: 'assets/previews/coupon.jpg',    contentType: 'coupon',   previewType: 'card',    color: '#d4a017', theme: ['#b7791f', '#7c2d12'],
    fields: [
      { key: 'company', label: 'fields.company', sample: { t: 'sample.couponCompany' } },
      { key: 'title', label: 'fields.title', required: true, sample: { t: 'pv.coupon.title' } },
      { key: 'discount', type: 'number', label: 'fields.discount', sample: '15' },
      { key: 'code', label: 'fields.code', sample: { t: 'sample.couponCode' } },
      { key: 'expires', type: 'date', label: 'fields.validUntil' },
      { key: 'terms', label: 'fields.terms', sample: { t: 'pv.coupon.termsSample' } } ] },
  { id: 'wifi', page: false,      icon: 'wifi',   image: 'assets/qr-types/wifi.jpg', previewImage: 'assets/previews/wifi.jpg',      contentType: 'wifi',     previewType: 'card',    color: '#2bb5f0', theme: ['#2bb5f0', '#0f172a'],
    fields: [ { key: 'ssid', label: 'fields.ssid', sample: { t: 'sample.wifiSsid' } }, { key: 'password', label: 'fields.password', sample: '' },
              { key: 'security', type: 'select', label: 'fields.security', options: [ { value: 'WPA', label: 'WPA/WPA2' }, { value: 'WEP', label: 'WEP' }, { value: 'nopass', label: { t: 'fields.securityNone' } } ], sample: 'WPA' } ] }
]);
