import {readDeck, suggestMatches, diffText, normalize, inspectDeck, validateProject} from './ppt-notes-core.mjs';
import {$, download, message} from './common.mjs';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabels = {pending:'To review', skip:'No rerecording', record:'Record', done:'Done'};
const state = {mode:'compare', oldDeck:null, newDeck:null, pairs:[], uncertain:new Set(), statuses:[], selected:0, view:'inline', presenterIndex:0};
const oldInput = $('old-file'), newInput = $('new-file');

function setMode(mode) {
  state.mode = mode;
  $('mode-compare').setAttribute('aria-pressed', String(mode === 'compare'));
  $('mode-single').setAttribute('aria-pressed', String(mode === 'single'));
  $('old-wrap').hidden = mode === 'single';
  $('new-label').textContent = mode === 'single' ? 'Your PPTX' : 'Updated PPTX';
  $('new-name').textContent = mode === 'single' ? 'Choose the deck' : 'Choose the new version';
  $('filter').querySelector('[value="changed"]').disabled = mode === 'single';
  if (mode === 'single' && $('filter').value === 'changed') $('filter').value = 'all';
}
function clearSession() {
  state.oldDeck = null; state.newDeck = null; state.pairs = []; state.statuses = []; state.uncertain = new Set();
  state.selected = 0; oldInput.value = ''; newInput.value = ''; $('terms').value = '';
  $('notes-results').hidden = true; $('presenter').hidden = true;
  $('old-name').textContent = 'Choose the old version';
  $('new-name').textContent = state.mode === 'single' ? 'Choose the deck' : 'Choose the new version';
  message('load-status', 'Working data cleared from this tab.');
}
function begin(oldDeck, newDeck, mode) {
  $('filter').value = 'all'; $('search').value = ''; $('terms').value = ''; $('ignore-space').checked = false;
  state.mode = mode; state.oldDeck = oldDeck; state.newDeck = newDeck;
  const proposed = mode === 'compare' ? suggestMatches(oldDeck.slides, newDeck.slides) : {pairs:Array(newDeck.slides.length).fill(null), uncertain:new Set()};
  state.pairs = proposed.pairs; state.uncertain = proposed.uncertain;
  state.statuses = newDeck.slides.map((_, i) => changed(i) || state.uncertain.has(i) || mode === 'compare' && state.pairs[i] === null ? 'pending' : 'skip');
  if (mode === 'single') state.statuses.fill('pending');
  state.selected = 0; state.view = 'inline';
  if (mode === 'compare') state.selected = newDeck.slides.findIndex((_, i) => changed(i)) >= 0 ? newDeck.slides.findIndex((_, i) => changed(i)) : 0;
  setMode(mode); $('notes-results').hidden = false; render();
  $('notes-results').scrollIntoView({behavior:'smooth', block:'start'});
}
function changed(i) {
  if (state.mode === 'single') return false;
  const old = state.pairs[i] === null ? '' : state.oldDeck.slides[state.pairs[i]]?.notes || '';
  return normalize(old, $('ignore-space').checked) !== normalize(state.newDeck.slides[i].notes, $('ignore-space').checked);
}
function terms() {return [...new Set($('terms').value.split(/[,，\n]/).map(s => s.trim()).filter(Boolean))].slice(0, 30);}
function flags(i, inspection) {
  const f = inspection[i], list = [];
  if (state.uncertain.has(i)) list.push('Check page match');
  const oldIndex = state.pairs[i];
  if (state.mode === 'compare' && oldIndex !== null && !changed(i) && state.oldDeck.slides[oldIndex].body !== state.newDeck.slides[i].body) list.push('Slide text changed, notes did not');
  if (f.empty) list.push('No notes');
  if (f.duplicate) list.push('Repeated notes');
  if (f.terms.length) list.push('Old term: ' + f.terms.join(', '));
  return list;
}
function summary() {
  const slides = state.newDeck.slides;
  const changedCount = slides.filter((_, i) => changed(i)).length;
  const pending = state.statuses.filter(s => s === 'pending').length;
  const recording = state.statuses.filter(s => s === 'record').length;
  $('metric-pages').textContent = slides.length;
  $('label-pages').textContent = state.mode === 'single' ? 'SLIDES' : 'NEW SLIDES';
  $('metric-changed').textContent = state.mode === 'single' ? slides.filter(s => s.notes.trim()).length : changedCount;
  $('label-changed').textContent = state.mode === 'single' ? 'WITH NOTES' : 'NOTES CHANGED';
  $('metric-open').textContent = pending;
  $('metric-record').textContent = recording;
  const unmatched = state.mode === 'compare' ? state.oldDeck.slides.filter((_, i) => !state.pairs.includes(i)).length : 0;
  $('deck-summary').textContent = state.mode === 'compare'
    ? `${state.oldDeck.name} → ${state.newDeck.name} · ${unmatched} earlier slide${unmatched === 1 ? '' : 's'} unmatched`
    : state.newDeck.name;
  $('results-title').textContent = state.mode === 'single' ? 'All speaker notes, in order.' : 'Review the changed notes.';
  const inspection = inspectDeck(state.newDeck, terms());
  const empty = inspection.filter(f => f.empty).length, repeated = inspection.filter(f => f.duplicate).length, oldTerms = inspection.filter(f => f.terms.length).length;
  $('issue-summary').innerHTML = `<span>${empty} without notes</span><span>${repeated} with repeated notes</span><span>${oldTerms} with listed terms</span><span>${state.uncertain.size} uncertain matches</span>`;
  const chars = slides.reduce((n, s, i) => n + (state.statuses[i] === 'record' ? [...s.notes.replace(/\s/g, '')].length : 0), 0);
  const speed = Math.min(1000, Math.max(60, Number($('reading-speed').value) || 240));
  $('record-estimate').textContent = chars ? `About ${Math.ceil(chars/speed)} min at this reading speed · ${chars} non-space characters` : 'No slides marked Record yet.';
  return inspection;
}
function renderList(inspection) {
  const filter = $('filter').value, query = $('search').value.trim().toLowerCase();
  const shown = state.newDeck.slides.map((s,i) => ({s,i})).filter(({s,i}) => {
    const f = flags(i, inspection);
    if (filter === 'changed' && !changed(i)) return false;
    if (filter === 'pending' && state.statuses[i] !== 'pending') return false;
    if (filter === 'record' && state.statuses[i] !== 'record') return false;
    if (filter === 'issues' && !f.length) return false;
    return !query || `${s.number} ${s.title} ${s.notes}`.toLowerCase().includes(query);
  });
  $('list-count').textContent = `${shown.length} shown`;
  $('slide-list').innerHTML = shown.length ? shown.map(({s,i}) => {
    const f = flags(i, inspection), label = state.mode === 'single' ? 'Notes' : changed(i) ? 'Changed notes' : 'No notes change';
    return `<button class="notes-row${i === state.selected ? ' active' : ''}" type="button" data-slide="${i}" role="listitem" aria-current="${i === state.selected ? 'true' : 'false'}"><strong>${s.number}. ${escape(s.title || 'Untitled slide')}</strong><span>${label} · ${statusLabels[state.statuses[i]]}</span>${f.length ? `<span class="flag">${escape(f.join(' · '))}</span>` : ''}</button>`;
  }).join('') : '<p class="notes-empty" style="padding:15px">No slides match this view.</p>';
}
function renderDetail(inspection) {
  const i = state.selected, slide = state.newDeck.slides[i];
  if (!slide) { $('slide-detail').innerHTML = '<p class="notes-empty">Choose a deck to begin.</p>'; return; }
  const oldIndex = state.pairs[i], old = oldIndex === null ? null : state.oldDeck?.slides[oldIndex];
  const f = flags(i, inspection);
  const matchOptions = state.mode === 'compare' ? `<label>Earlier slide<select id="match-select" class="input"><option value="">No matching slide / new page</option>${state.oldDeck.slides.map((s,j) => `<option value="${j}"${j === oldIndex ? ' selected' : ''}>${s.number}. ${escape(s.title || 'Untitled slide')}</option>`).join('')}</select></label>` : '';
  const statusOptions = Object.entries(statusLabels).map(([value,label]) => `<option value="${value}"${state.statuses[i] === value ? ' selected' : ''}>${label}</option>`).join('');
  const oldText = old?.notes || '', newText = slide.notes;
  const diff = diffText(oldText, newText, $('ignore-space').checked);
  const markup = diff.map(part => part.type === 'same' ? escape(part.text) : part.type === 'remove' ? `<del>${escape(part.text)}</del>` : `<ins>${escape(part.text)}</ins>`).join('') || '<span class="notes-empty">Both pages have empty notes.</span>';
  let content;
  if (state.mode === 'single') content = `<h4>Speaker notes</h4><pre class="notes-single-pre">${escape(newText || '(No speaker notes)')}</pre>`;
  else content = `<div class="notes-mode" role="group" aria-label="Difference view"><button type="button" class="tab" id="view-inline" aria-pressed="${state.view === 'inline'}">Inline changes</button><button type="button" class="tab" id="view-side" aria-pressed="${state.view === 'side'}">Side by side</button></div>${state.view === 'inline' ? `<div class="notes-diff">${markup}</div>` : `<div class="notes-side"><section><h4>Earlier · ${old ? `slide ${old.number}` : 'no match'}</h4><pre>${escape(oldText || '(No speaker notes)')}</pre></section><section><h4>Updated · slide ${slide.number}</h4><pre>${escape(newText || '(No speaker notes)')}</pre></section></div>`}`;
  $('slide-detail').innerHTML = `<div class="notes-detail-head"><div><span class="micro">UPDATED SLIDE ${slide.number} / ${state.newDeck.slides.length}</span><h3>${escape(slide.title || 'Untitled slide')}</h3></div><span class="notes-pill${f.length ? ' warn' : ''}">${escape(f.length ? f[0] : state.mode === 'single' ? 'One deck' : changed(i) ? 'Notes changed' : 'Notes unchanged')}</span></div><p class="notes-info">${state.mode === 'compare' ? `Earlier: ${old ? `slide ${old.number}` : 'no match'} · Updated: slide ${slide.number}` : `Slide ${slide.number}`}</p><div class="notes-detail-controls">${matchOptions}<label>Decision<select id="status-select" class="input">${statusOptions}</select></label></div>${f.length ? `<p class="notice">${escape(f.join(' · '))}</p>` : ''}${state.uncertain.has(i) && old ? '<button id="confirm-match" class="btn small" type="button">Confirm this page match ✓</button>' : ''}${content}<div class="actions-row"><button id="copy-notes" class="btn small" type="button">Copy updated notes</button></div><p id="detail-status" class="feedback" role="status" aria-live="polite"></p>`;
}
function render() {if (!state.newDeck) return; const inspection = summary(); renderList(inspection); renderDetail(inspection);}

