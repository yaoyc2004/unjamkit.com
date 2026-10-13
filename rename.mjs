import {$, message, download, kb} from './common.mjs';
import {LIMITS, orderFiles, ruleNames, parseTable, listNames, buildPlan, mappingCsv, listName, zipStoreEntries, crc32, cleanRules, templatesJson, parseTemplates, isRenameList, swapColumns, unquoteFormula, toTsv} from './rename-core.mjs';

let files = [], mode = 'rules', plan = null, order = [], unused = [], busy = false;

// Form field for each rule; checkboxes hold booleans, extCase is the lowercase-extension checkbox.
const FIELDS = {base: 'rn-base', text: 'rn-text', removeFirst: 'rn-remove-first', removeLast: 'rn-remove-last', caseMode: 'rn-case-mode',
  find: 'rn-find', replace: 'rn-replace', regex: 'rn-regex', matchCase: 'rn-case', prefix: 'rn-prefix', suffix: 'rn-suffix',
  number: 'rn-number', order: 'rn-order', start: 'rn-start', digits: 'rn-digits', sep: 'rn-sep', extCase: 'rn-ext-lower'};
const DEFAULTS = {base: 'keep', text: '', removeFirst: 0, removeLast: 0, caseMode: 'keep', find: '', replace: '', regex: false, matchCase: false,
  prefix: '', suffix: '', number: 'after', order: 'name', start: 1, digits: 3, sep: '_', extCase: 'keep'};

function rules() {
  const out = {};
  for (const [k, id] of Object.entries(FIELDS)) {
    const el = $(id);
    out[k] = k === 'extCase' ? (el.checked ? 'lower' : 'keep') : el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) || 0 : el.value;
  }
  return out;
}

function applyRules(saved) {
  const next = {...DEFAULTS, ...cleanRules(saved)};
  for (const [k, id] of Object.entries(FIELDS)) {
    const el = $(id);
    if (k === 'extCase') el.checked = next[k] === 'lower';
    else if (el.type === 'checkbox') el.checked = !!next[k];
    else el.value = String(next[k]);
  }
  if (next.digits > 4 || next.digits < 1) $('rn-digits').value = '3';
  update();
}

function update() {
  $('rn-text-wrap').hidden = $('rn-base').value !== 'text';
  for (const el of document.querySelectorAll('.rn-number-opts')) el.hidden = $('rn-number').value === 'none';
  $('rn-order').closest('div').hidden = $('rn-number').value === 'none';
  let names, notes = [], headerSkipped = false;
  unused = [];
  if (mode === 'rules') {
    order = orderFiles(files, $('rn-number').value === 'none' ? 'added' : $('rn-order').value);
    try { names = ruleNames(files, rules(), order); }
    catch (error) { names = files.map(() => undefined); notes = files.map(() => error.message); }
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
    const num = document.createElement('td'); num.className = 'rn-num';
    const label = document.createElement('span'); label.textContent = position + 1;
    const up = moveButton('↑', 'Move ' + item.from + ' up', position, position - 1), down = moveButton('↓', 'Move ' + item.from + ' down', position, position + 1);
    up.disabled = busy || position === 0; down.disabled = busy || position === order.length - 1;
    num.append(label, up, down);
    row.draggable = !busy; row.dataset.position = position;
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

// Manual order: rearrange the files themselves, then number them as listed.
function move(from, to) {
  if (busy || to < 0 || to >= order.length || from === to) return;
  const next = [...order];
  next.splice(to, 0, next.splice(from, 1)[0]);
  files = next.map((i) => files[i]);
  if (mode === 'rules' && $('rn-order').value !== 'added') { $('rn-order').value = 'added'; message('rn-status', 'Numbering now follows the order in the list.'); }
  update();
  $('rn-rows').querySelectorAll('tr')[to]?.querySelector(from > to ? '.rn-move' : '.rn-move:last-of-type')?.focus();
}

function moveButton(text, label, from, to) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'rn-move'; button.textContent = text;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => move(from, to));
  return button;
}

let dragFrom = -1;
$('rn-rows').addEventListener('dragstart', (event) => { const row = event.target.closest?.('tr[data-position]'); if (!row) return; dragFrom = Number(row.dataset.position); row.classList.add('dragging'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', row.dataset.position); });
$('rn-rows').addEventListener('dragover', (event) => { if (dragFrom >= 0) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } });
$('rn-rows').addEventListener('drop', (event) => { const row = event.target.closest?.('tr[data-position]'); if (dragFrom < 0 || !row) return; event.preventDefault(); const from = dragFrom; dragFrom = -1; move(from, Number(row.dataset.position)); });
$('rn-rows').addEventListener('dragend', () => { dragFrom = -1; for (const row of $('rn-rows').querySelectorAll('.dragging')) row.classList.remove('dragging'); });

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
  for (const el of document.querySelectorAll('.rename-workspace input, .rename-workspace select, .rename-workspace textarea, .rename-workspace button, .rn-remove, .rn-move, #rn-include-list')) el.disabled = on;
  for (const row of $('rn-rows').querySelectorAll('tr[data-position]')) row.draggable = !on;
  $('rn-clear').disabled = on || !files.length;
  if (!on) syncTemplates();
  $('rn-download').disabled = $('rn-download-list').disabled = on || !plan?.ready;
}

async function loadList(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { message('rn-status', 'The list file is over 5 MB. Use a smaller file.', true); return; }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let rows;
  if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
    message('rn-status', 'Reading the workbook…');
    const XLSX = await import('./vendor/xlsx-0.20.3.mjs');
    const book = XLSX.read(bytes, {type: 'array'});
    const sheet = book.Sheets[book.SheetNames[0]];
    // raw: false gives the text Excel shows, so 00123 formatted as text keeps its zeros.
    rows = XLSX.utils.sheet_to_json(sheet, {header: 1, raw: false, defval: '', blankrows: false}).map((r) => r.map((c) => String(c).trim()));
  } else {
    let text;
    try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
    catch { text = new TextDecoder('gb18030').decode(bytes); } // Excel in Chinese saves "CSV" in GBK.
    rows = parseTable(text);
  }
  $('rn-csv').value = '';
  let note = 'Loaded ' + rows.length + (rows.length === 1 ? ' row' : ' rows') + ' from ' + file.name + '.';
  if (isRenameList(rows)) {
    rows = [['Current name', 'Change back to'], ...swapColumns(rows.slice(1)).map((r) => r.slice(0, 2).map(unquoteFormula))];
    note = 'This is a rename list from this tool, so the columns were swapped to change the names back.' + (files.length ? '' : ' Now choose the renamed files.');
  }
  $('rn-table').value = toTsv(rows.map((r) => r.slice(0, 2)));
  update();
  if (!$('rn-status').classList.contains('error')) message('rn-status', note);
}

