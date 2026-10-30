/* =========================================================
   FACTUUR ALS PDF (zonder extra pakket)
   Eenvoudige A4-pdf met de standaardletters Helvetica (WinAnsi: €, á, ñ, ü … werken). Spaans met Engels erbij.
   ========================================================= */
import type { InvoiceDoc } from './invoices';

const W = 595.28, H = 841.89, M = 50;

/** Tekst naar WinAnsi (cp1252) bytes; tekens die niet passen worden '?' */
const CP1252: Record<number, number> = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99,
  0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
function enc(s: string): string {
  let out = '';
  for (const ch of String(s).normalize('NFC')) {
    const c = ch.codePointAt(0) || 63;
    const b = c < 0x80 || (c >= 0xa0 && c <= 0xff) ? c : CP1252[c] || 63;
    const x = String.fromCharCode(b);
    out += x === '(' || x === ')' || x === '\\' ? '\\' + x : b < 0x20 ? ' ' : x;
  }
  return out;
}
/** Breedte van tekst (Helvetica, gemiddeld) om rechts uit te lijnen en af te breken */
const AVG: Record<string, number> = { F1: 0.5, F2: 0.53 };
const width = (s: string, size: number, f = 'F1') => String(s).length * size * AVG[f];

function wrap(s: string, size: number, max: number): string[] {
  const out: string[] = []; let line = '';
  for (const w of String(s).split(/\s+/).filter(Boolean)) {
    const next = line ? line + ' ' + w : w;
    if (width(next, size) > max && line) { out.push(line); line = w; } else line = next;
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

export function money(n: number, currency = 'EUR') {
  const v = Math.abs(n).toFixed(2).replace('.', ','), parts = v.split(',');
  const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + int + ',' + parts[1] + ' ' + (currency === 'EUR' ? '€' : currency);
}
const dateEs = (iso: string) => { const d = new Date(iso); return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' }).format(d); };

export function invoicePdf(d: InvoiceDoc): Buffer {
  const ops: string[] = [];
  const text = (x: number, y: number, s: string, size = 10, f = 'F1', gray = 0) => ops.push((gray ? gray + ' g ' : '0 g ') + 'BT /' + f + ' ' + size + ' Tf ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Td (' + enc(s) + ') Tj ET');
  const right = (x: number, y: number, s: string, size = 10, f = 'F1', gray = 0) => text(x - width(s, size, f), y, s, size, f, gray);
  const line = (x1: number, y1: number, x2: number, y2: number, gray = 0.8, w = 0.6) => ops.push(gray + ' G ' + w + ' w ' + x1 + ' ' + y1 + ' m ' + x2 + ' ' + y2 + ' l S');
  const box = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => ops.push(r + ' ' + g + ' ' + b + ' rg ' + x + ' ' + y + ' ' + w + ' ' + h + ' re f');

  // Kop: verkoper links, FACTURA rechts
  box(0, H - 8, W, 8, 0.082, 0.412, 0.941);
  let y = H - M - 10;
  text(M, y, d.seller.name, 16, 'F2');
  y -= 16; if (d.seller.taxId) { text(M, y, 'CIF/NIF: ' + d.seller.taxId, 9.5, 'F1', 0.25); y -= 13; }
  for (const a of d.seller.address) { text(M, y, a, 9.5, 'F1', 0.25); y -= 13; }
  right(W - M, H - M - 10, 'FACTURA / INVOICE', 16, 'F2');
  right(W - M, H - M - 30, 'Nº ' + d.number, 11, 'F2');
  right(W - M, H - M - 45, 'Fecha / Date: ' + dateEs(d.date), 9.5, 'F1', 0.25);
  right(W - M, H - M - 58, 'Serie / Series: ' + d.series, 9.5, 'F1', 0.25);

  // Klant
  y = Math.min(y, H - M - 80) - 22;
  text(M, y, 'CLIENTE / BILL TO', 8.5, 'F2', 0.35); y -= 15;
  text(M, y, d.buyer.name || '-', 11, 'F2'); y -= 14;
  if (d.buyer.taxId) { text(M, y, 'NIF/VAT: ' + d.buyer.taxId, 9.5); y -= 13; }
  for (const a of d.buyer.address) { text(M, y, a, 9.5); y -= 13; }
  text(M, y, d.buyer.country, 9.5); y -= 13;
  if (d.buyer.email) { text(M, y, d.buyer.email, 9.5, 'F1', 0.35); y -= 13; }

  // Regels
  y -= 18;
  const cQty = 310, cUnit = 380, cVat = 425, cNet = W - M;
  box(M, y - 6, W - 2 * M, 20, 0.94, 0.96, 0.99);
  text(M + 6, y, 'Descripción / Description', 8.5, 'F2', 0.2);
  right(cQty + 20, y, 'Cant.', 8.5, 'F2', 0.2); right(cUnit + 30, y, 'Precio', 8.5, 'F2', 0.2); right(cVat + 25, y, 'IVA', 8.5, 'F2', 0.2); right(cNet - 6, y, 'Importe / Amount', 8.5, 'F2', 0.2);
  y -= 22;
  for (const l of d.lines) {
    const rows = wrap(l.desc, 9.5, cQty - M - 30);
    rows.forEach((r, i) => text(M + 6, y - i * 12, r, 9.5));
    right(cQty + 20, y, String(l.qty), 9.5); right(cUnit + 30, y, money(l.unit, d.currency), 9.5);
    right(cVat + 25, y, (Math.round(l.taxRate * 10) / 10).toString().replace('.', ',') + '%', 9.5); right(cNet - 6, y, money(l.net, d.currency), 9.5);
    y -= rows.length * 12 + 8; line(M, y + 2, W - M, y + 2);
    y -= 8;
  }

  // Totalen
  y -= 6;
  const tl = W - M - 200;
  text(tl, y, 'Base imponible / Net', 9.5); right(W - M - 6, y, money(d.net, d.currency), 9.5); y -= 15;
  text(tl, y, 'IVA / VAT', 9.5); right(W - M - 6, y, money(d.tax, d.currency), 9.5); y -= 8;
  line(tl, y, W - M, y, 0.5, 0.8); y -= 16;
  text(tl, y, 'TOTAL', 12, 'F2'); right(W - M - 6, y, money(d.total, d.currency), 12, 'F2'); y -= 16;
  text(tl, y, 'Pagado / Paid', 9, 'F1', 0.35);

  // Vermelding per reeks
  if (d.note) {
    y -= 34;
    for (const r of wrap(d.note, 8.5, W - 2 * M)) { text(M, y, r, 8.5, 'F1', 0.25); y -= 11; }
  }
  // Voet
  line(M, 70, W - M, 70);
  text(M, 56, d.seller.name + (d.seller.taxId ? ' · CIF/NIF ' + d.seller.taxId : '') + ' · ' + d.seller.address.join(', '), 7.5, 'F1', 0.4);
  if (d.product) text(M, 45, 'Servicio: ' + d.product + ' · Ref. ' + d.stripeInvoice, 7.5, 'F1', 0.4);

  const content = ops.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Length ' + Buffer.byteLength(content, 'latin1') + ' >>\nstream\n' + content + '\nendstream',
    '<< /Title (' + enc('Factura ' + d.number) + ') /Producer (OptimaSys) >>',
  ];
  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(pdf, 'latin1')); pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info 7 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(pdf, 'latin1');
}
