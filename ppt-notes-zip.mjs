// Minimal read-only ZIP reader for PPTX XML parts. No network or persistent storage.
const decoder = new TextDecoder('utf-8', {fatal: true});
const u16 = (view, at) => view.getUint16(at, true);
const u32 = (view, at) => view.getUint32(at, true);
const MAX_XML = 4 * 1024 * 1024;
const crcTable = Uint32Array.from({length:256}, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export async function openPptx(file) {
  if (!file || !/\.pptx$/i.test(file.name)) throw new Error('Choose a .pptx file.');
  if (file.size > 30 * 1024 * 1024) throw new Error('Each PPTX must be 30 MB or smaller.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const start = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let p = bytes.length - 22; p >= start; p--) {
    if (u32(view, p) === 0x06054b50 && p + 22 + u16(view, p + 20) === bytes.length) { eocd = p; break; }
  }
  if (eocd < 0) throw new Error('This file is not a supported PPTX ZIP archive.');
  const count = u16(view, eocd + 10);
  if (count > 10000) throw new Error('This PPTX has too many ZIP entries.');
  if (u16(view, eocd + 8) !== count || u32(view, eocd + 12) === 0xffffffff) throw new Error('Split or ZIP64 PPTX archives are not supported.');
  let p = u32(view, eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || u32(view, p) !== 0x02014b50) throw new Error('The PPTX ZIP directory is damaged.');
    const flags = u16(view, p + 8), method = u16(view, p + 10);
    const crc = u32(view, p + 16), compressed = u32(view, p + 20), plain = u32(view, p + 24);
    const nameLength = u16(view, p + 28), extraLength = u16(view, p + 30), commentLength = u16(view, p + 32);
    const offset = u32(view, p + 42);
    if (p + 46 + nameLength + extraLength + commentLength > bytes.length) throw new Error('The PPTX ZIP directory is damaged.');
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    if (flags & 1) throw new Error('Password-protected PPTX files are not supported.');
    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      if (plain > MAX_XML) throw new Error('A PPTX XML part is too large to process safely.');
      if (entries.has(name)) throw new Error('Duplicate PPTX ZIP path.');
      entries.set(name, {offset, compressed, plain, method, crc});
    }
    p += 46 + nameLength + extraLength + commentLength;
  }
  async function read(name) {
    const entry = entries.get(name);
    if (!entry) return null;
    let at = entry.offset;
    if (at + 30 > bytes.length || u32(view, at) !== 0x04034b50) throw new Error('The PPTX ZIP entry is damaged.');
    at += 30 + u16(view, at + 26) + u16(view, at + 28);
    if (at + entry.compressed > bytes.length) throw new Error('The PPTX ZIP entry is truncated.');
    const packed = bytes.subarray(at, at + entry.compressed);
    let out;
    if (entry.method === 0) out = packed;
    else if (entry.method === 8) {
      if (!globalThis.DecompressionStream) throw new Error('This browser cannot unpack PPTX files. Try a current browser with raw ZIP deflate support.');
      try {
        const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const reader = stream.getReader(), chunks = [];
        let size = 0;
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_XML || size > entry.plain) {await reader.cancel(); throw new Error('A PPTX XML part exceeds its declared size.');}
          chunks.push(value);
        }
        out = new Uint8Array(size);
        let cursor = 0;
        for (const chunk of chunks) {out.set(chunk, cursor); cursor += chunk.length;}
      } catch { throw new Error('Could not unpack a PPTX XML part.'); }
    } else throw new Error('This PPTX uses unsupported ZIP compression.');
    if (out.length !== entry.plain || out.length > MAX_XML || crc32(out) !== entry.crc) throw new Error('A PPTX XML part failed its integrity check.');
    return decoder.decode(out);
  }
  return {read};
}