$('mode-compare').addEventListener('click', () => {if (state.mode !== 'compare' && state.newDeck) clearSession(); setMode('compare');});
$('mode-single').addEventListener('click', () => {if (state.mode !== 'single' && state.newDeck) clearSession(); setMode('single');});
oldInput.addEventListener('change', () => {$('old-name').textContent = oldInput.files[0]?.name || 'Choose the old version';});
newInput.addEventListener('change', () => {$('new-name').textContent = newInput.files[0]?.name || 'Choose the new version';});
$('analyze').addEventListener('click', async () => {
  if (!newInput.files[0] || state.mode === 'compare' && !oldInput.files[0]) {message('load-status', 'Choose the required PPTX file(s) first.', true); return;}
  $('analyze').disabled = true; message('load-status', 'Reading speaker notes locally…');
  try {
    const mode = state.mode;
    const oldDeck = mode === 'compare' ? await readDeck(oldInput.files[0]) : null;
    const newDeck = await readDeck(newInput.files[0]);
    begin(oldDeck, newDeck, mode);
    message('load-status', `Read ${newDeck.slides.length} slides. Check uncertain matches before exporting.`);
  } catch (error) {message('load-status', error.message || 'Could not read the deck.', true);}
  finally {$('analyze').disabled = false;}
});
$('try-demo').addEventListener('click', () => {
  const oldDeck = {name:'training-v1.pptx · sample',slides:[
    {number:1,title:'Welcome',body:'Welcome',notes:'Welcome to the training. Today we cover setup and delivery.'},
    {number:2,title:'Delivery timeline',body:'Delivery timeline 7 days',notes:'The standard delivery time is 7 days. Confirm the customer address.'},
    {number:3,title:'Next steps',body:'Next steps',notes:'Send the follow-up guide after the session.'}]};
  const newDeck = {name:'training-v2.pptx · sample',slides:[
    {number:1,title:'Welcome',body:'Welcome',notes:'Welcome to the training. Today we cover setup and delivery.'},
    {number:2,title:'Delivery timeline',body:'Delivery timeline 10 days',notes:'The standard delivery time is 10 days. Confirm the customer address.'},
    {number:3,title:'New exercise',body:'New exercise',notes:'Ask everyone to try the setup steps.'},
    {number:4,title:'Next steps',body:'Next steps',notes:'Send the follow-up guide after the session.'}]};
  begin(state.mode === 'single' ? null : oldDeck, newDeck, state.mode);
  message('load-status', 'Fictional sample loaded.');
});
$('clear-session').addEventListener('click', clearSession);
$('slide-list').addEventListener('click', event => {
  const button = event.target.closest('[data-slide]'); if (!button) return;
  state.selected = Number(button.dataset.slide); render();
});
$('slide-detail').addEventListener('change', event => {
  if (event.target.id === 'status-select') state.statuses[state.selected] = event.target.value;
  if (event.target.id === 'match-select') {
    const index = event.target.value === '' ? null : Number(event.target.value);
    if (index !== null) {
      const other = state.pairs.findIndex((p,j) => j !== state.selected && p === index);
      if (other >= 0) {state.pairs[other] = null; state.uncertain.add(other); state.statuses[other] = 'pending';}
    }
    state.pairs[state.selected] = index; state.uncertain.delete(state.selected);
    state.statuses[state.selected] = 'pending';
  }
  render();
});
$('slide-detail').addEventListener('click', async event => {
  if (event.target.id === 'view-inline' || event.target.id === 'view-side') {state.view = event.target.id === 'view-inline' ? 'inline' : 'side'; renderDetail(inspectDeck(state.newDeck, terms()));}
  if (event.target.id === 'confirm-match') {state.uncertain.delete(state.selected); render();}
  if (event.target.id === 'copy-notes') {
    try {await navigator.clipboard.writeText(state.newDeck.slides[state.selected].notes); message('detail-status', 'Updated notes copied.');}
    catch {message('detail-status', 'Clipboard unavailable in this browser.', true);}
  }
});
for (const id of ['filter','search','ignore-space','terms','reading-speed']) $(id).addEventListener(id === 'filter' || id === 'ignore-space' ? 'change' : 'input', render);

