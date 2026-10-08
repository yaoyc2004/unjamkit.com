import {$, message, download, kb} from './common.mjs';
import {LIMITS, sniffHeif, looksLikeHeicName, outputName, pdfPagePlan, zipStore} from './heic-core.mjs';

let files = [], results = [], pdfBlob = null, worker = null, revision = 0, busy = false;
const pending = new Map();
let nextId = 1;
const native = new WeakSet(); // JPG/PNG/WebP the browser decodes itself (e.g. iPhone Safari may hand over a JPG)
const previewUrls = [];

function getWorker() {
  if (worker) return worker;
  worker = new Worker('../heic-worker.js');
  worker.onmessage = ({data}) => { const job = pending.get(data.id); if (job) { pending.delete(data.id); data.error ? job.reject(new Error(data.error)) : job.resolve(data); } };
  worker.onerror = () => { for (const job of pending.values()) job.reject(new Error('The HEIC decoder could not start in this browser.')); pending.clear(); worker.terminate(); worker = null; };
  return worker;
}
const decode = (buffer) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, {resolve, reject});
  getWorker().postMessage({id, buffer, maxPixels: LIMITS.pixels}, [buffer]);
});

const mode = () => document.querySelector('input[name="heic-format"]:checked').value;

function clearOutput() {
  results = []; pdfBlob = null;
  for (const url of previewUrls.splice(0)) URL.revokeObjectURL(url);
  $('heic-previews').replaceChildren(); $('heic-previews').hidden = true; $('heic-placeholder').hidden = false;
  $('heic-download').disabled = true; $('heic-summary').textContent = '';
  for (const row of document.querySelectorAll('#heic-list li')) { row.querySelector('.heic-state').textContent = row.dataset.note || 'Ready'; row.classList.remove('done', 'failed'); }
}

function renderList() {
  const list = $('heic-list');
  list.replaceChildren(...files.map((file, index) => {
    const row = document.createElement('li');
    const name = document.createElement('span'); name.className = 'heic-name'; name.textContent = file.name;
    const size = document.createElement('span'); size.className = 'heic-size'; size.textContent = kb(file.size);
    const state = document.createElement('span'); state.className = 'heic-state'; state.textContent = 'Ready';
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'heic-remove'; remove.textContent = '×';
    remove.setAttribute('aria-label', 'Remove ' + file.name);
    remove.addEventListener('click', () => { if (busy) return; files.splice(index, 1); revision++; clearOutput(); renderList(); });
    row.append(name, size, state, remove);
    return row;
  }));
  list.hidden = !files.length;
  $('heic-count').textContent = files.length ? files.length + (files.length === 1 ? ' photo' : ' photos') + ' / ' + kb(files.reduce((s, f) => s + f.size, 0)) : '';
  $('heic-convert').disabled = !files.length || busy;
}

async function addFiles(list) {
  if (busy) return;
  const ticket = ++revision; clearOutput();
  const skipped = [];
  for (const file of list) {
    if (files.length >= LIMITS.files) { skipped.push(file.name + ' (over ' + LIMITS.files + ' files)'); continue; }
    if (file.size > LIMITS.bytes) { skipped.push(file.name + ' (over 50 MB)'); continue; }
    if (files.reduce((s, f) => s + f.size, 0) + file.size > LIMITS.total) { skipped.push(file.name + ' (batch over 400 MB)'); continue; }
    const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    if (ticket !== revision) return;
    if (!sniffHeif(head)) {
      if (/^image\/(jpeg|png|webp)$/.test(file.type) && !looksLikeHeicName(file.name)) native.add(file);
      else { skipped.push(file.name + (looksLikeHeicName(file.name) ? ' (not a readable HEIC file)' : ' (not HEIC, JPG, PNG or WebP)')); continue; }
    }
    if (files.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) continue;
    files.push(file);
  }
  $('heic-file').value = '';
  renderList();
  if (skipped.length) message('heic-status', 'Skipped: ' + skipped.join(', ') + '.', true);
  else message('heic-status', files.length ? 'Ready. Choose JPG or PDF, then convert.' : '');
}

const toJpeg = (canvas, quality) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The browser could not create a JPG.')), 'image/jpeg', quality));

