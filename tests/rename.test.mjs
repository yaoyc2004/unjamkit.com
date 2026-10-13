import test from 'node:test';
import assert from 'node:assert/strict';
import {splitName, orderFiles, ruleNames, parseTable, listNames, checkName, buildPlan, mappingCsv, listName, zipStoreEntries, crc32, findPattern, cleanRules, templatesJson, parseTemplates, isRenameList, swapColumns, unquoteFormula, toTsv} from '../rename-core.mjs';

const f = (name, lastModified = 0, size = 10) => ({name, lastModified, size});

test('extensions are split at the last dot; dot files and bare names have none', () => {
  assert.deepEqual(splitName('report.final.PDF'), {stem: 'report.final', ext: '.PDF'});
  assert.deepEqual(splitName('.env'), {stem: '.env', ext: ''});
  assert.deepEqual(splitName('README'), {stem: 'README', ext: ''});
  assert.deepEqual(splitName('trailing.'), {stem: 'trailing.', ext: ''});
});

test('name order puts 2 before 10; date order uses last modified', () => {
  const files = [f('scan10.pdf', 3), f('scan2.pdf', 1), f('Scan1.pdf', 2)];
  assert.deepEqual(orderFiles(files, 'name'), [2, 1, 0]);
  assert.deepEqual(orderFiles(files, 'date'), [1, 2, 0]);
  assert.deepEqual(orderFiles(files, 'added'), [0, 1, 2]);
});

test('rules add prefix, replace text and number with leading zeros, keeping the extension', () => {
  const files = [f('scan17.pdf'), f('scan3.PDF'), f('照片 旧.jpg')];
  const names = ruleNames(files, {base: 'keep', find: 'scan', replace: '扫描', prefix: '客户A_', number: 'after', start: 1, digits: 3, sep: '_'}, [1, 0, 2]);
  assert.deepEqual(names, ['客户A_扫描17_002.pdf', '客户A_扫描3_001.PDF', '客户A_照片 旧_003.jpg']);
  assert.deepEqual(ruleNames([f('a.JPG')], {base: 'text', text: 'Quote', number: 'before', start: 9, digits: 2, sep: '-', extCase: 'lower'}), ['09-Quote.jpg']);
  assert.deepEqual(ruleNames([f('a.pdf'), f('b.pdf')], {base: 'text', text: '', number: 'after', start: 1, digits: 3, sep: '_'}), ['001.pdf', '002.pdf']);
  assert.deepEqual(ruleNames([f('IMG_A.jpg')], {base: 'keep', find: 'img', replace: 'cam1', matchCase: false}), ['cam1_A.jpg']);
  assert.deepEqual(ruleNames([f('IMG_A.jpg')], {base: 'keep', find: 'img', replace: 'cam1', matchCase: true}), ['IMG_A.jpg']);
  assert.deepEqual(ruleNames([f('a$b.txt')], {base: 'keep', find: '$', replace: '$&'}), ['a$&b.txt']);
});

test('the table parser handles Excel paste, quotes, semicolons and a BOM', () => {
  assert.deepEqual(parseTable('old\tnew\r\nscan17.pdf\t客户A_报价\r\n\r\n'), [['old', 'new'], ['scan17.pdf', '客户A_报价']]);
  assert.deepEqual(parseTable('﻿a.pdf,"Smith, J ""final"".pdf"\nb.pdf,"two\nlines"'), [['a.pdf', 'Smith, J "final".pdf'], ['b.pdf', 'two\nlines']]);
  assert.deepEqual(parseTable('a.pdf;b.pdf\nc.pdf;d.pdf'), [['a.pdf', 'b.pdf'], ['c.pdf', 'd.pdf']]);
});

test('list mode matches full names or names without the extension and skips a header row', () => {
  const files = [f('scan17.pdf'), f('10234.JPG'), f('extra.docx')];
  const rows = [['Old name', 'New name'], ['SCAN17.pdf', '客户A_报价_2026-10'], ['10234', 'S-000123.jpg'], ['missing.pdf', 'x']];
  const out = listNames(files, rows);
  assert.equal(out.headerSkipped, true);
  assert.deepEqual(out.names, ['客户A_报价_2026-10.pdf', 'S-000123.jpg', undefined]);
  assert.deepEqual(out.unused, ['missing.pdf']);
  assert.match(out.notes[2], /No row/);
  assert.deepEqual(listNames(files, rows, 'keep').names[2], 'extra.docx');
  assert.equal(listNames(files, rows, 'skip').names[2], null);
});

