/* =========================================================
   PRIVACYVERKLARING · VOORWAARDEN · COOKIES
   Elk document is een eigen pagina (/privacy, /terms, /cookies, gemaakt door de server:
   server/src/helpers/legal-pages.controller.ts). De app opent ze in een nieuw tabblad, in de gekozen taal.
   De teksten staan in de taalbestanden (sleutels legal.*); admins passen ze aan in Beheer > Vertalingen.
   ========================================================= */
var Legal = (function () {
  var DOCS = ['privacy', 'terms', 'cookies'];
  function url(d) { return '/' + (DOCS.indexOf(d) >= 0 ? d : 'privacy') + '?lang=' + encodeURIComponent(i18n.lang()); }
  function open(d) { window.open(url(d), '_blank', 'noopener'); }
  return { url: url, open: open, dialog: open };
})();
