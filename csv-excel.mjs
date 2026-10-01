import {$} from './common.mjs';
import {SAMPLE, LIMITS, DELIMITERS, riskTypes} from './csv-core.mjs';

let worker = null, currentName = '', summary = null, busy = false, resultUrl = '';
const status = (text, error = false) => { $('csv-status').textContent = text; $('csv-status').classList.toggle('error', error); };
function discardResult() {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = '';
  $('csv-download').removeAttribute('href');
  $('csv-download').hidden = true;
  $('csv-verified').hidden = true;
  $('csv-verified').replaceChildren();
  $('csv-build').hidden = false;
}
function controls() {
  $('csv-build').disabled = busy || !summary?.records;
  for (const id of ['csv-delimiter', 'csv-header', 'csv-notes']) $(id).disabled = busy;
  $('csv-clear').disabled = !worker && !currentName;
  $('csv-workspace').setAttribute('aria-busy', String(busy));
}
function clear() {
  worker?.terminate(); worker = null; currentName = ''; summary = null; busy = false;
  discardResult();
  $('csv-file').value = ''; $('csv-file-name').textContent = '';
  $('csv-preview').hidden = true; $('csv-idle').hidden = false;
  $('csv-table').replaceChildren(); $('csv-risks').replaceChildren();
  $('csv-delimiter').value = ''; $('csv-header').checked = true; $('csv-notes').checked = true;
  status(''); controls();
}
function fail(message) {
  busy = false; summary = null; discardResult();
  $('csv-preview').hidden = true; $('csv-idle').hidden = false;
  $('csv-table').replaceChildren(); $('csv-risks').replaceChildren();
  status(message, true); controls();
}
function draw(value) {
  summary = value;
  $('csv-idle').hidden = true; $('csv-preview').hidden = false;
  $('csv-records').textContent = value.records.toLocaleString();
  $('csv-columns').textContent = value.columns.toLocaleString();
  $('csv-flagged').textContent = value.flagged.toLocaleString();
  $('csv-separator-note').textContent = (value.guessed ? '' : 'No separator detected; using ') + DELIMITERS[value.delimiter] + ' · UTF-8 · all cells stored as text';
  $('csv-risks').replaceChildren();
  const labels = {leading: 'Leading zeros', long: 'Long numbers', exponent: 'E notation', formula: 'Formula-like', date: 'Date-like'};
  for (const [key, label] of Object.entries(labels)) {
    const chip = document.createElement('span'); chip.className = 'csv-risk' + (value.counts[key] ? ' active' : '');
    chip.textContent = label + ' · ' + value.counts[key]; $('csv-risks').append(chip);
  }
  $('csv-table').replaceChildren();
  const head = document.createElement('thead'), headRow = document.createElement('tr');
  const corner = document.createElement('th'); corner.textContent = '#'; corner.scope = 'col'; corner.className = 'row-number'; headRow.append(corner);
  value.headings.forEach((heading, i) => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = heading || '(empty header ' + (i + 1) + ')'; headRow.append(cell); });
  head.append(headRow); $('csv-table').append(head);
  const body = document.createElement('tbody');
  value.preview.forEach((row, r) => {
    const line = document.createElement('tr'), number = document.createElement('th');
    number.textContent = String(r + (value.header ? 2 : 1)); number.className = 'row-number'; number.scope = 'row'; line.append(number);
    row.forEach(text => {
      const cell = document.createElement('td'), risks = riskTypes(text);
      cell.textContent = text.length > 140 ? text.slice(0, 140) + '…' : text;
      if (risks.length) { cell.className = 'flagged'; cell.title = risks.map(type => labels[type]).join(', ') + ' — kept as text'; }
      line.append(cell);
    });
    body.append(line);
  });
  $('csv-table').append(body);
  $('csv-preview-note').textContent = 'Preview: ' + value.preview.length + ' of ' + value.records.toLocaleString() + ' data records' + (value.columns > 8 ? '; first 8 of ' + value.columns + ' columns' : '') + '. # is the CSV record number. Yellow cells may be reinterpreted by spreadsheets; all values stay as text. Long preview values are shortened on screen only.';
  if (value.blankRecords) $('csv-preview-note').textContent += ' ' + value.blankRecords + ' blank record(s) retained.';
}
function startFile(file) {
  worker?.terminate(); worker = null; discardResult(); summary = null; busy = false;
  $('csv-preview').hidden = true; $('csv-idle').hidden = false; $('csv-table').replaceChildren();
  currentName = file.name; $('csv-file-name').textContent = file.name + ' · ' + (file.size / 1024).toFixed(1) + ' KB';
  if (!/\.csv$/i.test(file.name)) { fail('Choose a .csv file exported from the original source. XLS and XLSX files are not supported here.'); return; }
  if (file.size > LIMITS.bytes) { fail('This file is over 10 MB. Choose a smaller CSV.'); return; }
  busy = true; status('Reading your CSV in this tab…'); controls();
  try {
    worker = new Worker(new URL('./csv-worker.js', import.meta.url));
    worker.onmessage = ({data}) => {
      if (data.type === 'progress') { status(data.message); return; }
      busy = false;
      if (data.type === 'error') { fail(data.message); return; }
      if (data.type === 'preview') {
        draw(data.summary);
        status(data.summary.records ? 'Preview ready. Check the separator and header, then create your Excel file.' : 'Only a header was found. Uncheck “First row is a header” if this is a data record.');
      } else if (data.type === 'exported') {
        resultUrl = URL.createObjectURL(new Blob([data.bytes], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
        const link = $('csv-download');
        link.href = resultUrl; link.download = currentName.replace(/\.csv$/i, '') + '-text.xlsx'; link.hidden = false;
        $('csv-build').hidden = true;
        const heading = document.createElement('strong'); heading.textContent = 'Ready. Original text preserved.';
        const detail = document.createElement('span'); detail.textContent = data.cells.toLocaleString() + ' cells read back and checked. Text values, cell types and positions match the input CSV.';
        $('csv-verified').replaceChildren(heading, detail); $('csv-verified').hidden = false;
        status('Your Excel file is ready to download.');
      }
      controls();
    };
    worker.onerror = event => { event.preventDefault(); worker?.terminate(); worker = null; fail('The browser could not finish processing. Try a smaller file, or reload this page in a current browser.'); };
    worker.postMessage({type: 'load', file, delimiter: $('csv-delimiter').value, header: $('csv-header').checked});
  } catch { worker?.terminate(); worker = null; fail('This browser could not start local processing. Open the page over HTTP or HTTPS in a current browser.'); }
}
function reparse() {
  discardResult(); summary = null;
  if (!worker) { controls(); return; }
  busy = true; $('csv-preview').hidden = true; $('csv-idle').hidden = false;
  status('Updating the preview…'); controls();
  worker.postMessage({type: 'parse', delimiter: $('csv-delimiter').value, header: $('csv-header').checked});
}
$('csv-choose').addEventListener('click', () => $('csv-file').click());
$('csv-file').addEventListener('change', event => { const file = event.target.files[0]; if (file) startFile(file); event.target.value = ''; });
$('csv-example').addEventListener('click', () => { clear(); startFile(new File([SAMPLE], 'sample-product-catalog.csv', {type: 'text/csv'})); });
$('csv-clear').addEventListener('click', () => { clear(); status('Cleared. Choose a CSV or try the example.'); $('csv-choose').focus(); });
for (const id of ['csv-delimiter', 'csv-header']) $(id).addEventListener('change', reparse);
$('csv-notes').addEventListener('change', () => { discardResult(); status(summary ? 'Download options changed. Create the workbook again to apply them.' : ''); controls(); });
$('csv-build').addEventListener('click', () => {
  if (!worker || busy || !summary?.records) return;
  discardResult(); busy = true; status('Building your workbook and checking every cell…'); controls();
  worker.postMessage({type: 'export', header: $('csv-header').checked, notes: $('csv-notes').checked});
});
const drop = $('csv-drop');
drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('drag-over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
drop.addEventListener('drop', event => {
  event.preventDefault(); drop.classList.remove('drag-over');
  const files = event.dataTransfer.files;
  if (files.length !== 1) { clear(); status('Choose one CSV at a time.', true); return; }
  startFile(files[0]);
});
window.addEventListener('pagehide', clear);
clear();
