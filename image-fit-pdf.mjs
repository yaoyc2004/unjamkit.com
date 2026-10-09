import {PDF_QUALITIES,pickQuality,lowerDpi,pdfRenderScale} from './core.mjs';
const assets=new URL('./vendor/pdfjs/',import.meta.url).href;
export const MIN_DPI=24;
let pdfjs=null;
export async function openPdf(bytes){
  if(!pdfjs){await import('./vendor/pdfjs-compat.mjs');pdfjs=await import('./vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs-worker.mjs',import.meta.url).href;}
  return pdfjs.getDocument({data:bytes,cMapUrl:assets+'cmaps/',cMapPacked:true,standardFontDataUrl:assets+'standard_fonts/',wasmUrl:assets+'wasm/',iccUrl:assets+'iccs/',isEvalSupported:false}).promise;
}
const toJpeg=(canvas,quality)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The browser could not encode this page.')),'image/jpeg',quality));
const cancelled=()=>Object.assign(new Error('Cancelled.'),{cancelled:true});
async function build(lib,pages,k,sizes){
  const pdf=await lib.PDFDocument.create();pdf.setProducer('UnjamKit Image Fit');pdf.setCreator('UnjamKit Image Fit');
  for(let i=0;i<pages.length;i++){
    const image=await pdf.embedJpg(new Uint8Array(await pages[i].blobs[k].arrayBuffer())),{width,height}=sizes[i];
    pdf.addPage([width,height]).drawImage(image,{x:0,y:0,width,height});
  }
  return pdf.save();
}
// Renders every page as a JPEG at `dpi`, picks the best quality that keeps the whole PDF under `limit` bytes,
// and lowers the resolution when even the lowest quality is too large (if allowed).
export async function fitPdf(doc,{limit,dpi,allowLower,isCurrent,progress}){
  const lib=window.PDFLib;if(!lib)throw new Error('The PDF library did not load. Reload the page and try again.');
  const sizes=[];
  for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),view=page.getViewport({scale:1});sizes.push({width:view.width,height:view.height});}
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  try{
    for(let step=0;step<12;step++){
      const pages=[];
      for(let i=1;i<=doc.numPages;i++){
        if(!isCurrent())throw cancelled();
        progress('Rendering page '+i+' of '+doc.numPages+' at '+dpi+' DPI…');
        const page=await doc.getPage(i),view=page.getViewport({scale:pdfRenderScale(sizes[i-1].width,sizes[i-1].height,dpi)});
        canvas.width=Math.max(1,Math.round(view.width));canvas.height=Math.max(1,Math.round(view.height));
        context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
        await page.render({canvasContext:context,viewport:view}).promise;page.cleanup();
        const blobs=[];for(const quality of PDF_QUALITIES)blobs.push(await toJpeg(canvas,quality));
        pages.push({blobs,width:canvas.width,height:canvas.height});
      }
      const totals=PDF_QUALITIES.map((_,k)=>pages.reduce((sum,page)=>sum+page.blobs[k].size,0)+1024+400*pages.length);
      for(let k=pickQuality(totals,limit);k>=0&&k<PDF_QUALITIES.length;k++){
        if(!isCurrent())throw cancelled();
        progress('Building the PDF at '+dpi+' DPI…');
        const bytes=await build(lib,pages,k,sizes);
        if(bytes.length<=limit)return {blob:new Blob([bytes],{type:'application/pdf'}),dpi,quality:PDF_QUALITIES[k],pages:pages.length,preview:pages[0].blobs[k],first:pages[0]};
      }
      if(!allowLower)throw new Error('The limit is too small at '+dpi+' DPI. Allow a lower resolution, or raise the KB limit.');
      const next=lowerDpi(dpi,limit,totals.at(-1));
      if(next<MIN_DPI)throw new Error('Even at a very low resolution this PDF is larger than the limit. Raise the KB limit or remove pages first.');
      dpi=next;await new Promise(resolve=>setTimeout(resolve,0));
    }
    throw new Error('Could not reach this limit. Try a larger KB limit.');
  }finally{canvas.width=canvas.height=1;}
}
