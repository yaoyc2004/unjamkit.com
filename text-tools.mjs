import {cleanText,compareLists} from './core.mjs';
import {$,message,download,copy} from './common.mjs';
if(document.body.dataset.tool==='clean-copy'){
  const input=$('copy-input'),output=$('copy-output');
  const update=()=>{output.value=cleanText(input.value,{preserveParagraphs:$('keep-paragraphs').checked,trimSpaces:$('trim-spaces').checked,joinHyphens:$('join-hyphens').checked});$('copy-count').textContent=input.value.length+' characters in / '+output.value.length+' out';$('copy-result').disabled=$('download-text').disabled=!output.value;message('copy-status','');};
  for(const id of ['copy-input','keep-paragraphs','trim-spaces','join-hyphens'])$(id).addEventListener('input',update);
  $('copy-example').addEventListener('click',()=>{input.value='A small task should not\nturn into a big detour.\n\nKeep the paragraph.\nLose the awkward line breaks.';update();});
  $('clear-copy').addEventListener('click',()=>{input.value='';update();input.focus();});
  $('copy-result').addEventListener('click',()=>copy(output.value,'copy-status'));
  $('download-text').addEventListener('click',()=>download(new Blob([output.value],{type:'text/plain;charset=utf-8'}),'clean-copy.txt'));update();
}
if(document.body.dataset.tool==='list-match'){
  let group='both',result;
  const tabs=[...document.querySelectorAll('[data-group]')];
  const draw=()=>{$('list-output').value=result[group].join('\n');$('copy-list').disabled=!result[group].length;$('download-lists').disabled=!(result.countA||result.countB);tabs.forEach(t=>{t.setAttribute('aria-pressed',String(t.dataset.group===group));const labels={both:'Both',onlyA:'Only A',onlyB:'Only B'};t.textContent=labels[t.dataset.group]+' ('+result[t.dataset.group].length+')';});$('list-count').textContent=result.countA+' unique in A / '+result.countB+' unique in B';};
  const update=()=>{result=compareLists($('list-a').value,$('list-b').value,{trimSpaces:$('list-trim').checked,ignoreCase:$('ignore-case').checked});draw();message('list-status','');};
  for(const id of ['list-a','list-b','list-trim','ignore-case'])$(id).addEventListener('input',update);
  tabs.forEach(t=>t.addEventListener('click',()=>{group=t.dataset.group;draw();message('list-status','');}));
  $('list-example').addEventListener('click',()=>{$('list-a').value='Alex Chen\nMorgan Lee\nSam Patel\nAlex Chen';$('list-b').value='Morgan Lee\nSam Patel\nTaylor Kim';update();});
  $('clear-lists').addEventListener('click',()=>{$('list-a').value=$('list-b').value='';update();$('list-a').focus();});
  $('copy-list').addEventListener('click',()=>copy($('list-output').value,'list-status'));
  $('download-lists').addEventListener('click',()=>{const text=['IN BOTH LISTS',...result.both,'','ONLY IN A',...result.onlyA,'','ONLY IN B',...result.onlyB].join('\n');download(new Blob([text],{type:'text/plain;charset=utf-8'}),'list-match.txt');});update();
}
