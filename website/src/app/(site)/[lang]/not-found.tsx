import Link from 'next/link'

export default function NotFound() {
  return (
    <section className="page-head"><div className="wrap">
      <p className="mono muted">404</p>
      <h1 className="h1">Page not found · Pagina niet gevonden</h1>
      <Link className="link-strong" href="/">Home →</Link>
    </div></section>
  )
}
