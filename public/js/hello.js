/* Een groet voor wie Inspecteren opent 👀 */
(function () {
  if (!window.console || !console.log) return;
  var big = 'font: 800 22px system-ui, sans-serif; color: #2bb5f0; padding: 4px 0;';
  var txt = 'font: 14px system-ui, sans-serif; line-height: 1.6; color: inherit;';
  console.log(
    '%c▄▄▄▄▄▄▄  ▄  ▄▄▄▄▄▄▄\n█ ▄▄▄ █ ▀█▄ █ ▄▄▄ █\n█ ███ █ ▄▀▄ █ ███ █\n█▄▄▄▄▄█ █▀█ █▄▄▄▄▄█',
    'font: 12px monospace; color: #2bb5f0; line-height: 1;'
  );
  console.log('%c👋 Hey developer!', big);
  console.log(
    '%cCurious how it works? We like that. 👀\n\n' +
    'Go ahead and scan this, but it’s really not a QR code. 😄\n' +
    'Made with ❤️ by Optimasys · optimasys.com',
    txt
  );
})();
