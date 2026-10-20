import { NextResponse, type NextRequest } from 'next/server'
import { CODES, fromAcceptLanguage, isLocale } from './lib/locales'

/* Elke pagina heeft de taal in het adres (/nl/pricing). Zonder taal: kies de laatst gekozen taal, anders die van de browser. */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const first = pathname.split('/')[1] || ''
  if (isLocale(first)) return NextResponse.next()
  const saved = req.cookies.get('lang')?.value
  const lang = saved && CODES.includes(saved) ? saved : fromAcceptLanguage(req.headers.get('accept-language'))
  const url = req.nextUrl.clone()
  url.pathname = '/' + lang + (pathname === '/' ? '' : pathname)
  url.search = search
  return NextResponse.redirect(url)
}

export const config = {
  // niet voor het beheer, de API, Next-bestanden en losse bestanden (favicon.svg, robots.txt …)
  matcher: ['/((?!admin|api|_next|.*\\..*).*)'],
}
