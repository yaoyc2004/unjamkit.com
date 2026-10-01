// All input values remain strings. This module has no DOM, storage or network access.
export const LIMITS = Object.freeze({bytes: 10 * 1024 * 1024, rows: 50001, columns: 256, cells: 250000, characters: 32767});
export const SAMPLE = 'SKU,Product ID,Model,Description,Price\r\n00123,123456789012345678,1E10,"Adapter, small",19.90\r\n00007,987654321098765432,03-04,"Cable ""Pro""",8.50\r\n00456,100000000000000001,=1+1,"Two-line description\nkept in one cell",12.00\r\n';
export const DELIMITERS = {',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe'};

export function decodeCsv(buffer) {
  if (buffer.byteLength > LIMITS.bytes) throw new Error('This file is over 10 MB. Choose a smaller CSV.');
  try { return new TextDecoder('utf-8', {fatal: true}).decode(buffer); }
  catch { throw new Error('This file is not valid UTF-8. Export the original data as CSV UTF-8 and try again.'); }
}

export function parseCsv(text, delimiter, Papa) {
  if (new TextEncoder().encode(text).byteLength > LIMITS.bytes) throw new Error('This file is over 10 MB. Choose a smaller CSV.');
  text = text.replace(/^\uFEFF/, '');
  if (!text.length) throw new Error('This CSV is empty. Choose a file with at least one record.');
  if (delimiter && !Object.hasOwn(DELIMITERS, delimiter)) throw new Error('Choose a supported separator.');
  // Papa's default guess can miss a short two-column file ending in a newline.
  // Probe actual parsed records, ignoring blank records only for detection.
  let actualDelimiter = delimiter, guessed = true;
  if (!actualDelimiter) {
    let bestScore = 0;
    for (const candidate of Object.keys(DELIMITERS)) {
      const probe = Papa.parse(text, {delimiter: candidate, preview: 10, header: false, dynamicTyping: false, skipEmptyLines: true, fastMode: false});
      const widths = new Map();
      for (const row of probe.data) if (row.length > 1) widths.set(row.length, (widths.get(row.length) || 0) + 1);
      for (const [width, count] of widths) {
        const score = count / Math.max(1, probe.data.length) * 100 + Math.min(width, 50) - probe.errors.length * 100;
        if (score > bestScore) { bestScore = score; actualDelimiter = candidate; }
      }
    }
    if (!actualDelimiter) { actualDelimiter = ','; guessed = false; }
  }
  const rows = [];
  let problem = '', cellCount = 0;
  Papa.parse(text, {
    delimiter: actualDelimiter,
    header: false, dynamicTyping: false, skipEmptyLines: false, comments: false, fastMode: false,
    step(result, parser) {
      actualDelimiter = result.meta.delimiter;
      const errors = result.errors.filter(error => error.code !== 'UndetectableDelimiter');
      if (result.errors.some(error => error.code === 'UndetectableDelimiter')) guessed = false;
      if (errors.length) { problem = 'The CSV has invalid quoting near record ' + (rows.length + 1) + '. Check the original export and separator.'; parser.abort(); return; }
      const row = result.data;
      if (rows.length >= LIMITS.rows + 1 || row.length > LIMITS.columns || cellCount + row.length > LIMITS.cells + LIMITS.columns) {
        problem = 'This CSV exceeds the preview limits: 50,000 data records, 256 columns or 250,000 cells. Split the original file and try again.'; parser.abort(); return;
      }
      for (const value of row) {
        if (value.length > LIMITS.characters) { problem = 'A value in record ' + (rows.length + 1) + ' exceeds Excel’s 32,767-character cell limit. No values have been shortened.'; break; }
        if (/_x005f_|_x[\da-f]{4}_x[\da-f]{4}_/i.test(value)) { problem = 'Record ' + (rows.length + 1) + ' contains Excel escape-shaped text that different readers interpret differently. No values were changed or exported.'; break; }
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(value)) { problem = 'Record ' + (rows.length + 1) + ' contains a control character that cannot be safely represented in this workbook. Export a clean UTF-8 CSV.'; break; }
      }
      if (problem) { parser.abort(); return; }
      rows.push(row); cellCount += row.length;
    }
  });
  if (problem) throw new Error(problem);
  // A single final record separator terminates the last record; it is not an extra blank row.
  if (/[\r\n]$/.test(text) && rows.at(-1)?.length === 1 && rows.at(-1)[0] === '') rows.pop();
  if (!rows.length || rows.every(row => row.every(value => value === ''))) throw new Error('This CSV contains no values. Choose another file.');
  const columns = rows[0].length;
  let blankRecords = 0;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.length === 1 && row[0] === '') { rows[index] = Array(columns).fill(''); blankRecords++; }
    else if (row.length !== columns) throw new Error('Record ' + (index + 1) + ' has ' + row.length + ' fields; the first record has ' + columns + '. Check the separator or original CSV. No rows were dropped.');
  }
  if (rows.length > LIMITS.rows || rows.length * columns > LIMITS.cells) throw new Error('This CSV exceeds the 50,000-data-record or 250,000-cell limit. Split the original file and try again.');
  return {rows, delimiter: actualDelimiter, guessed, blankRecords};
}

