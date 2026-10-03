import test from 'node:test';
import assert from 'node:assert/strict';
import {diffText, suggestMatches, inspectDeck, validateProject} from '../ppt-notes-core.mjs';

test('the note diff preserves removed and added text, including Chinese punctuation', () => {
  const parts = diffText('交付周期 7 天。', '交付周期 10 天。');
  assert.equal(parts.filter(p => p.type !== 'add').map(p => p.text).join(''), '交付周期 7 天。');
  assert.equal(parts.filter(p => p.type !== 'remove').map(p => p.text).join(''), '交付周期 10 天。');
  assert.ok(parts.some(p => p.type === 'remove' && p.text.includes('7')));
  assert.ok(parts.some(p => p.type === 'add' && p.text.includes('10')));
  assert.deepEqual(diffText('Hello  world', 'Hello world', true), [{type:'same',text:'Hello world'}]);
});

test('a moved slide is matched by content and an inserted slide stays uncertain', () => {
  const oldSlides = [{title:'Start',body:'Start'},{title:'End',body:'End'}];
  const newSlides = [{title:'End',body:'End'},{title:'New',body:'New'},{title:'Start',body:'Start'}];
  const result = suggestMatches(oldSlides, newSlides);
  assert.deepEqual(result.pairs, [1, null, 0]);
  assert.equal(result.uncertain.size, 0);
});

test('duplicate slide bodies are not treated as an exact unique match', () => {
  const oldSlides = [{title:'A',body:'Same'},{title:'B',body:'Same'}];
  const newSlides = [{title:'B',body:'Same'},{title:'A',body:'Same'}];
  const result = suggestMatches(oldSlides, newSlides);
  assert.deepEqual(result.pairs, [1,0]);
  assert.deepEqual([...result.uncertain], [0,1]);
});

test('checks empty and repeated notes plus chosen old terminology', () => {
  const deck = {slides:[
    {number:1,body:'',notes:''},
    {number:2,body:'',notes:'Delivery in 7 days'},
    {number:3,body:'',notes:'Delivery in 7 days'}]};
  const result = inspectDeck(deck, ['7 days']);
  assert.equal(result[0].empty, true);
  assert.equal(result[1].duplicate, true);
  assert.deepEqual(result[2].terms, ['7 days']);
});

test('saved project rejects duplicate page matching', () => {
  const slide = {number:1,title:'A',body:'A',notes:'Note'};
  const project = {version:1,mode:'compare',oldDeck:{name:'old',slides:[slide]},newDeck:{name:'new',slides:[slide,slide]},pairs:[0,0],statuses:['pending','record']};
  assert.throws(() => validateProject(project), /duplicates/);
  project.pairs = [0,null];
  assert.equal(validateProject(project), project);
});
