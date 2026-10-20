'use client'
import { useId, useMemo } from 'react'
import { matrix, type Shape } from '@/lib/qr'

type Props = {
  text: string
  shape?: Shape
  fg?: string | [string, string]   // één kleur of een verloop
  bg?: string
  logo?: boolean
  fly?: boolean                    // blokjes vliegen binnen
  wave?: boolean                   // vormwissel als een golf over de code
  className?: string
  label?: string
}

/** De logo-vorm van Optimasys (zelfde als de favicon van de app) */
export function LogoMark({ size = 32, id = 'lg' }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs><linearGradient id={id} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#2563eb" /></linearGradient></defs>
      <g fill="none" stroke={`url(#${id})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 22v-7a7 7 0 0 1 7-7h7M42 8h7a7 7 0 0 1 7 7v7M56 42v7a7 7 0 0 1-7 7h-7M22 56h-7a7 7 0 0 1-7-7v-7" />
        <rect x="22.5" y="22.5" width="19" height="19" rx="5" strokeWidth="5" transform="rotate(45 32 32)" />
      </g>
      <rect x="28.5" y="28.5" width="7" height="7" rx="1.8" fill={`url(#${id})`} transform="rotate(45 32 32)" />
    </svg>
  )
}

/* Vaste pseudo-willekeur, zodat server en browser dezelfde startposities hebben */
const rnd = (i: number) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x) }

export default function QR({ text, shape = 'rounded', fg = '#0b0e13', bg = '#ffffff', logo, fly, wave = true, className, label }: Props) {
  const uid = useId().replace(/:/g, '')
  const hole = logo ? 7 : 0
  const m = useMemo(() => matrix(text, logo ? 'H' : 'M', hole), [text, logo, hole])
  const q = 2, vb = m.size + q * 2
  const fill = Array.isArray(fg) ? `url(#g${uid})` : fg
  return (
    <svg className={'qr ' + (fly ? 'qr-fly ' : '') + (wave ? 'qr-wave ' : '') + (className || '')} data-shape={shape}
      viewBox={`${-q} ${-q} ${vb} ${vb}`} role="img" aria-label={label || text} shapeRendering="geometricPrecision">
      {Array.isArray(fg) && (
        <defs><linearGradient id={'g' + uid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={fg[0]} /><stop offset="1" stopColor={fg[1]} /></linearGradient></defs>
      )}
      <rect className="qr-bg" x={-q} y={-q} width={vb} height={vb} fill={bg} />
      <g fill={fill}>
        {m.dark.map(([x, y], i) => (
          <rect key={x + '-' + y} className="m" x={x} y={y} width="1" height="1"
            style={{ ['--d' as any]: (x + y) * 14, ['--fx' as any]: ((rnd(i) - 0.5) * 60).toFixed(1) + 'px', ['--fy' as any]: ((rnd(i + 99) - 0.5) * 60).toFixed(1) + 'px' }} />
        ))}
      </g>
      {m.finders.map(([x, y]) => (
        <g key={x + '-' + y} className="finder">
          <rect className="fo" x={x + 0.5} y={y + 0.5} width="6" height="6" fill="none" stroke={fill} strokeWidth="1" />
          <rect className="fi" x={x + 2} y={y + 2} width="3" height="3" fill={fill} />
        </g>
      ))}
      {logo && (
        <g transform={`translate(${m.size / 2 - 3} ${m.size / 2 - 3})`}>
          <rect width="6" height="6" rx="1.6" fill={bg} />
          <svg x="0.6" y="0.6" width="4.8" height="4.8" viewBox="0 0 64 64">
            <g fill="none" stroke={fill} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 22v-7a7 7 0 0 1 7-7h7M42 8h7a7 7 0 0 1 7 7v7M56 42v7a7 7 0 0 1-7 7h-7M22 56h-7a7 7 0 0 1-7-7v-7" />
              <rect x="22.5" y="22.5" width="19" height="19" rx="5" strokeWidth="5" transform="rotate(45 32 32)" />
            </g>
          </svg>
        </g>
      )}
    </svg>
  )
}
