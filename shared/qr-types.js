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
     fields       invulvelden in stap Inhoud: key, type, label (vertaalsleutel), sample (voorbeeld), options
*/
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.QR_TYPES = data;
})(typeof self !== 'undefined' ? self : this, [
  { id: 'website', page: false,   icon: 'globe',  image: 'assets/qr-types/website.jpg', previewImage: 'assets/previews/website.jpg',   contentType: 'url',      previewType: 'card',    color: '#1576c9',
    fields: [ { key: 'url', type: 'url', label: 'fields.url', sample: 'https://optimasys.com' }, { key: 'title', label: 'fields.title', sample: { t: 'pv.website.title' } } ] },
  { id: 'pdf',       icon: 'pdf',    image: 'assets/qr-types/pdf.jpg', previewImage: 'assets/previews/pdf.jpg',       contentType: 'file',     previewType: 'card',    color: '#c0392b',
    fields: [ { key: 'title', label: 'fields.title', sample: { t: 'pv.pdf.file' } } ] },
  { id: 'links',     icon: 'links',  image: 'assets/qr-types/links.jpg', previewImage: 'assets/previews/links.jpg',     contentType: 'links',    previewType: 'card',   color: '#2bb5f0',
    fields: [ { key: 'title', label: 'fields.title', sample: 'Studio Luna' }, { key: 'link1', label: 'fields.link', n: 1, sample: { t: 'pv.links.website' } }, { key: 'link2', label: 'fields.link', n: 2, sample: { t: 'pv.links.jobs' } }, { key: 'link3', label: 'fields.link', n: 3, sample: { t: 'pv.links.support' } } ] },
  { id: 'vcard',     icon: 'vcard',  image: 'assets/qr-types/vcard.jpg', previewImage: 'assets/previews/vcard.jpg',     contentType: 'contact',  previewType: 'card',    color: '#2bb5f0',
    fields: [ { key: 'name', label: 'fields.name', sample: 'Sanne de Vries' }, { key: 'role', label: 'fields.role', sample: { t: 'pv.vcard.role' } }, { key: 'phone', type: 'tel', label: 'fields.phone', sample: '+31 6 1234 5678' }, { key: 'email', type: 'email', label: 'fields.email', sample: 'sanne@example.com' },
      { key: 'company', label: 'fields.company', sample: 'Casa Verde Interiors' }, { key: 'website', type: 'url', label: 'fields.website', sample: 'https://casaverde.es' }, { key: 'address', label: 'fields.address', sample: 'Calle Ramón Gómez 4, Marbella' } ] },
  { id: 'business',  icon: 'biz',    image: 'assets/qr-types/business.jpg', previewImage: 'assets/previews/business.jpg',  contentType: 'business', previewType: 'card',    color: '#d08b2c',
    fields: [ { key: 'cover', type: 'image', label: 'fields.cover' }, { key: 'name', label: 'fields.name', sample: 'Bloom & Co' }, { key: 'description', label: 'fields.description', sample: { t: 'pv.business.descSample' } },
      { key: 'hours', label: 'fields.hours', sample: { t: 'pv.business.hoursSample' } }, { key: 'address', label: 'fields.address', sample: 'Hoofdstraat 12, Rotterdam' },
      { key: 'phone', type: 'tel', label: 'fields.phone', sample: '+31 10 123 4567' }, { key: 'email', type: 'email', label: 'fields.email', sample: 'hallo@bloomenco.nl' } ] },
  { id: 'video',     icon: 'video',  image: 'assets/qr-types/video.jpg', previewImage: 'assets/previews/video.jpg',     contentType: 'url',      previewType: 'card',    color: '#e5484d',
    fields: [ { key: 'title', label: 'fields.title', sample: { t: 'pv.video.title' } }, { key: 'url', type: 'url', label: 'fields.url', sample: 'https://youtu.be/cafe-aurora' } ] },
  { id: 'images',    icon: 'img',    image: 'assets/qr-types/images.jpg', previewImage: 'assets/previews/images.jpg', previewScreen: 'assets/screens/images.jpg',    contentType: 'gallery',  previewType: 'card', color: '#2f9e8f',
    fields: [ { key: 'title', label: 'fields.title', sample: { t: 'pv.images.title' } } ] },
  { id: 'facebook',  icon: 'fb',     image: 'assets/qr-types/facebook.jpg', previewImage: 'assets/previews/facebook.jpg',  contentType: 'profile',  previewType: 'card', color: '#1877f2',
    fields: [ { key: 'pageName', label: 'fields.pageName', sample: 'Bakkerij De Molen' } ] },
  { id: 'instagram', page: false, icon: 'ig',     image: 'assets/qr-types/instagram.jpg', previewImage: 'assets/previews/instagram.jpg', contentType: 'profile',  previewType: 'card', color: '#d6249f',
    fields: [ { key: 'username', label: 'fields.username', sample: 'studioluna.bcn' } ] },
  { id: 'social',    icon: 'social', image: 'assets/qr-types/social.jpg', previewImage: 'assets/previews/social.jpg',    contentType: 'links',    previewType: 'card',   color: '#5b6cf0',
    fields: [ { key: 'title', label: 'fields.title', sample: { t: 'pv.social.sub' } } ] },
  { id: 'whatsapp', page: false,  icon: 'wa',     image: 'assets/qr-types/whatsapp.jpg', previewImage: 'assets/previews/whatsapp.jpg',  contentType: 'message',  previewType: 'card',    color: '#00a884',
    fields: [ { key: 'phone', type: 'tel', label: 'fields.phone', sample: '+31 6 1234 5678' }, { key: 'message', label: 'fields.message', sample: { t: 'pv.whatsapp.m2' } } ] },
  { id: 'mp3',       icon: 'mp3',    image: 'assets/qr-types/mp3.jpg', previewImage: 'assets/previews/mp3.jpg',       contentType: 'file',     previewType: 'card',    color: '#8b5cf6',
    fields: [ { key: 'title', label: 'fields.title', sample: { t: 'pv.mp3.title' } }, { key: 'artist', label: 'fields.artist', sample: 'De Ochtendshow' } ] },
  { id: 'menu',      icon: 'menu',   image: 'assets/qr-types/menu.jpg', previewImage: 'assets/previews/menu.jpg',      contentType: 'menu',     previewType: 'card',    color: '#e07a2f',
    fields: [ { key: 'restaurant', label: 'fields.restaurant', sample: { t: 'pv.menu.sub' } } ] },
  { id: 'apps',      icon: 'apps',   image: 'assets/qr-types/apps.jpg', previewImage: 'assets/previews/apps.jpg',      contentType: 'app',      previewType: 'card',    color: '#2bb5f0',
    fields: [ { key: 'appName', label: 'fields.appName', sample: { t: 'pv.apps.title' } } ] },
  { id: 'coupon',    icon: 'coupon', image: 'assets/qr-types/coupon.jpg', previewImage: 'assets/previews/coupon.jpg',    contentType: 'coupon',   previewType: 'card',    color: '#d4a017',
    fields: [ { key: 'title', label: 'fields.title', sample: { t: 'pv.coupon.title' } }, { key: 'code', label: 'fields.code', sample: 'WELCOME15' }, { key: 'discount', type: 'number', label: 'fields.discount', sample: '15' } ] },
  { id: 'wifi', page: false,      icon: 'wifi',   image: 'assets/qr-types/wifi.jpg', previewImage: 'assets/previews/wifi.jpg',      contentType: 'wifi',     previewType: 'card',    color: '#2bb5f0',
    fields: [ { key: 'ssid', label: 'fields.ssid', sample: 'CafeAurora-Gast' }, { key: 'password', label: 'fields.password', sample: '' },
              { key: 'security', type: 'select', label: 'fields.security', options: [ { value: 'WPA', label: 'WPA/WPA2' }, { value: 'WEP', label: 'WEP' }, { value: 'nopass', label: { t: 'fields.securityNone' } } ], sample: 'WPA' } ] }
]);
