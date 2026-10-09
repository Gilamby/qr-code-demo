/* =========================================================
   E-MAIL (wachtwoord vergeten)
   Stel een mailserver in met SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS en MAIL_FROM.
   Zonder mailserver (ontwikkelen): de link verschijnt in de serverlog.
   Teksten in de taal van de gebruiker (public/locales/*.json, sleutel "mail").
   ========================================================= */
const path = require('path');
let transport = null;
if (process.env.SMTP_HOST) {
  const nodemailer = require('nodemailer');
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: +(process.env.SMTP_PORT || 587), secure: +(process.env.SMTP_PORT || 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
}
const TEXT = {};
['nl', 'en', 'de', 'es', 'fr', 'it', 'pl', 'pt', 'el', 'sq'].forEach((l) => { try { TEXT[l] = require(path.join(__dirname, '..', 'public', 'locales', l + '.json')).mail; } catch (e) {} });
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

async function sendReset(to, link, lang) {
  const t = Object.assign({}, TEXT.en, TEXT[lang]);
  if (!transport) { console.log('[e-mail niet ingesteld] Wachtwoord-link voor ' + to + ': ' + link); return; }
  await transport.sendMail({
    from: process.env.MAIL_FROM || 'Optimasys QR <no-reply@optimasys.com>', to, subject: t.resetSubject,
    text: t.resetHello + '\n\n' + t.resetText + '\n' + link + '\n\n' + t.resetIgnore,
    html: '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:480px">' +
      '<p>' + esc(t.resetHello) + '</p><p>' + esc(t.resetText) + '</p>' +
      '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0b8fd8;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">' + esc(t.resetButton) + '</a></p>' +
      '<p style="color:#555;font-size:14px">' + esc(t.resetIgnore) + '</p></div>'
  });
}
module.exports = { sendReset, configured: () => !!transport };
