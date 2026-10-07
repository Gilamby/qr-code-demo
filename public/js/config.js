/* =========================================================
   CONFIGURATIE: QR-types (één bron, UI rendert dit dynamisch)
   De lijst zelf staat in shared/qr-types.js (gedeeld met de backend).
   ========================================================= */
var ICONS = {
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
    pdf: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/>',
    links: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    vcard: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h5M14 13.5h4"/>',
    biz: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18"/>',
    video: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z"/>',
    img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 15.5l-5-5-10 9.5"/>',
    fb: '<path d="M14 21v-8h3l.5-3.5H14V7.5c0-1 .4-1.7 1.8-1.7H18V2.8a20 20 0 0 0-2.6-.2c-2.7 0-4.4 1.6-4.4 4.5v2.4H8V13h3v8"/>',
    ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
    social: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
    wa: '<path d="M3.5 20.5l1.4-4.1A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 8.5c0 3.4 3.1 6.5 6.5 6.5l1-1.6-2.1-1-1 1c-1.1-.5-2.2-1.6-2.7-2.7l1-1-1-2.1z"/>',
    mp3: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    menu: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-1.7 1.5-2.5 3.5-2.5 6.5 0 1.5.8 2.5 2.5 2.5v9M16 3v9"/>',
    apps: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    coupon: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M10 10l4 4M10 14h.01M14 10h.01"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>'
  };

var QR_TYPES = window.QR_TYPES;   // komt uit shared/qr-types.js
// Naam en omschrijving komen uit het vertaalsysteem: types.<id>.name / types.<id>.desc
function typeName(type) { return t('types.' + type.id + '.name'); }
function typeDesc(type) { return t('types.' + type.id + '.desc'); }
function getType(id) { return QR_TYPES.filter(function (x) { return x.id === id; })[0]; }

var DESIGN_OPTIONS = {
  colors: ['#0b0e13', '#0f3d63', '#0b8fd8', '#5b2a86', '#0f5c45', '#a7b0bd'],
  backgrounds: ['#ffffff', '#f2f5f9', '#fff4e0', '#0b0e13']
};
var STEPS = ['type', 'content', 'design'];
