import QRCode from 'qrcode'

export type Shape = 'square' | 'dots' | 'rounded' | 'diamonds'
export const SHAPES: Shape[] = ['square', 'dots', 'rounded', 'diamonds']

export interface Matrix { size: number; dark: [number, number][]; finders: [number, number][] }

/** Echte, scanbare QR-code als lijst met donkere blokjes (de drie hoekogen apart, die tekenen we zelf) */
export function matrix(text: string, ecl: 'L' | 'M' | 'Q' | 'H' = 'M', hole = 0): Matrix {
  const q = QRCode.create(text || ' ', { errorCorrectionLevel: ecl })
  const size = q.modules.size, data = q.modules.data
  const finders: [number, number][] = [[0, 0], [size - 7, 0], [0, size - 7]]
  const inFinder = (x: number, y: number) => finders.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7)
  const c = size / 2, h = hole / 2
  const dark: [number, number][] = []
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!data[y * size + x] || inFinder(x, y)) continue
    if (hole && Math.abs(x + 0.5 - c) < h && Math.abs(y + 0.5 - c) < h) continue      // ruimte voor het logo
    dark.push([x, y])
  }
  return { size, dark, finders }
}

/** Zwart-wit-contrast (WCAG) tussen twee hex-kleuren */
export function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const n = hex.replace('#', ''), v = [0, 2, 4].map((i) => parseInt(n.length === 3 ? n[i / 2] + n[i / 2] : n.slice(i, i + 2), 16) / 255)
    const [r, g, bb] = v.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bb
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
