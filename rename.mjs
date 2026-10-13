import {$, message, download, kb} from './common.mjs';
import {LIMITS, orderFiles, ruleNames, parseTable, listNames, buildPlan, mappingCsv, listName, zipStoreEntries, crc32} from './rename-core.mjs';

let files = [], mode = 'rules', plan = null, order = [], unused = [], busy = false;

const rules = () => ({
  base: $('rn-base').value, text: $('rn-text').value, find: $('rn-find').value, replace: $('rn-replace').value,
  matchCase: $('rn-case').checked, prefix: $('rn-prefix').value, suffix: $('rn-suffix').value,
  number: $('rn-number').value, start: $('rn-start').value, digits: $('rn-digits').value, sep: $('rn-sep').value,
  extCase: $('rn-ext-lower').checked ? 'lower' : 'keep',
});

function update() {
  $('rn-text-wrap').hidden = $('rn-base').value !== 'text';
  for (const el of document.querySelectorAll('.rn-number-opts')) el.hidden = $('rn-number').value === 'none';
  $('rn-order').closest('div').hidden = $('rn-number').value === 'none';
  let names, notes = [], headerSkipped = false;
  unused = [];
  if (mode === 'rules') {
    order = orderFiles(files, $('rn-number').value === 'none' ? 'added' : $('rn-order').value);
    names = ruleNames(files, rules(), order);
  } else {
    order = files.map((_, i) => i);
    const rows = parseTable($('rn-table').value);
    if (rows.length) ({names, notes, unused, headerSkipped} = listNames(files, rows, $('rn-unmapped').value));
    else { names = files.map(() => undefined); notes = files.map(() => 'Paste or load the list of new names.'); }
  }
  plan = buildPlan(files, names, notes);
  render(headerSkipped);
}

function render(headerSkipped) {
  const body = $('rn-rows');
  $('rn-count').textContent = files.length ? files.length + (files.length === 1 ? ' file / ' : ' files / ') + kb(files.reduce((s, f) => s + f.size, 0)) : '';
  $('rn-clear').disabled = !files.length || busy;
  if (!files.length) {
    const row = document.createElement('tr'); row.className = 'rn-empty';
    const cell = document.createElement('td'); cell.colSpan = 3; cell.textContent = 'Choose files to see their new names here.';
    row.append(cell); body.replaceChildren(row);
    $('rn-summary').textContent = ''; $('rn-unused').hidden = true;
    $('rn-download').disabled = $('rn-download-list').disabled = true;
    return;
  }
  body.replaceChildren(...order.map((fileIndex, position) => {
    const item = plan.rows[fileIndex];
    const row = document.createElement('tr');
    row.className = item.problem ? 'problem' : item.skipped ? 'skipped' : item.to === item.from.normalize('NFC') ? 'same' : '';
    const num = document.createElement('td'); num.className = 'rn-num'; num.textContent = position + 1;
    const from = document.createElement('td'), fromInner = document.createElement('div'); fromInner.className = 'rn-from';
    const name = document.createElement('span'); name.textContent = item.from;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'heic-remove rn-remove'; remove.textContent = '×';
    remove.setAttribute('aria-label', 'Remove ' + item.from); remove.disabled = busy;
    remove.addEventListener('click', () => { if (busy) return; files.splice(fileIndex, 1); message('rn-status', ''); update(); });
    fromInner.append(remove, name); from.append(fromInner);
    const to = document.createElement('td'); to.className = 'rn-to';
    const out = document.createElement('span'); out.textContent = item.skipped ? 'Left out of the ZIP' : item.to ?? '—';
    to.append(out);
    if (item.problem) { const note = document.createElement('small'); note.textContent = item.problem; to.append(note); }
    else if (item.to === item.from.normalize('NFC')) { const note = document.createElement('small'); note.textContent = 'Name unchanged'; to.append(note); }
    row.append(num, from, to);
    return row;
  }));
  const parts = [plan.included.length + ' ready', plan.changed + ' renamed'];
  if (plan.problems) parts.push(plan.problems + (plan.problems === 1 ? ' problem' : ' problems'));
  const skipped = plan.rows.filter((r) => r.skipped).length;
  if (skipped) parts.push(skipped + ' left out');
  if (headerSkipped) parts.push('header row skipped');
  $('rn-summary').textContent = parts.join(' / ');
  $('rn-unused').hidden = !unused.length;
  $('rn-unused').textContent = unused.length ? unused.length + (unused.length === 1 ? ' list row matches' : ' list rows match') + ' no chosen file: ' + unused.slice(0, 8).join(', ') + (unused.length > 8 ? ', …' : '') + '. Check the spelling, or add the missing files.' : '';
  $('rn-download').disabled = !plan.ready || busy;
  $('rn-download-list').disabled = !plan.ready || busy;
  if (!busy) {
    if (plan.problems) message('rn-status', 'Fix the ' + (plan.problems === 1 ? 'name' : plan.problems + ' names') + ' marked in red to download.', true);
    else if (!plan.included.length) message('rn-status', 'No file is left to put in the ZIP.', true);
    else message('rn-status', '');
  }
}