test('list mode flags files it cannot tell apart and repeated rows', () => {
  const files = [f('IMG_0001.jpg'), f('IMG_0001.jpg'), f('a.pdf')];
  const out = listNames(files, [['IMG_0001.jpg', 'x'], ['a.pdf', 'b'], ['a.pdf', 'c']]);
  assert.match(out.notes[0], /cannot tell/);
  assert.match(out.notes[1], /cannot tell/);
  assert.match(out.notes[2], /more than one row/);
});

test('name checks catch folders, Windows characters, reserved names and trailing dots', () => {
  assert.equal(checkName('客户A_报价_2026-10.pdf'), '');
  assert.match(checkName('2026/10.pdf'), /folder/);
  assert.match(checkName('a:b.pdf'), /“:”/);
  assert.match(checkName('CON.txt'), /reserves/);
  assert.match(checkName('com1.tar.gz'), /reserves/);
  assert.match(checkName('name.'), /ends with/);
  assert.match(checkName(' name.pdf'), /starts with/);
  assert.match(checkName(''), /empty/);
  assert.match(checkName('a\u0007.pdf'), /control/);
  assert.match(checkName('x'.repeat(241)), /longer/);
  assert.equal(checkName('console.pdf'), '');
});

test('duplicates are found ignoring case and Unicode normalization; skipped files are left out', () => {
  const files = [f('a.pdf'), f('b.pdf'), f('c.pdf'), f('d.pdf')];
  const plan = buildPlan(files, ['Quote.pdf', 'quote.PDF', 'café.pdf'.normalize('NFC'), null]);
  assert.equal(plan.problems, 2);
  assert.equal(plan.ready, false);
  assert.equal(plan.rows[3].skipped, true);
  const nfd = buildPlan([f('x.pdf'), f('y.pdf')], ['café.pdf'.normalize('NFC'), 'café.pdf'.normalize('NFD').normalize('NFC')]);
  assert.equal(nfd.problems, 2);
  const ok = buildPlan(files, ['1.pdf', '2.pdf', 'c.pdf', null]);
  assert.equal(ok.ready, true);
  assert.equal(ok.included.length, 3);
  assert.equal(ok.changed, 2);
});

test('the mapping CSV is Excel-friendly and defuses formulas', () => {
  const csv = mappingCsv([{from: 'scan17.pdf', to: '客户A, 报价.pdf', size: 12}, {from: '=cmd.pdf', to: '@x.pdf', size: 1}]);
  assert.ok(csv.startsWith('﻿Original name,New name,Size (bytes)\r\n'));
  assert.ok(csv.includes('scan17.pdf,"客户A, 报价.pdf",12'));
  assert.ok(csv.includes("'=cmd.pdf,'@x.pdf,1"));
  assert.equal(listName(['a.pdf']), 'rename-list.csv');
  assert.equal(listName(['Rename-List.csv', 'rename-list-2.csv']), 'rename-list-3.csv');
});

test('the ZIP holds the original bytes under the new UTF-8 names', async () => {
  const one = new TextEncoder().encode('%PDF-1.7 hello'), two = new Uint8Array([0, 255, 1, 254]);
  const blob = zipStoreEntries([
    {name: '客户A_报价_001.pdf', data: new Blob([one]), crc: crc32(one), size: one.length, date: new Date(2026, 9, 13, 9, 30, 0)},
    {name: 'b.bin', data: two, crc: crc32(two), size: two.length},
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer);
  const eocd = bytes.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50);
  assert.equal(view.getUint16(eocd + 10, true), 2);
  let p = view.getUint32(eocd + 16, true);
  const found = [];
  for (let i = 0; i < 2; i++) {
    const nameLength = view.getUint16(p + 28, true), offset = view.getUint32(p + 42, true), size = view.getUint32(p + 24, true);
    assert.equal(view.getUint16(p + 8, true) & 0x0800, 0x0800);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLength));
    const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const data = bytes.subarray(start, start + size);
    assert.equal(crc32(data), view.getUint32(p + 16, true));
    found.push([name, [...data]]);
    p += 46 + nameLength;
  }
  assert.deepEqual(found, [['客户A_报价_001.pdf', [...one]], ['b.bin', [...two]]]);
});

