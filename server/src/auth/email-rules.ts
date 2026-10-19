/* =========================================================
   AANMELDEN: misbruik van de proefperiode lastiger maken
   - Wegwerp-e-mailadressen (tijdelijke mailboxen) weigeren.
   - Varianten van hetzelfde adres herkennen: bij Gmail tellen puntjes niet mee, en overal is "+iets" hetzelfde adres
     (jan.devries+1@gmail.com = jandevries@gmail.com). Zo maakt niemand tien accounts met één mailbox.
   De echte bescherming komt met Stripe: één proefperiode per kaart.
   ========================================================= */
const DISPOSABLE = new Set([
  'mailinator.com', 'mailinator.net', 'mailinator.org', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamailblock.com',
  'sharklasers.com', 'grr.la', 'pokemail.net', 'spam4.me', '10minutemail.com', '10minutemail.net', '10minutemail.co.uk', '10minemail.com', '20minutemail.com', 'temp-mail.org', 'temp-mail.io',
  'tempmail.com', 'tempmail.net', 'tempmail.dev', 'tempmailo.com', 'tempmail.plus', 'tempr.email', 'tmpmail.org', 'tmpmail.net', 'tmail.ws', 'throwawaymail.com', 'trashmail.com', 'trashmail.de',
  'trashmail.net', 'trashmail.io', 'trash-mail.com', 'yopmail.com', 'yopmail.net', 'yopmail.fr', 'cool.fr.nf', 'jetable.org', 'jetable.fr.nf', 'getnada.com', 'nada.email', 'dispostable.com',
  'maildrop.cc', 'mailnesia.com', 'mailcatch.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com', 'fakeinbox.com', 'fakemail.net', 'mytemp.email', 'mailpoof.com', 'moakt.com', 'burnermail.io',
  'spambox.us', 'spamgourmet.com', 'mailtemp.info', 'luxusmail.org', 'mail.tm', 'dropmail.me', 'emltmp.com', 'tempinbox.com', 'inboxkitten.com', 'mail7.io', 'mailsac.com', 'harakirimail.com',
  'discard.email', 'discardmail.com', 'spamdecoy.net', 'mailforspam.com', 'tempemail.co', 'temporarymail.com', 'tempail.com', 'easytrashmail.com', 'anonbox.net', 'mailexpire.com', 'incognitomail.org',
  'mvrht.net', 'spamfree24.org', 'byom.de', 'wegwerfmail.de', 'wegwerfemail.de', 'einrot.com', 'muellmail.com', 'trbvm.com', 'armyspy.com', 'cuvox.de', 'dayrep.com', 'einrot.de', 'fleckens.hu',
  'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com', 'teleworm.us', 'mailbox52.ga', 'emailfake.com', 'generator.email', 'tempmailaddress.com', 'mail-temp.com', 'minuteinbox.com', 'owlymail.com',
  'linshiyouxiang.net', 'bccto.me', 'chacuo.net', 'xojxe.com', 'yomail.info', 'zetmail.com', 'zippymail.info', 'mailnull.com', 'spamex.com', 'mailmoat.com', 'tempomail.fr', 'kasmail.com', 'hidemail.de',
]);
/** Is dit een wegwerp-adres? (ook subdomeinen, bv. abc.mailinator.com) */
export function isDisposable(email: string): boolean {
  const d = String(email || '').split('@')[1] || '';
  const parts = d.toLowerCase().split('.');
  for (let i = 0; i < parts.length - 1; i++) if (DISPOSABLE.has(parts.slice(i).join('.'))) return true;
  return false;
}
/** Vaste vorm van een adres om varianten te vergelijken (niet om op te slaan of te mailen) */
export function canonicalEmail(email: string): string {
  let [local, domain] = String(email || '').trim().toLowerCase().split('@');
  if (!local || !domain) return String(email || '').trim().toLowerCase();
  if (domain === 'googlemail.com') domain = 'gmail.com';
  local = local.split('+')[0];
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return local + '@' + domain;
}
