import { matrix, type Shape } from './qr'

/* QR-code als los SVG-bestand (vaste vormen, geen CSS nodig) en als PNG. Voor de download-knop in de generator. */
const LOGO_PATHS = '<g fill="none" stroke="FG" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22v-7a7 7 0 0 1 7-7h7M42 8h7a7 7 0 0 1 7 7v7M56 42v7a7 7 0 0 1-7 7h-7M22 56h-7a7 7 0 0 1-7-7v-7"/><rect x="22.5" y="22.5" width="19" height="19" rx="5" stroke-width="5" transform="rotate(45 32 32)"/></g><rect x="28.5" y="28.5" width="7" height="7" rx="1.8" fill="FG" transform="rotate(45 32 32)"/>'
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string)

export function qrSvg(opts: { text: string; shape: Shape; fg: string | [string, string]; logo: boolean; frame?: string }) {
  const { text, shape, fg, logo, frame } = opts
  const m = matrix(text, logo ? 'H' : 'M', logo ? 7 : 0)
  const S = m.size, q = 2, unit = 30, qrPx = (S + q * 2) * unit
  const grad = Array.isArray(fg)
  const fill = grad ? 'url(#g)' : fg
  const pad = frame ? 36 : 0, textH = frame ? 150 : 0
  const W = qrPx + pad * 2, H = qrPx + pad * 2 + textH
  const r = { square: 0, dots: 0.5, rounded: 0.32, diamonds: 0.08 }[shape]
  const fo = { square: 0, dots: 3, rounded: 1.6, diamonds: 1 }[shape], fi = { square: 0, dots: 1.5, rounded: 0.9, diamonds: 0.5 }[shape]
  const mods = m.dark.map(([x, y]) => {
    if (shape === 'dots') return `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.43"/>`
    if (shape === 'diamonds') return `<rect x="${x + 0.14}" y="${y + 0.14}" width="0.72" height="0.72" rx="${r}" transform="rotate(45 ${x + 0.5} ${y + 0.5})"/>`
    if (shape === 'rounded') return `<rect x="${x + 0.025}" y="${y + 0.025}" width="0.95" height="0.95" rx="${r}"/>`
    return `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`
  }).join('')
  const finders = m.finders.map(([x, y]) =>
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="${fo}" fill="none" stroke="${fill}" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${fi}" fill="${fill}"/>`).join('')
  const logoSvg = logo ? `<rect x="${S / 2 - 3}" y="${S / 2 - 3}" width="6" height="6" rx="1.6" fill="#fff"/><svg x="${S / 2 - 2.4}" y="${S / 2 - 2.4}" width="4.8" height="4.8" viewBox="0 0 64 64">${LOGO_PATHS.replace(/FG/g, grad ? fg[0] : (fg as string))}</svg>` : ''
  const defs = `<defs>${grad ? `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="${fg[0]}"/><stop offset="1" stop-color="${fg[1]}"/></linearGradient><linearGradient id="fg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fg[0]}"/><stop offset="1" stop-color="${fg[1]}"/></linearGradient>` : ''}</defs>`
  const qr = `<svg x="${pad}" y="${pad}" width="${qrPx}" height="${qrPx}" viewBox="${-q} ${-q} ${S + q * 2} ${S + q * 2}"><rect x="${-q}" y="${-q}" width="${S + q * 2}" height="${S + q * 2}" rx="${frame ? 1.2 : 0}" fill="#fff"/><g fill="${fill}">${mods}</g>${finders}${logoSvg}</svg>`
  const frameBg = frame ? `<rect width="${W}" height="${H}" rx="60" fill="${grad ? 'url(#fg2)' : fg}"/>` : ''
  const label = frame ? `<text x="${W / 2}" y="${qrPx + pad + textH / 2 + 30}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="84" letter-spacing="6" fill="#fff">${esc(frame.toUpperCase())}</text>` : ''
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${frameBg}${qr}${label}</svg>`, W, H }
}

function save(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
export function downloadSvg(svg: string, name = 'qr-code.svg') { save(new Blob([svg], { type: 'image/svg+xml' }), name) }
export function downloadPng(svg: string, W: number, H: number, name = 'qr-code.png') {
  const img = new Image(), scale = 2048 / Math.max(W, H)
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale)
    const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0, c.width, c.height)
    c.toBlob((b) => b && save(b, name), 'image/png')
  }
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