async function convert() {
  if (!files.length || busy) return;
  const ticket = ++revision, format = mode(), quality = Number($('heic-quality').value), maxEdge = Number($('heic-size').value);
  clearOutput(); busy = true; setBusy(true);
  const rows = [...document.querySelectorAll('#heic-list li')];
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  const used = new Set();
  let failed = 0;
  try {
    for (let i = 0; i < files.length; i++) {
      if (ticket !== revision) return;
      const file = files[i], state = rows[i].querySelector('.heic-state');
      state.textContent = 'Converting…';
      message('heic-status', 'Converting ' + (i + 1) + ' of ' + files.length + ' on your device…');
      try {
        let decoded, bitmap;
        if (native.has(file)) {
          bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'});
          decoded = {width: bitmap.width, height: bitmap.height, count: 1};
          if (decoded.width * decoded.height > LIMITS.pixels) { bitmap.close(); throw new Error('This photo is over 100 megapixels.'); }
        } else {
          decoded = await decode(await file.arrayBuffer());
          bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray(decoded.pixels), decoded.width, decoded.height));
        }
        if (ticket !== revision) { bitmap.close(); return; }
        const scale = maxEdge ? Math.min(1, maxEdge / Math.max(decoded.width, decoded.height)) : 1;
        const width = Math.max(1, Math.round(decoded.width * scale)), height = Math.max(1, Math.round(decoded.height * scale));
        canvas.width = width; canvas.height = height;
        context.fillStyle = '#fff'; context.fillRect(0, 0, width, height);
        context.imageSmoothingQuality = 'high'; context.drawImage(bitmap, 0, 0, width, height); bitmap.close();
        const blob = await toJpeg(canvas, quality);
        if (ticket !== revision) return;
        results.push({name: outputName(file.name, 'jpg', used), blob, width, height});
        state.textContent = width + ' × ' + height + ' / ' + kb(blob.size); rows[i].classList.add('done');
        if (decoded.count > 1) state.textContent += ' / main photo of ' + decoded.count;
        addPreview(results.at(-1));
      } catch (error) {
        failed++; state.textContent = error.message || 'Could not convert'; rows[i].classList.add('failed');
      } finally { canvas.width = canvas.height = 1; }
    }
    if (!results.length) { message('heic-status', 'No photo could be converted. Check that the files are HEIC photos.', true); return; }
    if (format === 'pdf') {
      message('heic-status', 'Building the PDF…');
      const lib = window.PDFLib;
      if (!lib) throw new Error('The PDF library did not load. Reload the page and try again.');
      const pdf = await lib.PDFDocument.create(); pdf.setProducer('UnjamKit HEIC Convert'); pdf.setCreator('UnjamKit HEIC Convert');
      for (const item of results) {
        if (ticket !== revision) return;
        const image = await pdf.embedJpg(new Uint8Array(await item.blob.arrayBuffer()));
        const plan = pdfPagePlan(item.width, item.height, $('heic-page').value);
        pdf.addPage([plan.pageWidth, plan.pageHeight]).drawImage(image, {x: plan.x, y: plan.y, width: plan.width, height: plan.height});
      }
      const bytes = await pdf.save();
      if (ticket !== revision) return;
      pdfBlob = new Blob([bytes], {type: 'application/pdf'});
    }
    const total = format === 'pdf' ? pdfBlob.size : results.reduce((s, r) => s + r.blob.size, 0);
    $('heic-summary').textContent = format === 'pdf'
      ? 'PDF / ' + results.length + (results.length === 1 ? ' page / ' : ' pages / ') + kb(total)
      : results.length + (results.length === 1 ? ' JPG / ' : ' JPGs / ') + kb(total) + (results.length > 1 ? ' / ZIP download' : '');
    $('heic-download').textContent = format === 'pdf' ? 'Download PDF' : results.length > 1 ? 'Download all (ZIP)' : 'Download JPG';
    $('heic-download').disabled = false;
    message('heic-status', (failed ? failed + ' file' + (failed > 1 ? 's' : '') + ' could not be converted; the rest are ready. ' : 'Done. ') + 'Check the preview before using the files.', failed > 0);
  } catch (error) {
    if (ticket === revision) message('heic-status', error.message || 'Conversion failed.', true);
  } finally { busy = false; setBusy(false); }
}

function addPreview(item) {
  const url = URL.createObjectURL(item.blob); previewUrls.push(url);
  const figure = document.createElement('figure');
  const img = document.createElement('img'); img.src = url; img.alt = 'Preview of ' + item.name; img.loading = 'lazy';
  const caption = document.createElement('figcaption'); caption.textContent = item.name;
  figure.append(img, caption);
  if (mode() === 'jpg') figure.addEventListener('click', () => download(item.blob, item.name));
  figure.title = mode() === 'jpg' ? 'Download ' + item.name : item.name;
  $('heic-previews').append(figure); $('heic-previews').hidden = false; $('heic-placeholder').hidden = true;
}

function setBusy(on) {
  $('heic-convert').disabled = on || !files.length; $('heic-file').disabled = on; $('heic-clear').disabled = on;
  for (const el of document.querySelectorAll('.heic-options input, .heic-options select, .heic-remove')) el.disabled = on;
}

function syncOptions() {
  const pdf = mode() === 'pdf';
  $('heic-page-wrap').hidden = !pdf;
  $('heic-convert').textContent = pdf ? 'Convert to PDF' : 'Convert to JPG';
  revision++; clearOutput();
  if (files.length) message('heic-status', 'Settings changed. Convert again.');
}

$('heic-file').addEventListener('change', () => addFiles([...$('heic-file').files]));
const drop = $('heic-drop');
drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('drag-over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
drop.addEventListener('drop', (event) => { event.preventDefault(); drop.classList.remove('drag-over'); addFiles([...event.dataTransfer.files]); });
for (const el of document.querySelectorAll('input[name="heic-format"], #heic-quality, #heic-size, #heic-page')) el.addEventListener('change', syncOptions);
$('heic-convert').addEventListener('click', convert);
$('heic-clear').addEventListener('click', () => { if (busy) return; revision++; files = []; clearOutput(); renderList(); message('heic-status', ''); });
$('heic-download').addEventListener('click', () => {
  if (mode() === 'pdf' && pdfBlob) download(pdfBlob, results.length === 1 ? outputName(results[0].name, 'pdf') : 'heic-photos.pdf');
  else if (results.length === 1) download(results[0].blob, results[0].name);
  else if (results.length > 1) Promise.all(results.map(async (r) => ({name: r.name, data: new Uint8Array(await r.blob.arrayBuffer())}))).then((entries) => download(zipStore(entries), 'heic-to-jpg.zip'));
});
window.addEventListener('pagehide', () => { for (const url of previewUrls) URL.revokeObjectURL(url); if (worker) worker.terminate(); });
syncOptions();
