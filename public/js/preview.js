/* =========================================================
   PREVIEW: herbruikbare sjablonen per previewType
   Elk type levert alleen data; het sjabloon tekent.
   ========================================================= */
function svg(k, w) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.6) + '" stroke-linecap="round" stroke-linejoin="round">' + ICONS[k] + '</svg>'; }
// Per type alleen data: welke regels staan er in de preview. Het sjabloon tekent alles op dezelfde manier.
function previewRows(type, c) {
  var f = i18n.fmt;
  switch (type.id) {
    case 'website':   return [c.url.replace(/^https?:\/\//, ''), c.title, t('pv.website.cta')];
    case 'pdf':       return [c.title, f.num(12) + ' · ' + f.num(2.4) + ' MB', t('pv.pdf.cta')];
    case 'links':     return [c.link1, c.link2, c.link3];
    case 'vcard':     return [c.name, t('pv.vcard.call'), t('pv.vcard.cta')];
    case 'business':  return [c.name, c.address, t('pv.business.cta')];
    case 'video':     return [c.title, '1:42 · ' + t('pv.video.meta')];
    case 'images':    return [c.title, t('pv.images.count', { count: f.num(12) }), t('pv.images.cta')];
    case 'facebook':  return [c.pageName, t('pv.facebook.followers', { count: f.num(1240) }), t('pv.facebook.cta')];
    case 'instagram': return ['@' + c.username.replace(/^@/, ''), t('pv.instagram.stats', { posts: f.num(86), followers: f.num(3100) }), t('pv.instagram.cta')];
    case 'social':    return ['Instagram', 'Facebook', 'LinkedIn'];
    case 'whatsapp':  return [c.phone, c.message, t('pv.whatsapp.start')];
    case 'mp3':       return [c.title, c.artist, t('pv.mp3.cta')];
    case 'menu':      return [c.restaurant, t('pv.menu.dish1') + ' · ' + f.eur(18.5), t('pv.menu.cta')];
    case 'apps':      return [c.appName, 'App Store', 'Google Play'];
    case 'coupon':    return [c.title, c.code + ' · ' + f.pct((parseFloat(c.discount) || 0) / 100), t('pv.coupon.cta')];
    case 'wifi':      return [c.ssid, c.security === 'nopass' ? t('fields.securityNone') : c.security, t('pv.wifi.cta')];
  }
}
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); };
var CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
// Foto bovenin de telefoon: zet een bestand op type.previewImage (public/assets/previews/<id>.jpg).
// Bestaat het bestand niet, dan blijft de preview zonder foto.
var PREVIEW_PHOTOS = {};
function previewPhoto(type) {
  if (!type.previewImage) return '';
  var st = PREVIEW_PHOTOS[type.id];
  if (st === undefined) {
    PREVIEW_PHOTOS[type.id] = 'loading';
    var img = new Image();
    img.onload = function () { PREVIEW_PHOTOS[type.id] = 'ok'; document.dispatchEvent(new Event('preview:refresh')); };
    img.onerror = function () { PREVIEW_PHOTOS[type.id] = 'missing'; };
    img.src = type.previewImage;
  }
  return st === 'ok' ? '<div class="pv-photo" style="background-image:url(' + type.previewImage + ')"></div>' : '';
}
var TEMPLATES = {
  card: function (type, rows) {
    return previewPhoto(type) + '<div class="pv-top"><span class="pv-icon">' + svg(type.icon, 1.7) + '</span>' +
      '<svg class="pv-more" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg></div>' +
      '<div class="pv-brand">Optimasys</div><div class="pv-title">' + esc(typeName(type)) + '</div><div class="pv-sub">' + esc(typeDesc(type)) + '</div>' +
      '<div class="pv-rows">' + rows.filter(Boolean).map(function (r) { return '<div class="pv-row"><span class="ri">' + svg(type.icon, 1.7) + '</span><span class="lbl">' + esc(r) + '</span>' + CHEV + '</div>'; }).join('') + '</div>';
  }
};
function renderPreview(state) { var type = getType(state.typeId); return TEMPLATES[type.previewType](type, previewRows(type, resolvedContent(state))); }
