import test from 'node:test';
import assert from 'node:assert/strict';
import {PDF_QUALITIES, pickQuality, lowerDpi, pdfRenderScale} from '../core.mjs';

test('pickQuality returns the best quality that fits, or -1', () => {
  assert.equal(pickQuality([900, 700, 500, 300], 1000), 0);
  assert.equal(pickQuality([900, 700, 500, 300], 600), 2);
  assert.equal(pickQuality([900, 700, 500, 300], 100), -1);
  assert.ok(PDF_QUALITIES.every((q, i) => i === 0 || q < PDF_QUALITIES[i - 1]));
});

test('lowerDpi always steps down and scales with the overshoot', () => {
  assert.equal(lowerDpi(150, 990, 1000), 127);
  assert.equal(lowerDpi(150, 250, 1000), 69);
  assert.ok(lowerDpi(100, 1, 1e6) < 1);
});

test('pdfRenderScale uses DPI and caps very large pages', () => {
  assert.equal(pdfRenderScale(612, 792, 144), 2);
  const scale = pdfRenderScale(14400, 14400, 300, 25e6);
  assert.ok(Math.abs(14400 * scale * 14400 * scale - 25e6) < 1);
});
