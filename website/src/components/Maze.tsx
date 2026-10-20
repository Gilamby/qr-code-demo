'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './icons'

/* Spelletje "Vind de code": een doolhof dat eruitziet als een QR-code (muren = blokjes, met de drie hoekogen).
   Pijltjes / WASD, vegen of de knoppen. In het midden ligt de code. */
const C = 10                                   // cellen per zijde → raster 2C+1 = 21 blokjes (zoals een QR-code)
type Grid = boolean[][]                         // true = muur

function build(seed: number): Grid {
  const n = C * 2 + 1, g: Grid = Array.from({ length: n }, () => Array(n).fill(true))
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  // cellen onder de drie hoekogen doen niet mee (daar staan de "ogen" van de QR-code)
  const ok = (x: number, y: number) => !((x <= 3 && y <= 3) || (x >= 6 && y <= 3) || (x <= 3 && y >= 6))
  const stack: [number, number][] = [[4, 0]], seen = new Set(['4,0']); g[1][9] = false
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]
    const nb = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < C && y < C && ok(x, y) && !seen.has(x + ',' + y))
    if (!nb.length) { stack.pop(); continue }
    const [x, y, dx, dy] = nb[Math.floor(rnd() * nb.length)]
    g[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = false; g[y * 2 + 1][x * 2 + 1] = false
    seen.add(x + ',' + y); stack.push([x, y])
  }
  return g
}
const FINDERS = [[0, 0], [0, 14], [14, 0]]
const inFinder = (x: number, y: number) => FINDERS.some(([fx, fy]) => x >= fx && y >= fy && x < fx + 7 && y < fy + 7)

export default function Maze({ title, text, cta, again, note, labels, signup }: { title: string; text: string; cta: string; again: string; note: string; labels: Record<string, string>; signup: string }) {
  const [seed, setSeed] = useState(7)
  const [grid, setGrid] = useState<Grid>(() => build(7))
  const [pos, setPos] = useState<[number, number]>([9, 1])
  const [moves, setMoves] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const goal: [number, number] = [C + 1, C + 1]                       // het midden
  const won = pos[0] === goal[0] && pos[1] === goal[1]

  const step = useCallback((dx: number, dy: number) => {
    if (won) return
    const nx = pos[0] + dx, ny = pos[1] + dy
    if (!grid[ny] || grid[ny][nx] !== false) return
    setPos([nx, ny]); setMoves((m) => m + 1)
  }, [grid, won, pos])

  useEffect(() => {
    const el = box.current!
    const key = (e: KeyboardEvent) => {
      const d: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }
      const v = d[e.key]; if (v) { e.preventDefault(); step(v[0], v[1]) }
    }
    let sx = 0, sy = 0
    const ts = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY }
    const te = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
      if (Math.abs(dx) > Math.abs(dy)) step(Math.sign(dx), 0); else step(0, Math.sign(dy))
    }
    el.addEventListener('keydown', key); el.addEventListener('touchstart', ts, { passive: true }); el.addEventListener('touchend', te)
    return () => { el.removeEventListener('keydown', key); el.removeEventListener('touchstart', ts); el.removeEventListener('touchend', te) }
  }, [step])

  const reset = () => { const s = seed * 31 % 9973 + 3; setSeed(s); setGrid(build(s)); setPos([9, 1]); setMoves(0) }
  const n = C * 2 + 1
  return (
    <div className="maze-wrap">
      <div className="maze-copy">
        <h2 className="h2">{title}</h2>
        <p className="lead">{text}</p>
        <p className="mono maze-moves">{moves} {labels.moves}</p>
        {won && <div className="maze-won" role="status"><b>{labels.done}</b><p>{note}</p><a className="btn btn-primary" href={signup}>{cta} <Icon name="arrow" size={18} /></a></div>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>{again}</button>
      </div>
      <div className="maze-board" ref={box} tabIndex={0} role="application" aria-label={title + '. ' + text}>
        <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} aria-hidden="true">
          <rect x="-1" y="-1" width={n + 2} height={n + 2} rx="1" fill="#f6f4ee" />
          {grid.map((row, y) => row.map((wall, x) => wall && !inFinder(x, y) ? <rect key={x + '-' + y} x={x + 0.06} y={y + 0.06} width="0.88" height="0.88" rx="0.2" fill="#14161c" /> : null))}
          {FINDERS.map(([fx, fy]) => <g key={fx + '-' + fy}><rect x={fx + 0.5} y={fy + 0.5} width="6" height="6" rx="1.4" fill="none" stroke="#14161c" strokeWidth="1" /><rect x={fx + 2} y={fy + 2} width="3" height="3" rx="0.8" fill="#14161c" /></g>)}
          <g className="maze-goal" transform={`translate(${goal[0]} ${goal[1]})`}><rect x="0.1" y="0.1" width="0.8" height="0.8" rx="0.15" fill="#f97316" /><path d="M0.3 0.3h.15v.15h-.15zM0.55 0.55h.15v.15h-.15z" fill="#fff" /></g>
          <circle className="maze-me" cx={pos[0] + 0.5} cy={pos[1] + 0.5} r="0.36" fill="#2563eb" />
        </svg>
        <div className="maze-pad" aria-label="Controls">
          <button type="button" aria-label="Up" onClick={() => step(0, -1)}>↑</button>
          <button type="button" aria-label="Left" onClick={() => step(-1, 0)}>←</button>
          <button type="button" aria-label="Down" onClick={() => step(0, 1)}>↓</button>
          <button type="button" aria-label="Right" onClick={() => step(1, 0)}>→</button>
        </div>
      </div>
    </div>
  )
}