test('rules remove characters, change case and fill {name}, {date} and {modified}', () => {
  const today = new Date(2026, 9, 13), file = {name: 'IMG_0042 site PHOTO.jpg', lastModified: new Date(2026, 0, 5, 12).getTime()};
  assert.deepEqual(ruleNames([file], {base: 'keep', removeFirst: 4, caseMode: 'title'}, [0], today), ['0042 Site Photo.jpg']);
  assert.deepEqual(ruleNames([file], {base: 'keep', removeLast: 6, caseMode: 'lower'}, [0], today), ['img_0042 site.jpg']);
  assert.deepEqual(ruleNames([file], {base: 'text', text: 'Site_{modified}', prefix: '{date}_'}, [0], today), ['2026-10-13_Site_2026-01-05.jpg']);
  assert.deepEqual(ruleNames([file], {base: 'text', text: '{NAME}-copy', caseMode: 'upper'}, [0], today), ['IMG_0042 SITE PHOTO-COPY.jpg']);
  assert.deepEqual(ruleNames([file], {base: 'keep', removeFirst: 99}, [0], today), ['.jpg']);
  assert.deepEqual(ruleNames([{name: '报价单_v2.pdf'}], {base: 'keep', removeFirst: 2}, [0], today), ['单_v2.pdf']);
});

test('regular expressions can capture and reorder; invalid ones throw a readable error', () => {
  assert.deepEqual(ruleNames([{name: '2026-10-13_quote.pdf'}], {base: 'keep', find: '^(\\d{4})-(\\d{2})-(\\d{2})_(.+)$', replace: '$4_$3.$2.$1', regex: true}), ['quote_13.10.2026.pdf']);
  assert.deepEqual(ruleNames([{name: 'a.b.c.txt'}], {base: 'keep', find: '.', replace: '-'}), ['a-b-c.txt']);
  assert.throws(() => findPattern('(', {regex: true}), /not valid/);
  assert.equal(findPattern(''), null);
});

test('templates round-trip and drop unknown or unsafe values', () => {
  const json = templatesJson([{name: 'Quotes', rules: {prefix: 'Q_', number: 'after', digits: 3, regex: true, evil: '<script>', caseMode: 'shout', start: '5'}}]);
  const [t] = parseTemplates(json);
  assert.equal(t.name, 'Quotes');
  assert.deepEqual(t.rules, {regex: true, prefix: 'Q_', number: 'after', start: 5, digits: 3});
  assert.throws(() => parseTemplates('{"templates": []}'), /not a Batch Rename template/);
  assert.throws(() => parseTemplates('nope'), /not a Batch Rename template/);
  assert.deepEqual(cleanRules(null), {});
});

test('a rename list from this tool can be swapped back to undo', () => {
  const rows = parseTable(mappingCsv([{from: 'scan17.pdf', to: 'Client A.pdf', size: 3}, {from: '=x.pdf', to: 'b.pdf', size: 1}]));
  assert.ok(isRenameList(rows));
  const swapped = swapColumns(rows.slice(1)).map((r) => r.map(unquoteFormula));
  assert.deepEqual(swapped, [['Client A.pdf', 'scan17.pdf', '3'], ['b.pdf', '=x.pdf', '1']]);
  const out = listNames([{name: 'Client A.pdf'}, {name: 'b.pdf'}], swapped);
  assert.deepEqual(out.names, ['scan17.pdf', '=x.pdf']);
  assert.ok(!isRenameList([['old', 'new']]));
  assert.equal(toTsv([['a\tb', 'c'], ['00123', null]]), 'a b\tc\n00123\t');
});