function addFiles(list, folders = 0) {
  if (busy) return;
  const skipped = [];
  for (const file of list) {
    if (files.length >= LIMITS.files) { skipped.push(file.name + ' (over ' + LIMITS.files + ' files)'); continue; }
    if (files.reduce((s, f) => s + f.size, 0) + file.size > LIMITS.total) { skipped.push(file.name + ' (batch over 400 MB)'); continue; }
    if (files.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) continue;
    files.push(file);
  }
  $('rn-file').value = '';
  update();
  const notes = [];
  if (folders) notes.push(folders + (folders === 1 ? ' folder was' : ' folders were') + ' skipped; open the folder and choose its files');
  if (skipped.length) notes.push('Skipped: ' + skipped.join(', '));
  if (notes.length) message('rn-status', notes.join('. ') + '.', true);
}

const ordered = () => order.map((i) => plan.rows[i]).filter((row) => !row.problem && !row.skipped);

async function downloadZip() {
  if (!plan?.ready || busy) return;
  busy = true; setBusy(true);
  try {
    const rows = ordered(), entries = [];
    for (const [n, row] of rows.entries()) {
      message('rn-status', 'Reading ' + (n + 1) + ' of ' + rows.length + ' on your device…');
      const file = files[row.index];
      const bytes = new Uint8Array(await file.arrayBuffer());
      entries.push({name: row.to, data: file, crc: crc32(bytes), size: bytes.length, date: new Date(file.lastModified || Date.now())});
    }
    if ($('rn-include-list').checked) {
      const csv = new TextEncoder().encode(mappingCsv(rows));
      entries.push({name: listName(rows.map((r) => r.to)), data: csv, crc: crc32(csv), size: csv.length, date: new Date()});
    }
    download(zipStoreEntries(entries), 'renamed-files.zip');
    message('rn-status', 'ZIP ready: ' + rows.length + (rows.length === 1 ? ' file' : ' files') + ($('rn-include-list').checked ? ' and rename-list.csv.' : '.') + ' Your originals are unchanged.');
  } catch (error) {
    message('rn-status', (error && error.name === 'NotReadableError') ? 'A file could not be read. It may have been moved or changed; choose it again.' : (error.message || 'The ZIP could not be made.'), true);
  } finally { busy = false; setBusy(false); }
}

function setBusy(on) {
  for (const el of document.querySelectorAll('.rename-workspace input, .rename-workspace select, .rename-workspace textarea, .rename-workspace .tab, .rn-remove, #rn-include-list')) el.disabled = on;
  $('rn-clear').disabled = on || !files.length;
  $('rn-download').disabled = $('rn-download-list').disabled = on || !plan?.ready;
}

async function loadList(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { message('rn-status', 'The list file is over 2 MB. Use a smaller CSV.', true); return; }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text;
  try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
  catch { text = new TextDecoder('gb18030').decode(bytes); } // Excel in Chinese saves "CSV" in GBK.
  $('rn-table').value = text.replace(/^﻿/, '');
  $('rn-csv').value = '';
  update();
}

function setMode(next) {
  mode = next;
  for (const tab of document.querySelectorAll('.tab[data-mode]')) tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
  $('rn-rules').hidden = mode !== 'rules'; $('rn-list').hidden = mode !== 'list';
  message('rn-status', '');
  update();
}

$('rn-file').addEventListener('change', () => addFiles([...$('rn-file').files]));
const drop = $('rn-drop');
drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('drag-over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
drop.addEventListener('drop', (event) => {
  event.preventDefault(); drop.classList.remove('drag-over');
  const items = [...event.dataTransfer.items || []];
  const isFolder = items.map((item) => item.webkitGetAsEntry?.()?.isDirectory === true);
  const list = [...event.dataTransfer.files].filter((_, i) => !isFolder[i]);
  addFiles(list, isFolder.filter(Boolean).length);
});
for (const tab of document.querySelectorAll('.tab[data-mode]')) tab.addEventListener('click', () => setMode(tab.dataset.mode));
for (const el of document.querySelectorAll('#rn-rules input, #rn-rules select, #rn-unmapped')) el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', update);
let typing;
$('rn-table').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(update, 150); });
$('rn-csv').addEventListener('change', () => loadList($('rn-csv').files[0]).catch(() => message('rn-status', 'The list file could not be read.', true)));
$('rn-clear').addEventListener('click', () => { if (busy) return; files = []; message('rn-status', ''); update(); });
$('rn-download').addEventListener('click', downloadZip);
$('rn-download-list').addEventListener('click', () => { if (plan?.ready) download(new Blob([mappingCsv(ordered())], {type: 'text/csv;charset=utf-8'}), 'rename-list.csv'); });
setMode('rules');