export function riskTypes(value) {
  const types = [];
  if (/^[+-]?0\d+$/.test(value)) types.push('leading');
  if (/^[+-]?\d{16,}$/.test(value)) types.push('long');
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+$/.test(value)) types.push('exponent');
  if (/^\s*[=+\-@]/u.test(value) || /^[\t\r]/.test(value)) types.push('formula');
  if (/^(?:\d{1,4}[-/]\d{1,2}(?:[-/]\d{1,4})?|\d{1,2}[-/][a-z]{3,9}(?:[-/]\d{2,4})?|[a-z]{3,9}[-/]\d{1,2})$/i.test(value)) types.push('date');
  return types;
}

export function summarize(parsed, header) {
  const {rows} = parsed;
  const start = header ? 1 : 0;
  if (rows.length - start > 50000) throw new Error('This CSV has more than 50,000 data records. Split the original file and try again.');
  const counts = {leading: 0, long: 0, exponent: 0, formula: 0, date: 0};
  let flagged = 0;
  for (let r = start; r < rows.length; r++) for (const value of rows[r]) {
    const types = riskTypes(value);
    if (types.length) flagged++;
    for (const type of types) counts[type]++;
  }
  return {records: rows.length - start, totalRows: rows.length, columns: rows[0].length,
    cells: rows.length * rows[0].length, counts, flagged, blankRecords: parsed.blankRecords,
    delimiter: parsed.delimiter, guessed: parsed.guessed,
    headings: header ? rows[0].slice(0, 8) : rows[0].slice(0, 8).map((_, i) => 'Column ' + (i + 1)),
    preview: rows.slice(start, start + 6).map(row => row.slice(0, 8)), header};
}

export function exportWorkbook(parsed, {header, notes}, XLSX) {
  const summary = summarize(parsed, header);
  if (!summary.records) throw new Error('There are no data records. Uncheck “First row is a header” if this file contains one data row.');
  const data = XLSX.utils.aoa_to_sheet(parsed.rows);
  for (let r = 0; r < parsed.rows.length; r++) for (let c = 0; c < summary.columns; c++) {
    data[XLSX.utils.encode_cell({r, c})] = {t: 's', v: parsed.rows[r][c], z: '@'};
  }
  data['!cols'] = Array.from({length: summary.columns}, (_, c) => ({wch: Math.min(36, Math.max(14, ...parsed.rows.slice(0, 20).map(row => row[c].length + 2)))}));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, data, 'Data');
  let noteRows;
  if (notes) {
    noteRows = [
      ['UnjamKit / CSV to Excel', 'Conversion notes'],
      ['Data records', String(summary.records)], ['Columns', String(summary.columns)],
      ['Header row', header ? 'First CSV record; kept unchanged in Data' : 'None; no header was added to Data'],
      ['Separator', DELIMITERS[parsed.delimiter]], ['Encoding', 'UTF-8'],
      ['Cell types', 'All values in Data are text, including prices and quantities.'],
      ['Values flagged for attention', String(summary.flagged)],
      ['Leading-zero values', String(summary.counts.leading)], ['Long-number values', String(summary.counts.long)],
      ['Scientific-notation-like values', String(summary.counts.exponent)], ['Formula-like values', String(summary.counts.formula)],
      ['Date-like values', String(summary.counts.date)],
      ['Blank records', String(summary.blankRecords) + '; retained as blank rows'],
      ['Verification', 'The tool releases this file only after reading it back and comparing every Data cell’s text, type and position.'],
      ['What is preserved', 'Decoded CSV field text, spaces, embedded line breaks, header labels and record order. CSV quoting syntax is not part of a field’s value.'],
      ['Limits', 'This checks the conversion against the input CSV, not the accuracy of upstream data. Missing zeros or lost digits cannot be recovered.'],
      ['Opening in Excel', 'Keep identifiers as text. Converting to numbers or reopening an exported CSV can change them.'],
      ['Privacy', 'Processed in your browser. No upload, account or saved browser-storage copy.']
    ];
    const sheet = XLSX.utils.aoa_to_sheet(noteRows);
    sheet['!cols'] = [{wch: 31}, {wch: 100}];
    XLSX.utils.book_append_sheet(workbook, sheet, 'Conversion notes');
  }
  const bytes = XLSX.write(workbook, {type: 'array', bookType: 'xlsx', compression: true, bookSST: true});
  const check = XLSX.read(bytes, {type: 'array', raw: true, cellFormula: true, cellText: false});
  const output = check.Sheets.Data;
  if (!output || output['!ref'] !== data['!ref']) throw new Error('The output dimensions did not match. No download was created.');
  for (let r = 0; r < parsed.rows.length; r++) for (let c = 0; c < summary.columns; c++) {
    const cell = output[XLSX.utils.encode_cell({r, c})];
    if (!cell || cell.t !== 's' || cell.v !== parsed.rows[r][c] || cell.f !== undefined) throw new Error('The output did not preserve a value in record ' + (r + 1) + '. No download was created.');
  }
  if (noteRows) for (let r = 0; r < noteRows.length; r++) for (let c = 0; c < 2; c++) {
    const cell = check.Sheets['Conversion notes']?.[XLSX.utils.encode_cell({r, c})];
    if (!cell || cell.t !== 's' || cell.v !== noteRows[r][c] || cell.f) throw new Error('The conversion notes failed verification. No download was created.');
  }
  return {bytes, cells: summary.cells, records: summary.records};
}
