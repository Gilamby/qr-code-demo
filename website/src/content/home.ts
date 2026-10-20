/* Starttekst van de homepage per onderdeel (Engels, Nederlands, Spaans). Daarna aan te passen in /admin → Homepage.
   Volgorde op de pagina: generator → waarom wij → toepassingen (verhaal) → zo werkt het (filmpje) → functies
   → prijzen → vragen + contact → afsluiter. Het menu bovenin springt naar dezelfde onderdelen. */
type Item = { key: string; title: string; text?: string }
type Section = { chapter?: string; eyebrow?: string; title?: string; text?: string; cta?: string; cta2?: string; note?: string; items?: Item[] }
const i = (key: string, title: string, text = ''): Item => ({ key, title, text })

export const HOME_VERSION = 4

export const HOME: Record<'en' | 'nl' | 'es', Record<string, Section>> = {
  en: {
    hero: { eyebrow: 'QR code generator for businesses', title: 'Create your QR code.\nChange it anytime.', text: 'Make a QR code in seconds, right here. Want to change it after printing and see every scan? That’s what the Optimasys QR app is for.', cta: 'Create a dynamic code', cta2: 'Download', note: 'One free download. In the app: dynamic codes, statistics and teams. 14 days free.',
      items: [
        i('website', 'Website', 'https://yourbusiness.com'), i('menu', 'Menu', 'https://yourbusiness.com/menu'), i('wifi', 'WiFi', 'Guest WiFi'),
        i('vcard', 'vCard', 'Lisa de Vries'), i('instagram', 'Instagram', 'yourbusiness'), i('whatsapp', 'WhatsApp', '+31 6 12345678'),
        i('pdf', 'PDF', 'https://yourbusiness.com/brochure.pdf'), i('video', 'Video', 'https://youtube.com/watch?v=…'),
        i('l:link', 'Link'), i('l:username', 'Username'), i('l:network', 'Network name'), i('l:password', 'Password'), i('l:name', 'Name'), i('l:phone', 'Phone'), i('l:email', 'Email'), i('l:company', 'Company'), i('l:message', 'Message'),
        i('l:shapes', 'Squares,Dots,Rounded,Diamonds'), i('l:color', 'Colour'), i('l:frame', 'Frame text'), i('l:frameDefault', 'SCAN ME'), i('l:logo', 'Logo'),
        i('l:lowContrast', 'Low contrast: some phones will struggle to read this.'), i('l:static', 'Static code: what you typed is inside the code itself. To change it later, make it dynamic in the app.'),
        i('l:download', 'Download'), i('l:limit', 'You’ve used your free download. Create an account to make as many codes as you like, and change them later.'), i('l:preview', 'Preview'), i('l:design', 'Design'), i('l:content', 'Content'),
      ] },
    trust: { eyebrow: 'Why Optimasys QR', title: 'No small print.',
      items: [
        i('watermark', 'No watermark', 'Never, on any plan.'), i('ads', 'No ads', 'Your visitors see your page, not our adverts.'),
        i('scans', 'Unlimited scans', 'No scan limits on any plan.'), i('edit', 'Change after printing', 'New link, same printed code.'),
        i('privacy', 'Privacy first', 'We never store IP addresses. No tracking cookies.'), i('languages', '19 languages', 'For you and for the people who scan.'),
      ] },
    story: { eyebrow: 'Uses', title: 'Where a QR code works for you.', text: 'Four everyday examples. Scroll to see what happens when someone scans.', cta: 'Start 14 days free', cta2: 'Skip',
      items: [
        i('restaurant', 'Restaurant', 'The code on the table opens today’s menu.|Menu'), i('poster', 'Event poster', 'Scan the poster and buy your tickets.|Website'),
        i('packaging', 'Packaging', 'The box opens the how-to video.|Video'), i('card', 'Business card', 'Your details go straight into their phone.|vCard'),
        i('l:end', 'And you see what works.', 'Every scan counted per code, per day and per device. So you know which table, poster or box does best.'),
        i('l:scans', 'scans'), i('l:scan', 'Scanning…'), i('l:made', 'Made with Optimasys QR'),
      ] },
    how: { eyebrow: 'How it works', title: 'Three steps in the real app.', text: 'This is what you get after signing up. No design skills needed.',
      items: [
        i('l:type', 'Type'), i('l:content', 'Content'), i('l:design', 'Design'), i('l:next', 'Continue'), i('l:save', 'Save'), i('l:done', 'Done! Your QR code is ready.'), i('l:link', 'Link to your menu'), i('l:codes', 'My QR codes'), i('l:scans', 'scans'), i('l:download', 'Download'), i('l:play', 'Play'), i('l:pause', 'Pause'),
        i('type', 'Choose a type', 'Sixteen kinds of QR code. The phone shows what your visitors will see.'),
        i('content', 'Add your content', 'A link, a menu, your WiFi details or a PDF. You can change it all later.'),
        i('design', 'Make it yours', 'Colours, dot shapes, corners, your logo and a frame with text. Ready-made styles for every kind of business.'),
      ] },
    features: { eyebrow: 'Features', title: 'Create. Customize. Manage. Track.', text: 'Not a one-off generator, but one place for every QR code your business prints.', cta: 'See it in action',
      items: [
        i('dynamic', 'Dynamic codes', 'Change the destination anytime. Pause a code, set a start date or a maximum number of scans.'),
        i('design', 'Your design', 'Colours, dot shapes, corners, your logo and a frame with text. Never a watermark.'),
        i('stats', 'Statistics', 'Scans per day, country, city and device. Export to Excel or CSV.'),
        i('folders', 'Organised', 'Folders, favourites, search and filters. Download or move many codes at once.'),
        i('team', 'Teamwork', 'Invite colleagues as editor or viewer and see who did what. On Pro and Business.'),
        i('formats', 'Print-ready', 'PNG, SVG, PDF and EPS. Sharp on a business card and on a billboard.'),
      ] },
    pricing: { eyebrow: 'Pricing', title: 'Honest prices.', text: 'Every plan 14 days free. Pay yearly and get 2 months free in the first year.', cta: 'Compare all plans' },
    faq: { eyebrow: 'Questions', title: 'Frequently asked questions', cta: 'All questions', cta2: 'Contact us', note: 'Something not working, or a question we didn’t answer? We’re happy to help.' },
    final: { eyebrow: 'Get started', title: 'Optimasys QR', text: 'Create. Customize. Manage. Track.', cta: 'Start 14 days free', cta2: 'Log in', note: 'From €4.99 a month · cancel anytime' },
  },

  nl: {
    hero: { eyebrow: 'QR-codegenerator voor bedrijven', title: 'Maak je QR-code.\nWijzig hem wanneer je wilt.', text: 'Maak hier in een paar seconden een QR-code. Wil je hem na het printen nog wijzigen en elke scan zien? Daarvoor is de app Optimasys QR.', cta: 'Maak een dynamische code', cta2: 'Downloaden', note: 'Eén gratis download. In de app: dynamische codes, statistieken en teams. 14 dagen gratis.',
      items: [
        i('website', 'Website', 'https://jouwbedrijf.nl'), i('menu', 'Menukaart', 'https://jouwbedrijf.nl/menu'), i('wifi', 'Wifi', 'Gasten-wifi'),
        i('vcard', 'vCard', 'Lisa de Vries'), i('instagram', 'Instagram', 'jouwbedrijf'), i('whatsapp', 'WhatsApp', '+31 6 12345678'),
        i('pdf', 'PDF', 'https://jouwbedrijf.nl/folder.pdf'), i('video', 'Video', 'https://youtube.com/watch?v=…'),
        i('l:link', 'Link'), i('l:username', 'Gebruikersnaam'), i('l:network', 'Netwerknaam'), i('l:password', 'Wachtwoord'), i('l:name', 'Naam'), i('l:phone', 'Telefoon'), i('l:email', 'E-mail'), i('l:company', 'Bedrijf'), i('l:message', 'Bericht'),
        i('l:shapes', 'Blokjes,Rondjes,Rond,Ruiten'), i('l:color', 'Kleur'), i('l:frame', 'Tekst in het frame'), i('l:frameDefault', 'SCAN MIJ'), i('l:logo', 'Logo'),
        i('l:lowContrast', 'Weinig contrast: sommige telefoons lezen dit slecht.'), i('l:static', 'Vaste code: wat je invult staat in de code zelf. Later wijzigen? Maak hem dynamisch in de app.'),
        i('l:download', 'Downloaden'), i('l:limit', 'Je gratis download is gebruikt. Maak een account om zoveel codes te maken als je wilt, en ze later te wijzigen.'), i('l:preview', 'Voorbeeld'), i('l:design', 'Ontwerp'), i('l:content', 'Inhoud'),
      ] },
    trust: { eyebrow: 'Waarom Optimasys QR', title: 'Geen kleine lettertjes.',
      items: [
        i('watermark', 'Geen watermerk', 'Nooit, bij geen enkel pakket.'), i('ads', 'Geen reclame', 'Je bezoekers zien jouw pagina, niet onze advertenties.'),
        i('scans', 'Onbeperkt scans', 'Geen scanlimiet, bij geen enkel pakket.'), i('edit', 'Wijzigen na het printen', 'Nieuwe link, dezelfde geprinte code.'),
        i('privacy', 'Privacy voorop', 'We slaan nooit IP-adressen op. Geen volgcookies.'), i('languages', '19 talen', 'Voor jou en voor wie scant.'),
      ] },
    story: { eyebrow: 'Toepassingen', title: 'Waar een QR-code voor je werkt.', text: 'Vier voorbeelden uit de praktijk. Scroll en zie wat er gebeurt als iemand scant.', cta: 'Start 14 dagen gratis', cta2: 'Overslaan',
      items: [
        i('restaurant', 'Restaurant', 'De code op tafel opent de menukaart van vandaag.|Menukaart'), i('poster', 'Evenementposter', 'Scan de poster en koop je tickets.|Website'),
        i('packaging', 'Verpakking', 'De doos opent de video-handleiding.|Video'), i('card', 'Visitekaartje', 'Je gegevens staan meteen in hun telefoon.|vCard'),
        i('l:end', 'En jij ziet wat werkt.', 'Elke scan geteld per code, per dag en per apparaat. Zo weet je welke tafel, poster of doos het best werkt.'),
        i('l:scans', 'scans'), i('l:scan', 'Scannen…'), i('l:made', 'Gemaakt met Optimasys QR'),
      ] },
    how: { eyebrow: 'Zo werkt het', title: 'Drie stappen in de echte app.', text: 'Dit krijg je na het aanmelden. Geen ontwerpkennis nodig.',
      items: [
        i('l:type', 'Soort'), i('l:content', 'Inhoud'), i('l:design', 'Ontwerp'), i('l:next', 'Verder'), i('l:save', 'Opslaan'), i('l:done', 'Klaar! Je QR-code staat klaar.'), i('l:link', 'Link naar je menukaart'), i('l:codes', 'Mijn QR-codes'), i('l:scans', 'scans'), i('l:download', 'Downloaden'), i('l:play', 'Afspelen'), i('l:pause', 'Pauze'),
        i('type', 'Kies een soort', 'Zestien soorten QR-codes. De telefoon laat zien wat je bezoekers zien.'),
        i('content', 'Vul de inhoud in', 'Een link, een menukaart, je wifi-gegevens of een PDF. Alles kun je later wijzigen.'),
        i('design', 'Maak hem van jou', 'Kleuren, puntvormen, hoeken, je logo en een frame met tekst. Kant-en-klare stijlen voor elk soort bedrijf.'),
      ] },
    features: { eyebrow: 'Functies', title: 'Maken. Ontwerpen. Beheren. Meten.', text: 'Geen losse generator, maar één plek voor alle QR-codes die je bedrijf print.', cta: 'Bekijk hoe het werkt',
      items: [
        i('dynamic', 'Dynamische codes', 'Wijzig de bestemming wanneer je wilt. Zet een code op pauze, plan een startdatum of stel een maximum aantal scans in.'),
        i('design', 'Eigen ontwerp', 'Kleuren, puntvormen, hoeken, je logo en een frame met tekst. Nooit een watermerk.'),
        i('stats', 'Statistieken', 'Scans per dag, land, stad en apparaat. Exporteer naar Excel of CSV.'),
        i('folders', 'Overzicht', 'Mappen, favorieten, zoeken en filteren. Veel codes tegelijk downloaden of verplaatsen.'),
        i('team', 'Samenwerken', 'Nodig collega’s uit als bewerker of kijker en zie wie wat deed. Bij Pro en Business.'),
        i('formats', 'Klaar voor de drukker', 'PNG, SVG, PDF en EPS. Scherp op een visitekaartje én op een billboard.'),
      ] },
    pricing: { eyebrow: 'Prijzen', title: 'Eerlijke prijzen.', text: 'Elk pakket 14 dagen gratis. Jaarlijks betalen: het eerste jaar 2 maanden gratis.', cta: 'Vergelijk alle pakketten' },
    faq: { eyebrow: 'Vragen', title: 'Veelgestelde vragen', cta: 'Alle vragen', cta2: 'Neem contact op', note: 'Werkt er iets niet, of staat je vraag er niet bij? We helpen je graag.' },
    final: { eyebrow: 'Begin vandaag', title: 'Optimasys QR', text: 'Maken. Ontwerpen. Beheren. Meten.', cta: 'Start 14 dagen gratis', cta2: 'Inloggen', note: 'Vanaf €4,99 per maand · altijd opzegbaar' },
  },

  es: {
    hero: { eyebrow: 'Generador de códigos QR para empresas', title: 'Crea tu código QR.\nCámbialo cuando quieras.', text: 'Crea aquí un código QR en segundos. ¿Quieres cambiarlo después de imprimirlo y ver cada escaneo? Para eso está la app Optimasys QR.', cta: 'Crea un código dinámico', cta2: 'Descargar', note: 'Una descarga gratis. En la app: códigos dinámicos, estadísticas y equipos. 14 días gratis.',
      items: [
        i('website', 'Sitio web', 'https://tuempresa.es'), i('menu', 'Menú', 'https://tuempresa.es/menu'), i('wifi', 'Wi-Fi', 'Wi-Fi invitados'),
        i('vcard', 'vCard', 'Lucía García'), i('instagram', 'Instagram', 'tuempresa'), i('whatsapp', 'WhatsApp', '+34 612 345 678'),
        i('pdf', 'PDF', 'https://tuempresa.es/folleto.pdf'), i('video', 'Vídeo', 'https://youtube.com/watch?v=…'),
        i('l:link', 'Enlace'), i('l:username', 'Usuario'), i('l:network', 'Nombre de la red'), i('l:password', 'Contraseña'), i('l:name', 'Nombre'), i('l:phone', 'Teléfono'), i('l:email', 'Correo'), i('l:company', 'Empresa'), i('l:message', 'Mensaje'),
        i('l:shapes', 'Cuadrados,Puntos,Redondeado,Rombos'), i('l:color', 'Color'), i('l:frame', 'Texto del marco'), i('l:frameDefault', 'ESCANÉAME'), i('l:logo', 'Logo'),
        i('l:lowContrast', 'Poco contraste: algunos móviles lo leerán mal.'), i('l:static', 'Código fijo: lo que escribes va dentro del código. ¿Cambiarlo después? Hazlo dinámico en la app.'),
        i('l:download', 'Descargar'), i('l:limit', 'Ya has usado tu descarga gratis. Crea una cuenta para crear todos los códigos que quieras y cambiarlos después.'), i('l:preview', 'Vista previa'), i('l:design', 'Diseño'), i('l:content', 'Contenido'),
      ] },
    trust: { eyebrow: 'Por qué Optimasys QR', title: 'Sin letra pequeña.',
      items: [
        i('watermark', 'Sin marca de agua', 'Nunca, en ningún plan.'), i('ads', 'Sin anuncios', 'Tus visitantes ven tu página, no nuestra publicidad.'),
        i('scans', 'Escaneos ilimitados', 'Sin límite de escaneos en ningún plan.'), i('edit', 'Cambia después de imprimir', 'Nuevo enlace, mismo código impreso.'),
        i('privacy', 'Privacidad primero', 'Nunca guardamos direcciones IP. Sin cookies de seguimiento.'), i('languages', '19 idiomas', 'Para ti y para quien escanea.'),
      ] },
    story: { eyebrow: 'Usos', title: 'Dónde trabaja un código QR para ti.', text: 'Cuatro ejemplos del día a día. Desplázate y mira qué pasa cuando alguien escanea.', cta: 'Empieza 14 días gratis', cta2: 'Saltar',
      items: [
        i('restaurant', 'Restaurante', 'El código de la mesa abre el menú del día.|Menú'), i('poster', 'Cartel de evento', 'Escanea el cartel y compra tus entradas.|Sitio web'),
        i('packaging', 'Envase', 'La caja abre el vídeo de instrucciones.|Vídeo'), i('card', 'Tarjeta de visita', 'Tus datos, directos a su móvil.|vCard'),
        i('l:end', 'Y tú ves qué funciona.', 'Cada escaneo contado por código, por día y por dispositivo. Así sabes qué mesa, cartel o caja funciona mejor.'),
        i('l:scans', 'escaneos'), i('l:scan', 'Escaneando…'), i('l:made', 'Hecho con Optimasys QR'),
      ] },
    how: { eyebrow: 'Cómo funciona', title: 'Tres pasos en la app real.', text: 'Esto es lo que tienes al registrarte. Sin conocimientos de diseño.',
      items: [
        i('l:type', 'Tipo'), i('l:content', 'Contenido'), i('l:design', 'Diseño'), i('l:next', 'Continuar'), i('l:save', 'Guardar'), i('l:done', '¡Listo! Tu código QR está preparado.'), i('l:link', 'Enlace a tu menú'), i('l:codes', 'Mis códigos QR'), i('l:scans', 'escaneos'), i('l:download', 'Descargar'), i('l:play', 'Reproducir'), i('l:pause', 'Pausa'),
        i('type', 'Elige un tipo', 'Dieciséis tipos de código QR. El móvil muestra lo que verán tus visitantes.'),
        i('content', 'Añade el contenido', 'Un enlace, una carta, los datos de tu Wi-Fi o un PDF. Todo se puede cambiar después.'),
        i('design', 'Hazlo tuyo', 'Colores, formas de puntos, esquinas, tu logo y un marco con texto. Estilos listos para cada negocio.'),
      ] },
    features: { eyebrow: 'Funciones', title: 'Crea. Diseña. Gestiona. Mide.', text: 'No es un generador suelto, sino un solo lugar para todos los códigos QR que imprime tu empresa.', cta: 'Míralo en acción',
      items: [
        i('dynamic', 'Códigos dinámicos', 'Cambia el destino cuando quieras. Pausa un código, programa una fecha de inicio o un máximo de escaneos.'),
        i('design', 'Tu diseño', 'Colores, formas de puntos, esquinas, tu logo y un marco con texto. Nunca marca de agua.'),
        i('stats', 'Estadísticas', 'Escaneos por día, país, ciudad y dispositivo. Exporta a Excel o CSV.'),
        i('folders', 'Ordenado', 'Carpetas, favoritos, búsqueda y filtros. Descarga o mueve muchos códigos a la vez.'),
        i('team', 'En equipo', 'Invita a compañeros como editor o lector y mira quién hizo qué. En Pro y Business.'),
        i('formats', 'Listo para imprenta', 'PNG, SVG, PDF y EPS. Nítido en una tarjeta y en una valla.'),
      ] },
    pricing: { eyebrow: 'Precios', title: 'Precios honestos.', text: 'Todos los planes con 14 días gratis. Pago anual: 2 meses gratis el primer año.', cta: 'Compara todos los planes' },
    faq: { eyebrow: 'Preguntas', title: 'Preguntas frecuentes', cta: 'Todas las preguntas', cta2: 'Contáctanos', note: '¿Algo no funciona o tu pregunta no está aquí? Te ayudamos encantados.' },
    final: { eyebrow: 'Empieza hoy', title: 'Optimasys QR', text: 'Crea. Diseña. Gestiona. Mide.', cta: 'Empieza 14 días gratis', cta2: 'Iniciar sesión', note: 'Desde 4,99 € al mes · cancela cuando quieras' },
  },
}

/* Menu bovenin = de onderdelen van de homepage (zelfde namen, zelfde volgorde) */
export const NAV: Record<'en' | 'nl' | 'es', Record<string, string>> = {
  en: { generator: 'Generator', story: 'Uses', how: 'How it works', features: 'Features', solutions: 'Solutions', pricing: 'Pricing', faq: 'FAQ', contact: 'Contact', login: 'Log in', tryFree: 'Start free trial', menu: 'Menu', close: 'Close' },
  nl: { generator: 'Generator', story: 'Toepassingen', how: 'Zo werkt het', features: 'Functies', solutions: 'Oplossingen', pricing: 'Prijzen', faq: 'Vragen', contact: 'Contact', login: 'Inloggen', tryFree: 'Gratis proberen', menu: 'Menu', close: 'Sluiten' },
  es: { generator: 'Generador', story: 'Usos', how: 'Cómo funciona', features: 'Funciones', solutions: 'Soluciones', pricing: 'Precios', faq: 'Preguntas', contact: 'Contacto', login: 'Iniciar sesión', tryFree: 'Prueba gratis', menu: 'Menú', close: 'Cerrar' },
}
