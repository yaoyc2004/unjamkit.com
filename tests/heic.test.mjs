import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sniffHeif, outputName, pdfPagePlan, zipStore, crc32} from '../heic-core.mjs';

const box = (brand, compat = []) => {
  const text = 'ftyp' + brand + '\0\0\0\0' + compat.join('');
  const bytes = new Uint8Array(4 + text.length);
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  for (let i = 0; i < text.length; i++) bytes[4 + i] = text.charCodeAt(i);
  return bytes;
};

test('HEIF brands are recognised from the ftyp box, other files are not', () => {
  assert.ok(sniffHeif(box('heic')));
  assert.ok(sniffHeif(box('mif1', ['heic'])));
  assert.ok(sniffHeif(box('isom', ['mif1'])));
  assert.ok(!sniffHeif(box('isom', ['mp41'])));
  assert.ok(!sniffHeif(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])));
  assert.ok(!sniffHeif(new Uint8Array(4)));
});

test('output names keep non-Latin characters and never collide', () => {
  const used = new Set();
  assert.equal(outputName('照片-旋转.HEIC', 'jpg', used), '照片-旋转.jpg');
  assert.equal(outputName('IMG_0001.heic', 'jpg', used), 'IMG_0001.jpg');
  assert.equal(outputName('img_0001.HEIF', 'jpg', used), 'img_0001-2.jpg');
  assert.equal(outputName('a/b:c.heic', 'jpg', used), 'a-b-c.jpg');
  assert.equal(outputName('.heic', 'pdf'), 'photo.pdf');
});

test('PDF pages match the photo or fit it on A4/Letter in the right orientation', () => {
  assert.deepEqual(pdfPagePlan(4000, 3000), {pageWidth: 3000, pageHeight: 2250, x: 0, y: 0, width: 3000, height: 2250});
  const huge = pdfPagePlan(40000, 1000);
  assert.ok(huge.pageWidth <= 14400);
  const a4 = pdfPagePlan(4000, 3000, 'a4');
  assert.ok(a4.pageWidth > a4.pageHeight, 'landscape photo gets a landscape page');
  assert.ok(Math.abs(a4.width / a4.height - 4 / 3) < 1e-9);
  assert.ok(a4.x >= 28 - 1e-9 && a4.y >= 28 - 1e-9);
  const letter = pdfPagePlan(3000, 4000, 'letter');
  assert.deepEqual([letter.pageWidth, letter.pageHeight], [612, 792]);
  assert.throws(() => pdfPagePlan(0, 10));
});

test('the stored ZIP has valid headers, CRCs and UTF-8 names', async () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const files = [{name: '照片.jpg', data: new Uint8Array([1, 2, 3])}, {name: 'b.jpg', data: new Uint8Array(1000).fill(7)}];
  const zip = new Uint8Array(await zipStore(files, new Date(2026, 9, 8)).arrayBuffer());
  const view = new DataView(zip.buffer);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  let at = view.getUint32(end + 16, true);
  for (const file of files) {
    assert.equal(view.getUint32(at, true), 0x02014b50);
    assert.equal(view.getUint16(at + 8, true) & 0x0800, 0x0800);
    const nameLength = view.getUint16(at + 28, true), local = view.getUint32(at + 42, true);
    assert.equal(new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength)), file.name);
    assert.equal(view.getUint32(at + 16, true), crc32(file.data));
    const dataAt = local + 30 + view.getUint16(local + 26, true);
    assert.deepEqual(zip.subarray(dataAt, dataAt + file.data.length), file.data);
    at += 46 + nameLength;
  }
});
