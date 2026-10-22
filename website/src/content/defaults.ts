/* =========================================================
   STARTTEKSTEN van de website (Engels, Nederlands, Spaans)
   Bij de eerste start zet de website deze in het beheer (Payload). Daarna pas je alles aan in /admin;
   dit bestand wordt dan niet meer gebruikt. Andere talen tonen Engels tot ze in het beheer zijn ingevuld.
   ========================================================= */
type Txt = Record<string, any>

const PRICES = [
  { key: 'standard', priceMonth: 4.99, priceYear: 49.9, priceYearAfter: 59.88, popular: false },
  { key: 'pro', priceMonth: 12.99, priceYear: 129.9, priceYearAfter: 155.88, popular: true },
  { key: 'business', priceMonth: 24.99, priceYear: 249.9, priceYearAfter: 299.88, popular: false },
]
export { PRICES }

const words = (s: string) => s.split('|').map((text) => ({ text }))

export const CONTENT: Record<'en' | 'nl' | 'es', Txt> = {
  /* ------------------------------------------------ ENGLISH */
  en: {
    settings: {
      contactEmail: 'support@optimasys.es',
      seo: { title: 'QR-Codex — dynamic QR codes in your own style', description: 'Create QR codes in your own style, change where they lead at any time and see how often they are scanned. No watermark. 14 days free.' },
      nav: { features: 'Features', solutions: 'Solutions', pricing: 'Pricing', faq: 'FAQ', contact: 'Contact', login: 'Log in', tryFree: 'Create QR code', menu: 'Menu', close: 'Close' },
      footer: { tagline: 'Dynamic QR codes for businesses that like things done properly.', product: 'Product', company: 'Help', legal: 'Legal', cancel: 'Cancel subscription', language: 'Language', rights: 'All rights reserved.' },
      contactPage: { title: 'Get in touch', text: 'A question about QR-Codex, a plan or an invoice? Send us a message and we will reply by email.', name: 'Name', email: 'Email', topic: 'Topic', topics: 'Question|Pricing and billing|Feedback|Something else', message: 'Message', send: 'Send message', sent: 'Thanks! Your message has been sent. We will reply by email.', error: 'Sending failed. Please try again in a moment.', privacy: 'We only use your details to answer your message.', customers: 'Already a customer? Log in and use Help in the app, then we immediately know which account it is about.' },
      faqPage: { title: 'Frequently asked questions', text: 'Everything about QR codes, your plan and payments.', general: 'General', billing: 'Plans and payment', more: 'Is your question not here? Send us a message.' },
      notFound: { title: 'This page does not exist', text: 'Maybe the link is old or mistyped.', back: 'Back to the homepage' },
    },
    pricing: {
      title: 'Choose your plan', subtitle: 'Every plan 14 days free. You only pay after the trial and you can cancel anytime.',
      monthly: 'Monthly', yearly: 'Yearly', yearlyBadge: '2 months free in year 1', perMonth: '/ month', perFirstYear: '/ first year',
      monthNote: 'Cancel monthly. Your first paid month is cheaper.', yearNote: 'That is {month} a month. After that {after} a year.', cta: 'Start 14 days free', popular: 'Most popular',
      vatNote: 'All prices excluding VAT. Secure payment via Stripe.',
      plans: {
        standard: { name: 'Standard', lead: 'For freelancers and small shops', items: words('5 dynamic QR codes|1 user|Statistics for 30 days|All 16 QR types|Your own design and logo|No watermark') },
        pro: { name: 'Pro', lead: 'For growing businesses', items: words('50 dynamic QR codes|3 users (editor or viewer)|Statistics for 365 days|Log of who did what|Everything in Standard') },
        business: { name: 'Business', lead: 'For teams and organisations', items: words('Unlimited QR codes|Unlimited users|All statistics, no limit|Log of who did what|Everything in Pro') },
      },
      compareTitle: 'Side by side', compareFeature: 'Feature',
      rows: [
        ['Dynamic QR codes', '5', '50', 'Unlimited'], ['Users', '1', '3', 'Unlimited'], ['Statistics kept', '30 days', '365 days', 'Unlimited'],
        ['QR types', 'All 16', 'All 16', 'All 16'], ['Own design and logo', 'Yes', 'Yes', 'Yes'], ['No watermark', 'Yes', 'Yes', 'Yes'],
        ['Download PNG, SVG, PDF, EPS', 'Yes', 'Yes', 'Yes'], ['Folders and favourites', 'Yes', 'Yes', 'Yes'], ['Export to Excel and CSV', 'Yes', 'Yes', 'Yes'],
        ['Team roles and log', '–', 'Yes', 'Yes'], ['Free trial', '14 days', '14 days', '14 days'],
      ],
      faqTitle: 'Questions about paying',
    },
    faqs: [
      ['general', true, 'What is a dynamic QR code?', 'The code points to our address and we forward the visitor. That is why you can change the destination later and count the scans, without printing the code again.'],
      ['general', true, 'Can I change a code after printing it?', 'Yes. Change the link, the menu or the PDF whenever you like. The printed code stays the same.'],
      ['general', false, 'Is there a watermark on my codes?', 'No. Never, on any plan.'],
      ['general', false, 'Which files can I download?', 'PNG for screens, SVG and EPS for print shops and PDF to print yourself.'],
      ['general', true, 'What happens if I stop?', 'Your codes stop working straight away, but we keep them for 30 days. Renew within that time and everything works again, including your printed codes. After 30 days they are deleted.'],
      ['general', false, 'Can I work together with colleagues?', 'Yes, on Pro (3 users) and Business (unlimited). Everyone logs in with their own email address and gets the role editor or viewer.'],
      ['billing', true, 'How does the free trial work?', 'You create an account and enter your payment details. The first 14 days are free. Cancel before the end and nothing is charged. One trial per customer.'],
      ['billing', false, 'What does yearly cost after the first year?', 'In the first year you get 2 months free. After that you pay 12 times the monthly price per year: €59.88 for Standard, €155.88 for Pro and €299.88 for Business. Offers apply once per customer.'],
      ['billing', false, 'Can I switch plans later?', 'Yes, you can move to a bigger or smaller plan at any time.'],
      ['billing', false, 'Do I get an invoice?', 'Yes. After every payment you receive an invoice by email, and you can find them in your account.'],
      ['billing', false, 'How do I cancel?', 'In the app under My account → Plan and invoices → Manage subscription (step by step: the Cancel subscription page in the footer). You keep access until the end of the period you have paid for.'],
    ],
    pages: {
      privacy: ['Privacy policy', ['Who we are', 'This website and the QR-Codex app are run by Optimasys.'], ['What we collect on this website', 'This website does not use tracking or advertising cookies. If you use the contact form, we store your name, email address and message to answer you.'], ['Your rights', 'You can ask us to see, correct or delete your data at any time via the contact page.']],
      terms: ['Terms and conditions', ['Draft', 'The full terms and conditions will be published here before launch.']],
      cookies: ['Cookies', ['Only necessary cookies', 'This website does not use tracking or advertising cookies, so there is nothing to choose: we only show a short notice once. The app (my.qr-codex.com) uses a necessary cookie to keep you logged in.']],
    },
  },

  /* ------------------------------------------------ NEDERLANDS */
  nl: {
    settings: {
      seo: { title: 'QR-Codex — dynamische QR-codes in je eigen stijl', description: 'Maak QR-codes in je eigen stijl, wijzig de bestemming wanneer je wilt en zie hoe vaak er gescand wordt. Zonder watermerk. 14 dagen gratis.' },
      nav: { features: 'Functies', solutions: 'Oplossingen', pricing: 'Prijzen', faq: 'Vragen', contact: 'Contact', login: 'Inloggen', tryFree: 'QR-code maken', menu: 'Menu', close: 'Sluiten' },
      footer: { tagline: 'Dynamische QR-codes voor bedrijven die het graag goed geregeld hebben.', product: 'Product', company: 'Hulp', legal: 'Juridisch', cancel: 'Abonnement opzeggen', language: 'Taal', rights: 'Alle rechten voorbehouden.' },
      contactPage: { title: 'Neem contact op', text: 'Een vraag over QR-Codex, een pakket of een factuur? Stuur ons een bericht, dan antwoorden we per e-mail.', name: 'Naam', email: 'E-mail', topic: 'Onderwerp', topics: 'Vraag|Prijzen en betalen|Idee of feedback|Iets anders', message: 'Bericht', send: 'Bericht versturen', sent: 'Bedankt! Je bericht is verstuurd. We antwoorden per e-mail.', error: 'Versturen lukte niet. Probeer het zo nog eens.', privacy: 'We gebruiken je gegevens alleen om je bericht te beantwoorden.', customers: 'Al klant? Log in en gebruik Hulp in de app, dan weten we meteen om welk account het gaat.' },
      faqPage: { title: 'Veelgestelde vragen', text: 'Alles over QR-codes, je pakket en betalen.', general: 'Algemeen', billing: 'Pakketten en betalen', more: 'Staat je vraag er niet bij? Stuur ons een bericht.' },
      notFound: { title: 'Deze pagina bestaat niet', text: 'Misschien is de link oud of verkeerd getypt.', back: 'Terug naar de homepage' },
    },
    pricing: {
      title: 'Kies je pakket', subtitle: 'Elk pakket 14 dagen gratis. Je betaalt pas na de proefperiode en kunt altijd opzeggen.',
      monthly: 'Maandelijks', yearly: 'Jaarlijks', yearlyBadge: '1e jaar 2 maanden gratis', perMonth: '/ maand', perFirstYear: '/ eerste jaar',
      monthNote: 'Maandelijks opzegbaar. Je eerste betaalde maand is goedkoper.', yearNote: 'Dat is {month} per maand. Daarna {after} per jaar.', cta: 'Start 14 dagen gratis', popular: 'Meest gekozen',
      vatNote: 'Alle prijzen exclusief btw. Veilig betalen via Stripe.',
      plans: {
        standard: { name: 'Standard', lead: 'Voor zzp’ers en kleine zaken', items: words('5 dynamische QR-codes|1 gebruiker|Statistieken van 30 dagen|Alle 16 soorten QR-codes|Eigen ontwerp met logo|Geen watermerk') },
        pro: { name: 'Pro', lead: 'Voor groeiende bedrijven', items: words('50 dynamische QR-codes|3 gebruikers (bewerker of kijker)|Statistieken van 365 dagen|Logboek: wie deed wat|Alles uit Standard') },
        business: { name: 'Business', lead: 'Voor teams en organisaties', items: words('Onbeperkt QR-codes|Onbeperkt gebruikers|Alle statistieken, zonder limiet|Logboek: wie deed wat|Alles uit Pro') },
      },
      compareTitle: 'Alles naast elkaar', compareFeature: 'Functie',
      rows: [
        ['Dynamische QR-codes', '5', '50', 'Onbeperkt'], ['Gebruikers', '1', '3', 'Onbeperkt'], ['Statistieken bewaard', '30 dagen', '365 dagen', 'Onbeperkt'],
        ['Soorten QR-codes', 'Alle 16', 'Alle 16', 'Alle 16'], ['Eigen ontwerp en logo', 'Ja', 'Ja', 'Ja'], ['Zonder watermerk', 'Ja', 'Ja', 'Ja'],
        ['Downloaden als PNG, SVG, PDF, EPS', 'Ja', 'Ja', 'Ja'], ['Mappen en favorieten', 'Ja', 'Ja', 'Ja'], ['Export naar Excel en CSV', 'Ja', 'Ja', 'Ja'],
        ['Teamrollen en logboek', '–', 'Ja', 'Ja'], ['Proefperiode', '14 dagen', '14 dagen', '14 dagen'],
      ],
      faqTitle: 'Vragen over betalen',
    },
    faqs: [
      ['general', true, 'Wat is een dynamische QR-code?', 'De code verwijst naar ons adres en wij sturen de bezoeker door. Daardoor kun je de bestemming later wijzigen en de scans tellen, zonder de code opnieuw te printen.'],
      ['general', true, 'Kan ik een code wijzigen nadat hij geprint is?', 'Ja. Wijzig de link, de menukaart of de PDF wanneer je wilt. De geprinte code blijft hetzelfde.'],
      ['general', false, 'Staat er een watermerk op mijn codes?', 'Nee. Nooit, bij geen enkel pakket.'],
      ['general', false, 'Welke bestanden kan ik downloaden?', 'PNG voor schermen, SVG en EPS voor de drukkerij en PDF om zelf af te drukken.'],
      ['general', true, 'Wat gebeurt er als ik stop?', 'Je codes werken meteen niet meer, maar we bewaren ze 30 dagen. Verleng je in die tijd, dan werkt alles weer, ook je geprinte codes. Na 30 dagen worden ze verwijderd.'],
      ['general', false, 'Kan ik samenwerken met collega’s?', 'Ja, bij Pro (3 gebruikers) en Business (onbeperkt). Iedereen logt in met een eigen e-mailadres en krijgt de rol bewerker of kijker.'],
      ['billing', true, 'Hoe werkt de proefperiode?', 'Je maakt een account en vult je betaalgegevens in. De eerste 14 dagen betaal je niets. Zeg je op voor het einde, dan wordt er niets afgeschreven. Je kunt één keer gratis proberen.'],
      ['billing', false, 'Wat kost jaarlijks betalen na het eerste jaar?', 'Het eerste jaar krijg je 2 maanden gratis. Daarna betaal je 12 keer de maandprijs per jaar: €59,88 voor Standard, €155,88 voor Pro en €299,88 voor Business. Acties gelden één keer per klant.'],
      ['billing', false, 'Kan ik later van pakket wisselen?', 'Ja, je kunt op elk moment overstappen naar een groter of kleiner pakket.'],
      ['billing', false, 'Krijg ik een factuur?', 'Ja. Na elke betaling krijg je een factuur per e-mail, en je vindt ze ook terug in je account.'],
      ['billing', false, 'Hoe zeg ik op?', 'In de app onder Mijn account → Abonnement en facturen → Abonnement beheren (stap voor stap: de pagina Abonnement opzeggen onderaan de site). Je houdt toegang tot het einde van de periode die je al betaald hebt.'],
    ],
    pages: {
      privacy: ['Privacyverklaring', ['Wie we zijn', 'Deze website en de app QR-Codex zijn van Optimasys.'], ['Wat we op deze website verzamelen', 'Deze website gebruikt geen volg- of advertentiecookies. Gebruik je het contactformulier, dan bewaren we je naam, e-mailadres en bericht om je te antwoorden.'], ['Je rechten', 'Je kunt ons altijd via de contactpagina vragen je gegevens in te zien, te verbeteren of te verwijderen.']],
      terms: ['Algemene voorwaarden', ['Concept', 'De volledige algemene voorwaarden komen hier voor de lancering.']],
      cookies: ['Cookies', ['Alleen noodzakelijke cookies', 'Deze website gebruikt geen volg- of advertentiecookies, er valt dus niets te kiezen: we laten het je één keer kort weten. De app (my.qr-codex.com) gebruikt een noodzakelijke cookie om je ingelogd te houden.']],
    },
  },

  /* ------------------------------------------------ ESPAÑOL */
  es: {
    settings: {
      seo: { title: 'QR-Codex — códigos QR dinámicos con tu propio estilo', description: 'Crea códigos QR con tu propio estilo, cambia su destino cuando quieras y descubre cuántas veces se escanean. Sin marca de agua. 14 días gratis.' },
      nav: { features: 'Funciones', solutions: 'Soluciones', pricing: 'Precios', faq: 'Preguntas', contact: 'Contacto', login: 'Iniciar sesión', tryFree: 'Crear código QR', menu: 'Menú', close: 'Cerrar' },
      footer: { tagline: 'Códigos QR dinámicos para empresas a las que les gustan las cosas bien hechas.', product: 'Producto', company: 'Ayuda', legal: 'Legal', cancel: 'Cancelar suscripción', language: 'Idioma', rights: 'Todos los derechos reservados.' },
      contactPage: { title: 'Contacta con nosotros', text: '¿Una pregunta sobre QR-Codex, un plan o una factura? Envíanos un mensaje y te responderemos por correo.', name: 'Nombre', email: 'Correo electrónico', topic: 'Tema', topics: 'Pregunta|Precios y pagos|Idea o comentario|Otra cosa', message: 'Mensaje', send: 'Enviar mensaje', sent: '¡Gracias! Tu mensaje se ha enviado. Te responderemos por correo.', error: 'No se pudo enviar. Inténtalo de nuevo en un momento.', privacy: 'Solo usamos tus datos para responder a tu mensaje.', customers: '¿Ya eres cliente? Inicia sesión y usa Ayuda en la app; así sabremos enseguida de qué cuenta se trata.' },
      faqPage: { title: 'Preguntas frecuentes', text: 'Todo sobre los códigos QR, tu plan y los pagos.', general: 'General', billing: 'Planes y pagos', more: '¿No encuentras tu pregunta? Envíanos un mensaje.' },
      notFound: { title: 'Esta página no existe', text: 'Puede que el enlace sea antiguo o esté mal escrito.', back: 'Volver al inicio' },
    },
    pricing: {
      title: 'Elige tu plan', subtitle: 'Todos los planes con 14 días gratis. Solo pagas después de la prueba y puedes cancelar cuando quieras.',
      monthly: 'Mensual', yearly: 'Anual', yearlyBadge: '1.er año: 2 meses gratis', perMonth: '/ mes', perFirstYear: '/ primer año',
      monthNote: 'Cancelación mensual. Tu primer mes de pago es más barato.', yearNote: 'Son {month} al mes. Después {after} al año.', cta: 'Empieza 14 días gratis', popular: 'El más elegido',
      vatNote: 'Precios sin IVA. Pago seguro con Stripe.',
      plans: {
        standard: { name: 'Standard', lead: 'Para autónomos y pequeños negocios', items: words('5 códigos QR dinámicos|1 usuario|Estadísticas de 30 días|Los 16 tipos de código QR|Diseño propio con logo|Sin marca de agua') },
        pro: { name: 'Pro', lead: 'Para empresas en crecimiento', items: words('50 códigos QR dinámicos|3 usuarios (editor o lector)|Estadísticas de 365 días|Registro de quién hizo qué|Todo lo de Standard') },
        business: { name: 'Business', lead: 'Para equipos y organizaciones', items: words('Códigos QR ilimitados|Usuarios ilimitados|Todas las estadísticas, sin límite|Registro de quién hizo qué|Todo lo de Pro') },
      },
      compareTitle: 'Comparación', compareFeature: 'Función',
      rows: [
        ['Códigos QR dinámicos', '5', '50', 'Ilimitados'], ['Usuarios', '1', '3', 'Ilimitados'], ['Estadísticas guardadas', '30 días', '365 días', 'Sin límite'],
        ['Tipos de código QR', 'Los 16', 'Los 16', 'Los 16'], ['Diseño propio y logo', 'Sí', 'Sí', 'Sí'], ['Sin marca de agua', 'Sí', 'Sí', 'Sí'],
        ['Descarga en PNG, SVG, PDF, EPS', 'Sí', 'Sí', 'Sí'], ['Carpetas y favoritos', 'Sí', 'Sí', 'Sí'], ['Exportar a Excel y CSV', 'Sí', 'Sí', 'Sí'],
        ['Roles de equipo y registro', '–', 'Sí', 'Sí'], ['Prueba gratis', '14 días', '14 días', '14 días'],
      ],
      faqTitle: 'Preguntas sobre pagos',
    },
    faqs: [
      ['general', true, '¿Qué es un código QR dinámico?', 'El código apunta a nuestra dirección y nosotros redirigimos al visitante. Por eso puedes cambiar el destino más tarde y contar los escaneos, sin volver a imprimir el código.'],
      ['general', true, '¿Puedo cambiar un código después de imprimirlo?', 'Sí. Cambia el enlace, la carta o el PDF cuando quieras. El código impreso sigue siendo el mismo.'],
      ['general', false, '¿Llevan marca de agua mis códigos?', 'No. Nunca, en ningún plan.'],
      ['general', false, '¿Qué archivos puedo descargar?', 'PNG para pantallas, SVG y EPS para la imprenta y PDF para imprimir tú mismo.'],
      ['general', true, '¿Qué pasa si dejo de pagar?', 'Tus códigos dejan de funcionar al instante, pero los guardamos 30 días. Si renuevas en ese plazo, todo vuelve a funcionar, también tus códigos impresos. Después de 30 días se eliminan.'],
      ['general', false, '¿Puedo trabajar con compañeros?', 'Sí, en Pro (3 usuarios) y Business (ilimitados). Cada uno entra con su propio correo y recibe el rol de editor o lector.'],
      ['billing', true, '¿Cómo funciona la prueba gratis?', 'Creas una cuenta e introduces tus datos de pago. Los primeros 14 días no pagas nada. Si cancelas antes de que terminen, no se cobra nada. Solo hay una prueba por cliente.'],
      ['billing', false, '¿Cuánto cuesta el plan anual después del primer año?', 'El primer año tienes 2 meses gratis. Después pagas 12 veces el precio mensual al año: 59,88 € por Standard, 155,88 € por Pro y 299,88 € por Business. Las ofertas son una vez por cliente.'],
      ['billing', false, '¿Puedo cambiar de plan más adelante?', 'Sí, puedes pasar a un plan mayor o menor en cualquier momento.'],
      ['billing', false, '¿Recibo factura?', 'Sí. Después de cada pago recibes una factura por correo y también las encuentras en tu cuenta.'],
      ['billing', false, '¿Cómo cancelo?', 'En la app, en Mi cuenta → Plan y facturas → Gestionar suscripción (paso a paso: la página Cancelar suscripción del pie de página). Mantienes el acceso hasta el final del periodo que ya has pagado.'],
    ],
    pages: {
      privacy: ['Política de privacidad', ['Quiénes somos', 'Este sitio web y la app QR-Codex pertenecen a Optimasys.'], ['Qué recogemos en este sitio', 'Este sitio no usa cookies de seguimiento ni de publicidad. Si usas el formulario de contacto, guardamos tu nombre, correo y mensaje para responderte.'], ['Tus derechos', 'Puedes pedirnos en cualquier momento, desde la página de contacto, ver, corregir o eliminar tus datos.']],
      terms: ['Términos y condiciones', ['Borrador', 'Los términos y condiciones completos se publicarán aquí antes del lanzamiento.']],
      cookies: ['Cookies', ['Solo cookies necesarias', 'Este sitio no usa cookies de seguimiento ni de publicidad, así que no hay nada que elegir: solo te lo indicamos una vez con un breve aviso. La app (my.qr-codex.com) usa una cookie necesaria para mantener tu sesión.']],
    },
  },
}
