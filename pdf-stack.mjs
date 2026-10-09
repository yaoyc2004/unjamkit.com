import './vendor/pdfjs-compat.mjs';
import * as pdfjs from './vendor/pdfjs/pdf.mjs';
import {$,message,download} from './common.mjs';
import {buildPdf} from './pdf-core.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs-worker.mjs',import.meta.url).href;
const assets=new URL('./vendor/pdfjs/',import.meta.url).href;
let documents=[],pages=[],revision=0,nextId=1,busy=false,totalBytes=0,dragId=null;
const active=()=>pages.filter(p=>p.include);
function state(){
  $('pdf-count').textContent=documents.length+' files / '+pages.length+' pages / '+active().length+' selected';
  $('pdf-save').disabled=busy||!active().length;$('pdf-empty').hidden=pages.length>0;$('pdf-select-all').disabled=!pages.length||busy;
}
function destroyDocs(docs){for(const doc of docs){try{doc.renderTask.destroy().catch(()=>{});}catch{}}}
async function thumbnail(page,holder,epoch){
  try{const doc=documents.find(d=>d.id===page.docId);if(!doc||!holder.isConnected)return;
    const source=await doc.renderer.getPage(page.index+1);if(epoch!==revision||!holder.isConnected)return;
    const rotation=(source.rotate+page.rotation)%360,base=source.getViewport({scale:1,rotation});const view=source.getViewport({scale:Math.min(150/base.width,170/base.height),rotation});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
    await source.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;
    if(epoch===revision&&holder.isConnected)holder.replaceChildren(canvas);source.cleanup();
  }catch{if(holder.isConnected)holder.textContent='Preview unavailable. Page can still be included.';}
}
function draw(){
  const host=$('pdf-pages');host.replaceChildren();const epoch=revision;
  pages.forEach((page,pos)=>{
    const doc=documents.find(d=>d.id===page.docId),card=document.createElement('article');card.className='pdf-card'+(page.include?'':' excluded');card.draggable=!busy;card.dataset.page=String(page.id);
    const holder=document.createElement('div');holder.className='page-preview';const loading=document.createElement('span');loading.textContent='Page '+(page.index+1);holder.append(loading);
    const label=document.createElement('label');label.className='check';const check=document.createElement('input');check.type='checkbox';check.checked=page.include;check.disabled=busy;check.addEventListener('change',()=>{page.include=check.checked;card.classList.toggle('excluded',!page.include);state();});label.append(check,document.createTextNode('Page '+(pos+1)));
    const name=document.createElement('p');name.className='page-source';name.textContent=doc.name+' · source page '+(page.index+1);
    const controls=document.createElement('div');controls.className='page-controls';
    const button=(text,title,disabled,action)=>{const b=document.createElement('button');b.type='button';b.className='icon-btn';b.textContent=text;b.setAttribute('aria-label',title);b.title=title;b.disabled=disabled||busy;b.addEventListener('click',action);controls.append(b);};
    const move=delta=>{const j=pages.findIndex(p=>p.id===page.id),k=j+delta;if(k<0||k>=pages.length)return;[pages[j],pages[k]]=[pages[k],pages[j]];revision++;draw();};
    button('←','Move page '+(pos+1)+' earlier',pos===0,()=>move(-1));button('→','Move page '+(pos+1)+' later',pos===pages.length-1,()=>move(1));
    button('↻','Rotate page '+(pos+1)+' clockwise',false,()=>{page.rotation=(page.rotation+90)%360;revision++;draw();});
    button('×','Remove page '+(pos+1),false,()=>{pages=pages.filter(p=>p.id!==page.id);revision++;draw();});
    card.addEventListener('dragstart',event=>{if(busy){event.preventDefault();return;}dragId=page.id;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(page.id));card.classList.add('dragging');});
    card.addEventListener('dragend',()=>{card.classList.remove('dragging');dragId=null;});card.addEventListener('dragover',event=>{if(dragId!==null&&!busy)event.preventDefault();});
    card.addEventListener('drop',event=>{event.preventDefault();if(dragId===null||busy||dragId===page.id)return;const from=pages.findIndex(p=>p.id===dragId),to=pages.findIndex(p=>p.id===page.id);if(from<0||to<0)return;const [moving]=pages.splice(from,1);pages.splice(to,0,moving);revision++;dragId=null;draw();});
    card.append(holder,label,name,controls);host.append(card);thumbnail(page,holder,epoch);
  });state();
}
$('pdf-files').addEventListener('change',async()=>{
  const files=[...$('pdf-files').files];if(!files.length||busy)return;const epoch=++revision;busy=true;$('pdf-files').disabled=true;draw();message('pdf-status','Reading PDFs on your device…');
  const staged=[];let stagedBytes=0,stagedPages=0;
  try{
    for(const file of files){
      if(!file.name.toLowerCase().endsWith('.pdf'))throw new Error('Choose PDF files only.');
      if(file.size>30*1024*1024||totalBytes+stagedBytes+file.size>60*1024*1024)throw new Error('Use files under 30 MB each and 60 MB in total.');
      const bytes=new Uint8Array(await file.arrayBuffer());const pdf=await window.PDFLib.PDFDocument.load(bytes,{updateMetadata:false});
      if(pages.length+stagedPages+pdf.getPageCount()>150)throw new Error('Keep this batch to 150 pages or fewer.');
      const renderTask=pdfjs.getDocument({data:bytes.slice(),cMapUrl:assets+'cmaps/',cMapPacked:true,standardFontDataUrl:assets+'standard_fonts/',wasmUrl:assets+'wasm/',iccUrl:assets+'iccs/',isEvalSupported:false});
      const renderer=await renderTask.promise;staged.push({id:nextId++,name:file.name,pdf,renderer,renderTask,size:file.size});stagedBytes+=file.size;stagedPages+=pdf.getPageCount();
      if(epoch!==revision){destroyDocs(staged);return;}
    }
    documents.push(...staged);totalBytes+=stagedBytes;
    for(const doc of staged)for(let index=0;index<doc.pdf.getPageCount();index++)pages.push({id:nextId++,docId:doc.id,index,rotation:0,include:true});
    message('pdf-status','Ready. Arrange the pages, then download your PDF.');
  }catch(error){destroyDocs(staged);if(epoch===revision)message('pdf-status',String(error.message).includes('encrypt')||error.name==='PasswordException'?'Encrypted PDFs are not supported. Choose an unlocked PDF.':error.message||'This PDF could not be read.',true);}
  finally{busy=false;$('pdf-files').disabled=false;$('pdf-files').value='';draw();}
});
$('pdf-clear').addEventListener('click',()=>{revision++;destroyDocs(documents);documents=[];pages=[];totalBytes=0;message('pdf-status','');draw();});
$('pdf-select-all').addEventListener('click',()=>{pages.forEach(p=>p.include=true);draw();});
$('pdf-save').addEventListener('click',async()=>{
  if(busy||!active().length)return;const chosen=active().map(p=>({...p})),epoch=revision;busy=true;draw();message('pdf-status','Building your PDF on this device…');
  try{const bytes=await buildPdf(documents,chosen,window.PDFLib,()=>epoch===revision);if(epoch!==revision)return;download(new Blob([bytes],{type:'application/pdf'}),'pdf-stack.pdf');message('pdf-status','Your PDF is ready: '+chosen.length+' pages. Check the saved result.');
  }catch{if(epoch===revision)message('pdf-status','Could not build this PDF. Try a smaller batch or another source file.',true);}
  finally{busy=false;draw();}
});state();