function swapTable() {
  const rows = parseTable($('rn-table').value);
  if (!rows.length) return;
  $('rn-table').value = toTsv(swapColumns(rows).map((r) => r.slice(0, 2).map(unquoteFormula)));
  update();
}

// Saved rules live in this browser (localStorage) and can be exported as a JSON file to keep or share.
const STORE = 'unjamkit.batchRename.templates';
let templates = [];
function readTemplates() { try { templates = parseTemplates(localStorage.getItem(STORE) || 'null'); } catch { templates = []; } }
function writeTemplates() { try { localStorage.setItem(STORE, templatesJson(templates)); return true; } catch { return false; } }
function syncTemplates(selected = $('rn-template').value) {
  const select = $('rn-template');
  const first = document.createElement('option'); first.value = ''; first.textContent = templates.length ? 'Choose saved rules…' : 'No saved rules yet';
  select.replaceChildren(first, ...templates.map((t) => { const o = document.createElement('option'); o.value = t.name; o.textContent = t.name; return o; }));
  select.value = templates.some((t) => t.name === selected) ? selected : '';
  $('rn-template-delete').disabled = busy || !select.value;
}
const templateNote = (text, error = false) => message('rn-template-status', text, error);

function saveTemplate() {
  const name = (prompt('Name these rules', $('rn-template').value || 'My rules') || '').trim().slice(0, 60);
  if (!name) return;
  const entry = {name, rules: cleanRules(rules())};
  const at = templates.findIndex((t) => t.name === name);
  if (at >= 0) templates[at] = entry; else templates.push(entry);
  syncTemplates(name);
  const stored = writeTemplates();
  templateNote(stored ? 'Saved “' + name + '” in this browser. Export to keep a copy or share it.' : 'This browser blocks saving. Export the rules to keep them.', !stored);
}

function deleteTemplate() {
  const name = $('rn-template').value;
  if (!name) return;
  templates = templates.filter((t) => t.name !== name);
  writeTemplates(); syncTemplates(''); templateNote('Deleted “' + name + '”.');
}

function exportTemplates() {
  const list = templates.length ? templates : [{name: 'My rules', rules: rules()}];
  download(new Blob([templatesJson(list)], {type: 'application/json'}), 'batch-rename-rules.json');
  templateNote(templates.length ? 'Exported ' + list.length + (list.length === 1 ? ' saved rule set.' : ' saved rule sets.') : 'Exported the current rules.');
}

async function importTemplates(file) {
  if (!file) return;
  try {
    if (file.size > 512 * 1024) throw new Error('This file is too large to be a rules file.');
    const incoming = parseTemplates(await file.text());
    if (!incoming.length) throw new Error('The file has no rules in it.');
    for (const entry of incoming) { const at = templates.findIndex((t) => t.name === entry.name); if (at >= 0) templates[at] = entry; else templates.push(entry); }
    writeTemplates(); syncTemplates(incoming[0].name); applyRules(incoming[0].rules);
    templateNote('Imported ' + incoming.length + (incoming.length === 1 ? ' rule set' : ' rule sets') + ' and applied “' + incoming[0].name + '”.');
  } catch (error) { templateNote(error.message, true); }
  finally { $('rn-template-import').value = ''; }
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
$('rn-csv').addEventListener('change', () => loadList($('rn-csv').files[0]).catch(() => { $('rn-csv').value = ''; message('rn-status', 'The list file could not be read. Save it as .xlsx or .csv and try again.', true); }));
$('rn-swap').addEventListener('click', swapTable);
$('rn-template').addEventListener('change', () => {
  const t = templates.find((x) => x.name === $('rn-template').value);
  $('rn-template-delete').disabled = !t;
  if (t) { applyRules(t.rules); templateNote('Applied “' + t.name + '”.'); }
});
$('rn-template-save').addEventListener('click', saveTemplate);
$('rn-template-delete').addEventListener('click', deleteTemplate);
$('rn-template-export').addEventListener('click', exportTemplates);
$('rn-template-import').addEventListener('change', () => importTemplates($('rn-template-import').files[0]));
$('rn-clear').addEventListener('click', () => { if (busy) return; files = []; message('rn-status', ''); update(); });
$('rn-download').addEventListener('click', downloadZip);
$('rn-download-list').addEventListener('click', () => { if (plan?.ready) download(new Blob([mappingCsv(ordered())], {type: 'text/csv;charset=utf-8'}), 'rename-list.csv'); });
readTemplates(); syncTemplates();
setMode('rules');
