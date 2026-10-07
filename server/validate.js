/* Validatie: controleert wat de frontend stuurt, op basis van dezelfde QR-types (shared/qr-types.js).
   Zo bestaan de regels maar op één plek. */
const QR_TYPES = require('../shared/qr-types');

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_TEXT = 500;
const BACKGROUNDS = ['optimasys', 'aurora', 'city', 'mountains', 'office', 'cafe', 'restaurant', 'custom'];

function isUrl(v) { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch (e) { return false; } }

function validateQrCode(body) {
  const errors = [];
  const type = QR_TYPES.find((t) => t.id === (body && body.typeId));
  if (!type) return { errors: ['typeId: unknown QR type'] };

  const input = (body.content && typeof body.content === 'object') ? body.content : {};
  const content = {};
  for (const field of type.fields) {
    let v = input[field.key];
    if (v == null || String(v).trim() === '') continue;        // leeg = voorbeeldwaarde gebruiken
    v = String(v).trim();
    if (v.length > MAX_TEXT) errors.push(field.key + ': too long');
    if (field.type === 'url' && !isUrl(v)) errors.push(field.key + ': must be a http(s) URL');
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors.push(field.key + ': invalid email');
    if (field.type === 'number' && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 100)) errors.push(field.key + ': must be 0-100');
    if (field.type === 'select' && !field.options.some((o) => o.value === v)) errors.push(field.key + ': invalid option');
    content[field.key] = v;
  }
  for (const key of Object.keys(input)) if (!type.fields.some((f) => f.key === key)) errors.push(key + ': unknown field');

  const design = body.design || {};
  if (!HEX.test(design.color || '')) errors.push('design.color: must be #rrggbb');
  if (!HEX.test(design.background || '')) errors.push('design.background: must be #rrggbb');

  if (design.pageColor !== undefined && !HEX.test(design.pageColor)) errors.push('design.pageColor: must be #rrggbb');
  const cleanDesign = { color: design.color, background: design.background };
  if (design.pageColor) cleanDesign.pageColor = design.pageColor;
  return { errors, value: { typeId: type.id, contentType: type.contentType, content, design: cleanDesign } };
}

function validateMe(body) {
  const errors = [], value = {};
  if (body.background !== undefined) {
    if (!BACKGROUNDS.includes(body.background)) errors.push('background: unknown');
    else value.background = body.background;
  }
  if (body.customBackground !== undefined) {
    const v = body.customBackground;
    if (v !== null && !(typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length < 3000000)) errors.push('customBackground: must be a JPG/PNG/WebP data URL under 3 MB');
    else value.customBackground = v;
  }
  return { errors, value };
}

module.exports = { validateQrCode, validateMe, QR_TYPES };
