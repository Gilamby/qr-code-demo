/* Vaste teksten die (nog) niet in het beheer staan: de opzegpagina en de cookiemelding.
   Nederlands, Engels en Spaans; andere talen gebruiken Engels (net als de rest van de site). */
type Cancel = { title: string; lead: string; steps: [string, string][]; notes: string[]; button: string; help: string; helpLink: string }
type Cookie = { text: string; more: string; ok: string }

export const CANCEL: Record<string, Cancel> = {
  en: {
    title: 'Cancel your subscription',
    lead: 'You can cancel any time yourself, in three steps. No phone call, no questions.',
    steps: [
      ['Log in', 'Log in to the app at my.qr-codex.com with the account the subscription is on.'],
      ['Go to your plan', 'Open My account > Plan and invoices and click Manage subscription.'],
      ['Cancel and confirm', 'Choose Cancel subscription and confirm. You will get a confirmation by email.'],
    ],
    notes: [
      'Your plan keeps running until the end of the period you have already paid for. After that you are not charged again.',
      'Cancelling during the 14-day free trial? Then you pay nothing.',
      'After your plan ends, your QR codes stop working and are deleted after 30 days. Download what you want to keep first.',
      'Fees already paid are not refunded, except in exceptional cases (see the Terms).',
    ],
    button: 'Log in and cancel',
    help: 'Can’t log in anymore? Reset your password on the login page, or',
    helpLink: 'contact us and we will cancel it for you',
  },
  nl: {
    title: 'Abonnement opzeggen',
    lead: 'Je kunt altijd zelf opzeggen, in drie stappen. Geen telefoontje, geen vragen.',
    steps: [
      ['Log in', 'Log in op de app via my.qr-codex.com met het account waar het abonnement op staat.'],
      ['Ga naar je abonnement', 'Open Mijn account > Abonnement en facturen en klik op Abonnement beheren.'],
      ['Opzeggen en bevestigen', 'Kies Abonnement opzeggen en bevestig. Je krijgt een bevestiging per e-mail.'],
    ],
    notes: [
      'Je pakket loopt door tot het einde van de periode die je al betaald hebt. Daarna wordt er niets meer afgeschreven.',
      'Zeg je op tijdens de proefperiode van 14 dagen? Dan betaal je niets.',
      'Na het einde van je pakket werken je QR-codes niet meer en worden ze na 30 dagen verwijderd. Download eerst wat je wilt bewaren.',
      'Wat al betaald is, wordt niet terugbetaald, behalve in uitzonderlijke gevallen (zie de Voorwaarden).',
    ],
    button: 'Inloggen en opzeggen',
    help: 'Kun je niet meer inloggen? Zet je wachtwoord opnieuw op het inlogscherm, of',
    helpLink: 'neem contact op, dan zeggen wij het voor je op',
  },
  es: {
    title: 'Cancelar tu suscripción',
    lead: 'Puedes cancelar tú mismo cuando quieras, en tres pasos. Sin llamadas ni preguntas.',
    steps: [
      ['Inicia sesión', 'Inicia sesión en la app en my.qr-codex.com con la cuenta que tiene la suscripción.'],
      ['Ve a tu plan', 'Abre Mi cuenta > Plan y facturas y haz clic en Gestionar suscripción.'],
      ['Cancela y confirma', 'Elige Cancelar suscripción y confirma. Recibirás una confirmación por correo.'],
    ],
    notes: [
      'Tu plan sigue activo hasta el final del periodo que ya has pagado. Después no se cobra nada más.',
      '¿Cancelas durante la prueba gratis de 14 días? Entonces no pagas nada.',
      'Cuando termina tu plan, tus códigos QR dejan de funcionar y se eliminan a los 30 días. Descarga antes lo que quieras conservar.',
      'Lo ya pagado no se reembolsa, salvo en casos excepcionales (consulta los Términos).',
    ],
    button: 'Iniciar sesión y cancelar',
    help: '¿Ya no puedes iniciar sesión? Restablece tu contraseña en la pantalla de inicio de sesión, o',
    helpLink: 'contáctanos y la cancelamos por ti',
  },
}

export const COOKIE: Record<string, Cookie> = {
  en: { text: 'We only use necessary cookies, for example to remember your language. No tracking, no advertising.', more: 'More about cookies', ok: 'OK' },
  nl: { text: 'We gebruiken alleen noodzakelijke cookies, bijvoorbeeld om je taal te onthouden. Geen tracking, geen advertenties.', more: 'Meer over cookies', ok: 'Oké' },
  es: { text: 'Solo usamos cookies necesarias, por ejemplo para recordar tu idioma. Sin seguimiento ni publicidad.', more: 'Más sobre cookies', ok: 'De acuerdo' },
}
export const pick = <T,>(m: Record<string, T>, lang: string): T => m[lang] || m.en
