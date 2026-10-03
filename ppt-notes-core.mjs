import {openPptx} from './ppt-notes-zip.mjs';

const xml = source => {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('A PPTX XML part is invalid.');
  return doc;
};
const children = (node, name) => [...node.childNodes].filter(n => n.nodeType === 1 && n.localName === name);
const descendants = (node, name) => [...node.getElementsByTagName('*')].filter(n => n.localName === name);
const textOf = node => descendants(node, 'p').map(p => {
  let text = '';
  for (const n of p.getElementsByTagName('*')) {
    if (n.localName === 't') text += n.textContent;
    else if (n.localName === 'br') text += '\n';
    else if (n.localName === 'tab') text += '\t';
  }
  return text;
}).join('\n');
const relId = node => [...node.attributes].find(a => a.localName === 'id' && a.namespaceURI?.includes('relationships'))?.value;
const resolvePath = (base, target) => {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const part of target.replaceAll('\\', '/').split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
};
function relationships(source, base) {
  const map = new Map();
  if (!source) return map;
  for (const r of descendants(xml(source), 'Relationship')) {
    if (r.getAttribute('TargetMode') === 'External') continue;
    map.set(r.getAttribute('Id'), {type:r.getAttribute('Type') || '', path:resolvePath(base, r.getAttribute('Target') || '')});
  }
  return map;
}
const relsPath = path => path.replace(/([^/]+)$/, '_rels/$1.rels');
function slideText(source) {
  const doc = xml(source);
  const shapes = descendants(doc, 'sp');
  const blocks = shapes.map(textOf).filter(Boolean);
  const title = shapes.find(s => descendants(s, 'ph').some(p => ['title','ctrTitle'].includes(p.getAttribute('type'))));
  return {title: title ? textOf(title).trim() : (blocks[0] || '').split('\n')[0].trim().slice(0, 100), body: blocks.join('\n').trim()};
}
function notesText(source) {
  if (!source) return '';
  const doc = xml(source);
  return descendants(doc, 'sp')
    .filter(s => descendants(s, 'ph').some(p => p.getAttribute('type') === 'body'))
    .map(textOf).filter(Boolean).join('\n').trim();
}
export async function readDeck(file) {
  const zip = await openPptx(file);
  const manifest = await zip.read('ppt/presentation.xml');
  if (!manifest) throw new Error('The PPTX has no presentation manifest.');
  const rels = relationships(await zip.read('ppt/_rels/presentation.xml.rels'), 'ppt/presentation.xml');
  const ids = descendants(xml(manifest), 'sldId').map(relId);
  if (!ids.length || ids.length > 500) throw new Error('The PPTX must contain 1–500 slides.');
  const slides = [];
  for (let i = 0; i < ids.length; i++) {
    const slidePath = rels.get(ids[i])?.path;
    const source = slidePath && await zip.read(slidePath);
    if (!source) throw new Error(`Slide ${i + 1} could not be read.`);
    const info = slideText(source);
    const slideRels = relationships(await zip.read(relsPath(slidePath)), slidePath);
    const notesPath = [...slideRels.values()].find(r => r.type.endsWith('/notesSlide'))?.path;
    const notes = notesText(notesPath ? await zip.read(notesPath) : null);
    slides.push({number:i + 1, title:info.title, body:info.body, notes});
  }
  return {name:file.name, slides};
}

export const normalize = (value, ignoreSpacing = false) => ignoreSpacing ? String(value).replace(/\s+/gu, '') : String(value);
function uniqueMatch(oldSlides, newSlides, used, result, key, uncertain = null) {
  const counts = new Map();
  const newCounts = new Map();
  for (const s of oldSlides) if (key(s)) counts.set(key(s), (counts.get(key(s)) || 0) + 1);
  for (const s of newSlides) if (key(s)) newCounts.set(key(s), (newCounts.get(key(s)) || 0) + 1);
  for (let i = 0; i < newSlides.length; i++) {
    if (result[i] !== null) continue;
    const value = key(newSlides[i]);
    if (!value || counts.get(value) !== 1 || newCounts.get(value) !== 1) continue;
    const old = oldSlides.findIndex((s, j) => !used.has(j) && key(s) === value);
    if (old >= 0) {result[i] = old; used.add(old); uncertain?.add(i);}
  }
}
export function suggestMatches(oldSlides, newSlides) {
  const pairs = Array(newSlides.length).fill(null), used = new Set(), uncertain = new Set();
  uniqueMatch(oldSlides, newSlides, used, pairs, s => s.body.trim());
  uniqueMatch(oldSlides, newSlides, used, pairs, s => s.title.trim(), uncertain);
  for (let i = 0; i < newSlides.length; i++) {
    if (pairs[i] !== null) continue;
    if (i < oldSlides.length && !used.has(i)) {pairs[i] = i; used.add(i); uncertain.add(i);}
  }
  return {pairs, uncertain};
}

