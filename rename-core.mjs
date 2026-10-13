// Pure helpers for Batch Rename: naming rules, a two-column list parser, name checks, the mapping CSV and a stored ZIP writer.
import {crc32} from './heic-core.mjs';

export const LIMITS = {files: 200, total: 400 * 1024 * 1024, nameLength: 240};
export const LIST_NAME = 'rename-list.csv';

const nfc = (text) => String(text).normalize('NFC');
const key = (name) => nfc(name).toLowerCase();

// "report.final.pdf" -> {stem: "report.final", ext: ".pdf"}; ".env" and "README" have no extension.
export function splitName(name) {
  const at = name.lastIndexOf('.');
  return at > 0 && at < name.length - 1 ? {stem: name.slice(0, at), ext: name.slice(at)} : {stem: name, ext: ''};
}

const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
export const naturalCompare = (a, b) => collator.compare(a, b);

// Order the files for numbering: as added, by name (2 before 10) or by modified date.
export function orderFiles(files, order = 'added') {
  const list = files.map((file, index) => ({file, index}));
  if (order === 'name') list.sort((a, b) => naturalCompare(a.file.name, b.file.name) || a.index - b.index);
  else if (order === 'date') list.sort((a, b) => (a.file.lastModified || 0) - (b.file.lastModified || 0) || a.index - b.index);
  return list.map((item) => item.index);
}

function replaceAll(text, find, replacement, matchCase) {
  if (!find) return text;
  if (matchCase) return text.split(find).join(replacement);
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), () => replacement);
}

// Rules mode. Rules change the name before the extension; the extension is kept.
// rules: {base: 'keep'|'text', text, find, replace, matchCase, prefix, suffix, number: 'none'|'before'|'after', start, digits, sep, extCase: 'keep'|'lower'}
export function ruleNames(files, rules, order = files.map((_, i) => i)) {
  const names = new Array(files.length);
  const start = Number.isFinite(Number(rules.start)) ? Math.trunc(Number(rules.start)) : 1;
  const digits = Math.min(6, Math.max(1, Math.trunc(Number(rules.digits)) || 1));
  order.forEach((fileIndex, position) => {
    const {stem, ext} = splitName(nfc(files[fileIndex].name));
    let name = rules.base === 'text' ? nfc(rules.text || '') : stem;
    name = replaceAll(name, nfc(rules.find || ''), nfc(rules.replace || ''), !!rules.matchCase);
    name = nfc(rules.prefix || '') + name + nfc(rules.suffix || '');
    if (rules.number === 'before' || rules.number === 'after') {
      const n = start + position;
      const number = (n < 0 ? '-' : '') + String(Math.abs(n)).padStart(digits, '0');
      const sep = name ? nfc(rules.sep ?? '') : '';
      name = rules.number === 'before' ? number + sep + name : name + sep + number;
    }
    names[fileIndex] = name + (rules.extCase === 'lower' ? ext.toLowerCase() : ext);
  });
  return names;
}

// Parse pasted or loaded CSV/TSV text (Excel copy-paste is tab-separated). Quoted fields may contain the delimiter, quotes and line breaks.
export function parseTable(text) {
  text = String(text).replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const count = (ch) => firstLine.split(ch).length - 1;
  const delimiter = text.includes('\t') ? '\t' : count(';') > count(',') ? ';' : ',';
  const rows = [];
  let row = [], field = '', quoted = false, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { quoted = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"' && field.trim() === '') { quoted = true; field = ''; i++; continue; }
    if (ch === delimiter) { row.push(field); field = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1; continue;
    }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.map((cells) => cells.map((cell) => cell.trim())).filter((cells) => cells.some((cell) => cell !== ''));
}

// List mode. Column 1 is the current file name (with or without its extension), column 2 the new name.
// unmapped: 'stop' (a missing row is a problem), 'keep' (keep the original name) or 'skip' (leave the file out).
export function listNames(files, rows, unmapped = 'stop') {
  const byName = new Map(), byStem = new Map();
  files.forEach((file, index) => {
    const name = key(file.name), stem = key(splitName(nfc(file.name)).stem);
    byName.set(name, [...(byName.get(name) || []), index]);
    byStem.set(stem, [...(byStem.get(stem) || []), index]);
  });
  const lookup = (cell) => byName.get(key(cell)) || byStem.get(key(cell)) || [];
  let headerSkipped = false;
  if (rows.length > 1 && !lookup(rows[0][0] || '').length && rows.slice(1).some((r) => lookup(r[0] || '').length)) { rows = rows.slice(1); headerSkipped = true; }
  const names = new Array(files.length).fill(undefined), notes = files.map(() => ''), unused = [];
  for (const [index, cells] of rows.entries()) {
    const [from = '', to = ''] = cells;
    const hits = lookup(from);
    if (!hits.length) { unused.push(from || '(empty row ' + (index + 1) + ')'); continue; }
    if (hits.length > 1) { for (const i of hits) notes[i] = 'Several chosen files match “' + from + '”, so the list cannot tell them apart.'; continue; }
    const i = hits[0];
    if (names[i] !== undefined) { notes[i] = 'The list has more than one row for this file.'; continue; }
    const {ext} = splitName(nfc(files[i].name));
    let name = nfc(to);
    if (name && ext && !name.toLowerCase().endsWith(ext.toLowerCase())) name += ext;
    names[i] = name;
  }
  files.forEach((file, i) => {
    if (names[i] !== undefined || notes[i]) return;
    if (unmapped === 'keep') names[i] = nfc(file.name);
    else if (unmapped === 'skip') names[i] = null;
    else notes[i] = 'No row in the list for this file.';
  });
  return {names, notes, unused, headerSkipped};
}

const RESERVED = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/i;
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f\u007f]/;

