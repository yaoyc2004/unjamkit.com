import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync, writeFileSync} from 'node:fs';
import {decodeCsv, parseCsv, summarize, exportWorkbook, SAMPLE} from '../csv-core.mjs';
import * as XLSX from '../vendor/xlsx-0.20.3.mjs';
const require = createRequire(import.meta.url);
const Papa = require('../vendor/papaparse-5.5.3.min.js');
const parse = (text, delimiter = '') => parseCsv(text, delimiter, Papa);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
test('UTF-8 BOM and invalid byte sequences', () => {
  assert.equal(decodeCsv(new Uint8Array([239,187,191,65]).buffer), 'A');
  assert.throws(() => decodeCsv(new Uint8Array([0xff,0xfe,65,0]).buffer), /UTF-8/);
});
test('sample fields stay strings; quoted commas, quotes and multiline fields', () => {
  const {rows} = parse(SAMPLE);
  assert.equal(rows.length, 4); assert.equal(rows[1][0], '00123');
  assert.equal(rows[1][1], '123456789012345678'); assert.equal(rows[1][3], 'Adapter, small');
  assert.equal(rows[2][3], 'Cable "Pro"'); assert.equal(rows[3][3], 'Two-line description\nkept in one cell');
  assert(rows.flat().every(v => typeof v === 'string'));
});
test('all supported separators and BOM', () => {
  for (const separator of [',',';','\t','|']) {
    const data = parse('\uFEFFid' + separator + 'value\r\n001' + separator + '你好\r\n');
    assert.equal(data.delimiter, separator); assert.deepEqual(data.rows[1], ['001', '你好']);
  }
});
test('single column, no header, duplicate headers, spaces and empty fields', () => {
  assert.deepEqual(parse('001\n002\n').rows, [['001'], ['002']]);
  const data = parse('id,id,\n 001 ,002,\n,,\n\n');
  assert.deepEqual(data.rows, [['id','id',''],[' 001 ','002',''],['','',''],['','','']]);
  assert.equal(summarize(data, false).records, 4);
  assert.equal(summarize(data, true).records, 3);
});
test('invalid CSV and empty input rejected', () => {
  for (const bad of ['', '\n', 'a,b\n1,2,3', 'a,b\n"oops,2', 'a,b\n"a"x,2']) assert.throws(() => parse(bad));
  assert.throws(() => parse('a\n\u0000'), /control character/);
  assert.throws(() => parse('id\n_x005F_x0041_'), /Excel escape/);
  assert.throws(() => parse('id\n_x005F_'), /Excel escape/);
});
test('size, dimensions and Excel character limits are enforced', () => {
  assert.throws(() => parse('x'.repeat(32768)), /32,767/);
  assert.throws(() => parse(Array(257).fill('x').join(',')), /limits/);
  assert.throws(() => parse(('x,'.repeat(100) + 'x\n').repeat(2500)), /limit/);
  assert.throws(() => parse('x\n'.repeat(50002)), /limit/);
  const max = parse('x\n'.repeat(50001)); assert.throws(() => summarize(max, false), /50,000/);
});
test('risk counts are about field shapes; all columns remain text', () => {
  const summary = summarize(parse(SAMPLE), true);
  assert.equal(summary.counts.leading, 3); assert.equal(summary.counts.long, 3);
  assert.equal(summary.counts.formula, 1); assert.equal(summary.counts.exponent, 1); assert.equal(summary.counts.date, 1);
});
mkdirSync(new URL('../work/csv-validation/', import.meta.url), {recursive: true});
test('XLSX roundtrip: literal formula, Unicode, whitespace, blank rows, CRLF and XML escapes', () => {
  const rows = [
    ['id','id','value'], ['00123','123456789012345678','1E10'], ['=1+1','@SUM(A1)','+123'],
    ['  padded  ','你好 😀','line1\r\nline2'], ['', '', ''],
    ['_x0041_', '<script>alert(1)</script>', '="001"'], ['\tindent','03-04','19.90'],
    ['_X0041_', 'literal_text', '_x000D_'], ['a&b', 'quote "', 'x'.repeat(32767)]
  ];
  const csv = Papa.unparse(rows, {newline: '\r\n'});
  const parsed = parse(csv);
  assert.deepEqual(parsed.rows, rows);
  const {bytes} = exportWorkbook(parsed, {header: true, notes: true}, XLSX);
  writeFileSync(new URL('../work/csv-validation/edge-cases.xlsx', import.meta.url), new Uint8Array(bytes));
  writeFileSync(new URL('../work/csv-validation/expected.json', import.meta.url), JSON.stringify(rows));
  assert.deepEqual(XLSX.read(bytes, {type:'array'}).SheetNames, ['Data', 'Conversion notes']);
});
test('no-header export adds no invented row and can omit notes', () => {
  const parsed = parse('00123\n00000');
  const {bytes} = exportWorkbook(parsed, {header:false, notes:false}, XLSX);
  const wb = XLSX.read(bytes, {type:'array'});
  assert.deepEqual(wb.SheetNames, ['Data']); assert.equal(wb.Sheets.Data.A1.v, '00123');
  assert.equal(wb.Sheets.Data['!ref'], 'A1:A2');
});
test('header-only CSV cannot create a misleading empty workbook', () => {
  assert.throws(() => exportWorkbook(parse('a,b'), {header:true,notes:false}, XLSX), /no data records/);
});
console.log(passed + ' tests passed.');