const tokenize = value => value.match(/\p{Script=Han}|[\p{L}\p{N}_]+|[^\p{L}\p{N}_]/gu) || [];
export function diffText(before, after, ignoreSpacing = false) {
  if (ignoreSpacing && normalize(before, true) === normalize(after, true)) return [{type:'same', text:after}];
  const a = tokenize(before), b = tokenize(after);
  const eq = (x,y) => normalize(x, ignoreSpacing) === normalize(y, ignoreSpacing);
  let front = 0, back = 0;
  while (front < a.length && front < b.length && eq(a[front], b[front])) front++;
  while (back < a.length - front && back < b.length - front && eq(a[a.length - 1 - back], b[b.length - 1 - back])) back++;
  const middleA = a.slice(front, a.length - back), middleB = b.slice(front, b.length - back);
  const parts = [];
  const add = (type, value) => {if (!value) return; if (parts.at(-1)?.type === type) parts.at(-1).text += value; else parts.push({type,text:value});};
  add('same', a.slice(0, front).join(''));
  if (middleA.length * middleB.length > 500000) {
    add('remove', middleA.join('')); add('add', middleB.join(''));
  } else {
    const dp = Array.from({length:middleA.length + 1}, () => new Uint16Array(middleB.length + 1));
    for (let i = middleA.length - 1; i >= 0; i--) for (let j = middleB.length - 1; j >= 0; j--)
      dp[i][j] = eq(middleA[i], middleB[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0, j = 0;
    while (i < middleA.length || j < middleB.length) {
      if (i < middleA.length && j < middleB.length && eq(middleA[i], middleB[j])) add('same', middleA[i++]), j++;
      else if (i < middleA.length && (j === middleB.length || dp[i + 1][j] >= dp[i][j + 1])) add('remove', middleA[i++]);
      else add('add', middleB[j++]);
    }
  }
  add('same', a.slice(a.length - back).join(''));
  return parts;
}

export function inspectDeck(deck, terms = []) {
  const duplicates = new Map();
  for (const slide of deck.slides) if (slide.notes.trim()) duplicates.set(slide.notes.trim(), (duplicates.get(slide.notes.trim()) || 0) + 1);
  return deck.slides.map(s => ({
    number:s.number,
    empty:!s.notes.trim(),
    duplicate:!!s.notes.trim() && duplicates.get(s.notes.trim()) > 1,
    terms:terms.filter(t => t && (s.notes.includes(t) || s.body.includes(t)))
  }));
}

export function validateProject(value) {
  if (!value || value.version !== 1 || !['single','compare'].includes(value.mode)) throw new Error('Unsupported project file.');
  const checkDeck = d => d && typeof d.name === 'string' && Array.isArray(d.slides) && d.slides.length <= 500 && d.slides.every(s =>
    Number.isInteger(s.number) && typeof s.title === 'string' && typeof s.body === 'string' && typeof s.notes === 'string' && s.title.length <= 2000 && s.body.length <= 100000 && s.notes.length <= 100000);
  if (!checkDeck(value.newDeck) || (value.mode === 'compare' && !checkDeck(value.oldDeck))) throw new Error('Project content is invalid.');
  if (!Array.isArray(value.pairs) || value.pairs.length !== value.newDeck.slides.length || !value.pairs.every(n => n === null || Number.isInteger(n) && n >= 0 && n < (value.oldDeck?.slides.length || 0))) throw new Error('Project page matching is invalid.');
  if (new Set(value.pairs.filter(n => n !== null)).size !== value.pairs.filter(n => n !== null).length) throw new Error('Project page matching has duplicates.');
  if (!Array.isArray(value.statuses) || value.statuses.length !== value.newDeck.slides.length || !value.statuses.every(s => ['pending','skip','record','done'].includes(s))) throw new Error('Project statuses are invalid.');
  return value;
}