// Returns a problem description, or '' when Windows, macOS and Linux all accept the name.
export function checkName(name) {
  if (!name) return 'The new name is empty.';
  const bad = name.match(ILLEGAL);
  if (bad) {
    const ch = bad[0];
    if (ch === '/' || ch === '\\') return 'The new name contains “' + ch + '”, which would make a folder. Use - or _ instead.';
    return ch < ' ' || ch === '\u007f' ? 'The new name contains an invisible control character.' : 'Windows does not allow “' + ch + '” in file names.';
  }
  if (/^\s|[\s.]$/.test(name)) return 'The new name starts with a space or ends with a space or a dot.';
  if (name === '.' || name === '..') return 'That name is not allowed.';
  if (RESERVED.test(splitName(name).stem.split('.')[0])) return 'Windows reserves “' + splitName(name).stem + '” as a device name.';
  if ([...name].length > LIMITS.nameLength) return 'The new name is longer than ' + LIMITS.nameLength + ' characters.';
  return '';
}

// Combine new names and notes into preview rows; duplicates are compared the way Windows and macOS do (ignoring case).
export function buildPlan(files, names, notes = []) {
  const rows = files.map((file, i) => {
    const to = names[i];
    const problem = notes[i] || (to === null || to === undefined ? '' : checkName(to));
    return {index: i, from: file.name, to: to ?? null, size: file.size || 0, problem, skipped: to === null && !notes[i]};
  });
  const seen = new Map();
  for (const row of rows) if (row.to && !row.problem) seen.set(key(row.to), [...(seen.get(key(row.to)) || []), row]);
  for (const group of seen.values()) if (group.length > 1) for (const row of group) row.problem = 'Same new name as ' + (group.length - 1) + ' other file' + (group.length > 2 ? 's' : '') + '.';
  const problems = rows.filter((r) => r.problem).length, included = rows.filter((r) => !r.problem && !r.skipped);
  return {rows, problems, ready: problems === 0 && included.length > 0, included, changed: included.filter((r) => r.to !== nfc(r.from)).length};
}

// The list that travels with the ZIP. Cells that a spreadsheet would run as a formula are prefixed with an apostrophe.
export function mappingCsv(rows) {
  const cell = (value) => {
    let text = String(value);
    if (/^[=+@\t\r]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  const lines = [['Original name', 'New name', 'Size (bytes)'], ...rows.map((row) => [row.from, row.to, row.size])];
  return '﻿' + lines.map((line) => line.map(cell).join(',')).join('\r\n') + '\r\n';
}

// A name for the list file inside the ZIP that no renamed file uses.
export function listName(names) {
  const used = new Set(names.map(key));
  let name = LIST_NAME, n = 2;
  while (used.has(key(name))) name = 'rename-list-' + n++ + '.csv';
  return name;
}

const dosTime = (date) => (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
const dosDate = (date) => ((Math.min(2107, Math.max(1980, date.getFullYear())) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

// Stored (uncompressed) ZIP with UTF-8 names. Each entry: {name, data: Blob|Uint8Array, crc, size, date}.
// Blob data is referenced, not copied, so the original bytes go into the ZIP unchanged.
export function zipStoreEntries(entries) {
  const encoder = new TextEncoder();
  const locals = [], central = [];
  let offset = 0;
  for (const {name, data, crc, size, date = new Date()} of entries) {
    const nameBytes = encoder.encode(name), time = dosTime(date), day = dosDate(date);
    const header = new Uint8Array(30 + nameBytes.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true); view.setUint16(10, time, true); view.setUint16(12, day, true);
    view.setUint32(14, crc, true); view.setUint32(18, size, true); view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true); header.set(nameBytes, 30);
    const record = new Uint8Array(46 + nameBytes.length), cv = new DataView(record.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true); cv.setUint16(12, time, true); cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true); record.set(nameBytes, 46);
    locals.push(header, data); central.push(record);
    offset += header.length + size;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return new Blob([...locals, ...central, end], {type: 'application/zip'});
}

export {crc32};
