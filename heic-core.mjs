// Pure helpers for HEIC Convert: file checks, output names, PDF page layout and a stored ZIP writer.
export const LIMITS = {files: 50, bytes: 50 * 1024 * 1024, total: 400 * 1024 * 1024, pixels: 100000000};
const BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1', 'mif2']);

// HEIF files start with an ISO BMFF "ftyp" box; check its major and compatible brands.
export function sniffHeif(bytes) {
  if (!bytes || bytes.length < 12) return false;
  const text = (at) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  if (text(4) !== 'ftyp') return false;
  const size = Math.min(bytes.length, ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0 || bytes.length);
  if (BRANDS.has(text(8))) return true;
  for (let at = 16; at + 4 <= size; at += 4) if (BRANDS.has(text(at))) return true;
  return false;
}

export const looksLikeHeicName = (name) => /\.(heic|heif|hif)$/i.test(String(name));

// Keep the original name (including non-Latin characters), swap the extension and avoid duplicates.
export function outputName(name, ext, used = new Set()) {
  let base = String(name).replace(/\.[^./\\]+$/, '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/^[\s.]+|[\s.]+$/g, '') || 'photo';
  let candidate = base + '.' + ext, n = 2;
  while (used.has(candidate.toLowerCase())) candidate = base + '-' + n++ + '.' + ext;
  used.add(candidate.toLowerCase());
  return candidate;
}

const PAGE_SIZES = {a4: [595.28, 841.89], letter: [612, 792]};

// Returns the PDF page size and where the photo sits on it, in PDF points.
export function pdfPagePlan(width, height, size = 'photo', margin = 28) {
  if (!(width > 0 && height > 0)) throw new Error('Invalid image dimensions.');
  if (size === 'photo') {
    // 1 px = 0.75 pt (96 dpi); keep pages within PDF's 14,400 pt limit.
    const scale = Math.min(0.75, 14400 / width, 14400 / height);
    const w = width * scale, h = height * scale;
    return {pageWidth: w, pageHeight: h, x: 0, y: 0, width: w, height: h};
  }
  const base = PAGE_SIZES[size];
  if (!base) throw new Error('Unknown page size.');
  const [pageWidth, pageHeight] = width > height ? [base[1], base[0]] : base;
  const scale = Math.min((pageWidth - 2 * margin) / width, (pageHeight - 2 * margin) / height);
  const w = width * scale, h = height * scale;
  return {pageWidth, pageHeight, x: (pageWidth - w) / 2, y: (pageHeight - h) / 2, width: w, height: h};
}

const crcTable = Uint32Array.from({length: 256}, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Minimal ZIP writer using the "stored" method (JPEGs are already compressed). UTF-8 names.
export function zipStore(entries, date = new Date()) {
  const encoder = new TextEncoder();
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const locals = [], central = [];
  let offset = 0;
  for (const {name, data} of entries) {
    const nameBytes = encoder.encode(name), crc = crc32(data);
    const header = new Uint8Array(30 + nameBytes.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true); view.setUint16(10, time, true); view.setUint16(12, day, true);
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true); header.set(nameBytes, 30);
    const record = new Uint8Array(46 + nameBytes.length), cv = new DataView(record.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true); cv.setUint16(12, time, true); cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true); record.set(nameBytes, 46);
    locals.push(header, data); central.push(record);
    offset += header.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return new Blob([...locals, ...central, end], {type: 'application/zip'});
}