function filename(suffix, extension) {
  const base = (state.newDeck?.name || 'ppt-notes').replace(/\.pptx.*$/i, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50) || 'ppt-notes';
  return `${base}-${suffix}.${extension}`;
}
function saveText(text, name, type = 'text/plain;charset=utf-8') {download(new Blob([text], {type}), name); message('export-status', `Created ${name}.`);}
function fullScript(indices, heading) {
  const lines = [`${heading}\n${state.newDeck.name}\n`];
  for (const i of indices) {
    const slide = state.newDeck.slides[i];
    lines.push(`\n===== SLIDE ${slide.number}: ${slide.title || 'Untitled'} =====\n${slide.notes || '(No speaker notes)'}\n`);
  }
  return lines.join('');
}
$('export-text').addEventListener('click', () => {
  const selected = state.statuses.map((s,i) => s === 'record' ? i : -1).filter(i => i >= 0);
  if (!selected.length) {message('export-status', 'Mark at least one slide Record first.', true); return;}
  saveText(fullScript(selected, 'Recording script — slides marked Record'), filename('recording-script','txt'));
});
$('export-all').addEventListener('click', () => saveText(fullScript(state.newDeck.slides.map((_,i) => i), 'All speaker notes'), filename('all-notes','txt')));
$('save-project').addEventListener('click', () => {
  const project = {version:1, mode:state.mode, oldDeck:state.oldDeck, newDeck:state.newDeck, pairs:state.pairs, uncertain:[...state.uncertain], statuses:state.statuses, terms:$('terms').value, ignoreSpace:$('ignore-space').checked, readingSpeed:$('reading-speed').value};
  saveText(JSON.stringify(project, null, 2), filename('review-project','json'), 'application/json');
});
$('project-file').addEventListener('change', async () => {
  const file = $('project-file').files[0]; $('project-file').value = '';
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) {message('load-status', 'Project file is too large.', true); return;}
  try {
    const project = validateProject(JSON.parse(await file.text()));
    state.mode = project.mode; state.oldDeck = project.oldDeck; state.newDeck = project.newDeck;
    state.pairs = project.pairs; state.statuses = project.statuses;
    state.uncertain = new Set((project.uncertain || []).filter(n => Number.isInteger(n) && n >= 0 && n < project.pairs.length));
    state.selected = 0; state.view = 'inline';
    $('filter').value = 'all'; $('search').value = '';
    $('terms').value = typeof project.terms === 'string' ? project.terms.slice(0, 2000) : '';
    $('ignore-space').checked = project.ignoreSpace === true;
    $('reading-speed').value = Number(project.readingSpeed) || 240;
    setMode(project.mode); $('notes-results').hidden = false; render();
    message('load-status', `Project restored: ${state.newDeck.slides.length} slides.`);
    $('notes-results').scrollIntoView({behavior:'smooth', block:'start'});
  } catch (error) {message('load-status', error.message || 'Could not restore the project.', true);}
});
function reportHtml() {
  const inspection = inspectDeck(state.newDeck, terms());
  const rows = state.newDeck.slides.map((s,i) => {
    const oldIndex = state.pairs[i], old = oldIndex === null ? null : state.oldDeck?.slides[oldIndex];
    const diff = state.mode === 'compare' ? diffText(old?.notes || '', s.notes, $('ignore-space').checked)
      .map(p => p.type === 'same' ? escape(p.text) : p.type === 'remove' ? `<del>${escape(p.text)}</del>` : `<ins>${escape(p.text)}</ins>`).join('') : '';
    return `<article><div class="top"><label><input type="checkbox" ${state.statuses[i] === 'done' ? 'checked' : ''}> Slide ${s.number}: ${escape(s.title || 'Untitled')}</label><span>${escape(statusLabels[state.statuses[i]])}</span></div><p class="meta">${state.mode === 'compare' ? `Earlier: ${old ? `slide ${old.number}` : 'no match'} · ${changed(i) ? 'changed notes' : 'unchanged notes'}` : 'Single deck'}${state.uncertain.has(i) ? ' · CHECK PAGE MATCH' : ''}</p>${flags(i, inspection).length ? `<p class="warn">${escape(flags(i, inspection).join(' · '))}</p>` : ''}${state.mode === 'compare' ? `<div class="diff">${diff || '(No speaker notes)'}</div>` : ''}<h3>Updated full script</h3><pre>${escape(s.notes || '(No speaker notes)')}</pre></article>`;
  }).join('');
  const unmatched = state.mode === 'compare' ? state.oldDeck.slides.filter((_,i) => !state.pairs.includes(i)) : [];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Speaker notes checklist</title><style>body{font:16px/1.6 Arial,sans-serif;max-width:900px;margin:30px auto;padding:0 20px;color:#181816}h1{font-size:32px}small,.meta{color:#666}article{border:1px solid #aaa;padding:18px;margin:15px 0;break-inside:avoid}.top{display:flex;justify-content:space-between;gap:15px;font-weight:bold}.top input{width:18px;height:18px}.diff,pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;background:#f8f7f3}del{background:#f9d8d5}ins{background:#d9efcf;text-decoration:none}.warn{color:#8b4a13}h3{font-size:14px;margin-bottom:0}pre{font:15px/1.6 Arial,sans-serif}@media print{body{margin:0}article{page-break-inside:avoid}}</style></head><body><h1>Speaker notes checklist</h1><p>${escape(state.mode === 'compare' ? `${state.oldDeck.name} → ${state.newDeck.name}` : state.newDeck.name)}</p><small>Generated locally. Tick boxes during review; print or save a PDF to keep those marks. This HTML file does not save checkbox changes automatically.</small>${rows}${unmatched.length ? `<h2>Unmatched earlier slides</h2>${unmatched.map(s => `<article><div class="top"><label><input type="checkbox"> Earlier slide ${s.number}: ${escape(s.title || 'Untitled')}</label><span>Unmatched</span></div><pre>${escape(s.notes || '(No speaker notes)')}</pre></article>`).join('')}` : ''}</body></html>`;
}
$('export-html').addEventListener('click', () => saveText(reportHtml(), filename('checklist','html'), 'text/html;charset=utf-8'));

function readingIndices() {return state.statuses.map((s,i) => s === 'record' ? i : -1).filter(i => i >= 0);}
function showPresenter() {
  const items = readingIndices();
  if (!items.length) {message('export-status', 'Mark at least one slide Record to use reading mode.', true); return;}
  state.presenterIndex = Math.min(state.presenterIndex, items.length - 1);
  const slideIndex = items[state.presenterIndex], slide = state.newDeck.slides[slideIndex];
  $('presenter').hidden = false; $('presenter-page').textContent = `Slide ${slide.number}`;
  $('presenter-progress').textContent = `${state.presenterIndex + 1} / ${items.length}`;
  $('presenter-title').textContent = slide.title || 'Untitled slide';
  $('presenter-text').textContent = slide.notes || '(No speaker notes)';
  $('presenter-prev').disabled = state.presenterIndex === 0;
  $('presenter-next').disabled = state.presenterIndex >= items.length - 1;
  $('presenter-done').textContent = state.statuses[slideIndex] === 'done' ? 'Done ✓' : 'Mark done';
  $('presenter-close').focus();
}
$('start-presenter').addEventListener('click', () => {state.presenterIndex = 0; showPresenter();});
$('presenter-close').addEventListener('click', () => {$('presenter').hidden = true; $('start-presenter').focus();});
$('presenter-prev').addEventListener('click', () => {state.presenterIndex--; showPresenter();});
$('presenter-next').addEventListener('click', () => {state.presenterIndex++; showPresenter();});
$('presenter-done').addEventListener('click', () => {
  const index = readingIndices()[state.presenterIndex];
  state.statuses[index] = 'done'; render();
  const more = readingIndices();
  if (!more.length) {$('presenter').hidden = true; message('export-status', 'All marked recording slides are done.'); return;}
  state.presenterIndex = Math.min(state.presenterIndex, more.length - 1); showPresenter();
});
document.addEventListener('keydown', event => {
  if ($('presenter').hidden) return;
  if (event.key === 'Escape') $('presenter-close').click();
  if (event.key === 'ArrowRight' && !$('presenter-next').disabled) $('presenter-next').click();
  if (event.key === 'ArrowLeft' && !$('presenter-prev').disabled) $('presenter-prev').click();
  if (event.code === 'Space' && event.target.tagName !== 'BUTTON') {event.preventDefault(); $('presenter-done').click();}
});
setMode('compare');
