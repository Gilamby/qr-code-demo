/* Een groet voor wie Inspecteren opent 👀 */
(function () {
  if (!window.console || !console.log) return;
  var big = 'font: 800 22px system-ui, sans-serif; color: #2bb5f0; padding: 4px 0;';
  var txt = 'font: 14px system-ui, sans-serif; line-height: 1.6; color: inherit;';
  console.log(
    '%c▄▄▄▄▄▄▄  ▄  ▄▄▄▄▄▄▄\n█ ▄▄▄ █ ▀█▄ █ ▄▄▄ █\n█ ███ █ ▄▀▄ █ ███ █\n█▄▄▄▄▄█ █▀█ █▄▄▄▄▄█',
    'font: 12px monospace; color: #2bb5f0; line-height: 1;'
  );
  console.log('%c👋 Hé developer!', big);
  console.log(
    '%cJa, je mag kijken. Nee, de geheime saus vind je hier niet: die draait op onze server. 🍝🔒\n' +
    'Yes, you may look around. No, the secret sauce isn’t here: it runs on our server.\n\n' +
    'Scan dit gerust, maar het is écht geen QR-code. 😄\n' +
    'Gemaakt met ❤️ door Optimasys · optimasys.com',
    txt
  );
})();
