import {$,message,download,kb} from './common.mjs';
import {imagePlan} from './core.mjs';
import {openPdf,fitPdf,MIN_DPI} from './image-fit-pdf.mjs';
let source=null,kind='',fileName='',originalBytes=0,output=null,outputUrl=null,revision=0;
const isPdf=file=>file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
const closeSource=()=>{if(kind==='pdf')source?.destroy().catch(()=>{});else source?.close();source=null;kind='';};
function mode(next){
  $('fit-width-field').hidden=next==='pdf';$('fit-dpi-field').hidden=next!=='pdf';
  $('fit-shrink-label').textContent=next==='pdf'?'Allow a lower resolution if needed':'Allow smaller dimensions if needed';
  $('fit-download').textContent=next==='pdf'?'Download PDF':'Download JPG';
}
const placeholder=()=>kind==='pdf'?'Page 1 of your fitted PDF appears here.':'Your fitted image appears here.';
const revokeOutput=()=>{output=null;if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=null;$('fit-download').disabled=true;$('fit-result').hidden=true;$('fit-result').removeAttribute('src');$('fit-placeholder').hidden=false;$('fit-placeholder').textContent=placeholder();$('fit-size').textContent='';};
function reset(){revision++;closeSource();mode('');$('fit-file').value='';$('fit-original').textContent='';$('fit-make').disabled=true;revokeOutput();message('fit-status','');}
$('fit-file').addEventListener('change',async()=>{
  const file=$('fit-file').files[0];const ticket=++revision;
  closeSource();revokeOutput();$('fit-make').disabled=true;$('fit-original').textContent='';
  if(!file){mode('');return;}
  if(isPdf(file)){
    mode('pdf');
    if(file.size>50*1024*1024){message('fit-status','Choose a PDF under 50 MB. This keeps processing manageable on your device.',true);return;}
    message('fit-status','Reading the PDF on your device…');
    try{const doc=await openPdf(new Uint8Array(await file.arrayBuffer()));if(ticket!==revision){doc.destroy();return;}
      if(doc.numPages>100){doc.destroy();message('fit-status','This PDF has '+doc.numPages+' pages. Choose a PDF with 100 pages or fewer.',true);return;}
      source=doc;kind='pdf';fileName=file.name.replace(/\.[^.]+$/,'');originalBytes=file.size;$('fit-placeholder').textContent=placeholder();
      $('fit-original').textContent=file.name+' / '+doc.numPages+(doc.numPages===1?' page / ':' pages / ')+kb(file.size);$('fit-make').disabled=false;
      message('fit-status','Ready. Choose a size limit and resolution, then make it fit.');
    }catch(error){if(ticket===revision)message('fit-status',error?.name==='PasswordException'?'Password-protected PDFs are not supported. Choose an unlocked PDF.':'This PDF could not be read. Try another PDF file.',true);}
    return;
  }
  mode('image');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){message('fit-status','Choose a JPG, PNG, WebP or PDF file.',true);return;}
  if(file.size>20*1024*1024){message('fit-status','Choose an image under 20 MB. This keeps processing manageable on your device.',true);return;}
  message('fit-status','Reading the image on your device…');
  try{const bitmap=await createImageBitmap(file);if(ticket!==revision){bitmap.close();return;}
    if(bitmap.width*bitmap.height>40000000){bitmap.close();message('fit-status','This image is over 40 megapixels. Choose a smaller image.',true);return;}
    source=bitmap;kind='image';fileName=file.name.replace(/\.[^.]+$/,'');originalBytes=file.size;$('fit-original').textContent=file.name+' / '+bitmap.width+' × '+bitmap.height+' px / '+kb(file.size);$('fit-make').disabled=false;message('fit-status','Ready. Choose a size limit, then make it fit.');
  }catch{if(ticket===revision)message('fit-status','This image could not be read. Try another JPG, PNG or WebP file.',true);}
});
for(const id of ['fit-target','fit-width','fit-dpi','fit-shrink'])$(id).addEventListener('input',()=>{revision++;revokeOutput();if(source)message('fit-status','Settings changed. Make a new '+(kind==='pdf'?'PDF.':'image.'));});
$('fit-clear').addEventListener('click',reset);
const toBlob=(canvas,quality)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The browser could not encode this image.')),'image/jpeg',quality));
const show=(blob,preview,size)=>{output=blob;outputUrl=URL.createObjectURL(preview);$('fit-result').src=outputUrl;$('fit-result').hidden=false;$('fit-placeholder').hidden=true;$('fit-download').disabled=false;$('fit-size').textContent=size;};
async function makePdf(maxKB){
  const dpi=Number($('fit-dpi').value);
  if(!Number.isFinite(dpi)||dpi<MIN_DPI||dpi>600||dpi%1!==0){message('fit-status','Resolution must be a whole number from '+MIN_DPI+' to 600 DPI.',true);return;}
  const doc=source,ticket=++revision,isCurrent=()=>ticket===revision&&source===doc;
  revokeOutput();$('fit-make').disabled=true;$('fit-file').disabled=true;
  try{
    const result=await fitPdf(doc,{limit:Math.floor(maxKB*1024),dpi,allowLower:$('fit-shrink').checked,isCurrent,progress:text=>{if(isCurrent())message('fit-status',text);}});
    if(!isCurrent())return;
    show(result.blob,result.preview,result.pages+(result.pages===1?' page / ':' pages / ')+result.dpi+' DPI / '+kb(result.blob.size)+' / PDF');
    message('fit-status','Fits under '+maxKB+' KB'+(result.dpi<dpi?' at a lower resolution of '+result.dpi+' DPI':'')+'. Check the pages before using it.'+(result.quality<.35?' A tight limit has reduced image quality.':''));
  }catch(error){if(isCurrent()&&!error.cancelled)message('fit-status',error.message||'Could not process this PDF.',true);}
  finally{$('fit-file').disabled=false;$('fit-make').disabled=!source;}
}
$('fit-make').addEventListener('click',async()=>{
  if(!source)return;
  const maxKB=Number($('fit-target').value),maxWidth=$('fit-width').value===''?0:Number($('fit-width').value);
  if(!Number.isFinite(maxKB)||maxKB<1||maxKB>51200){message('fit-status','Enter a size limit between 1 and 51,200 KB.',true);return;}
  if(kind==='pdf')return makePdf(maxKB);
  if(maxKB>20480){message('fit-status','Enter a size limit between 1 and 20,480 KB.',true);return;}
  if(!Number.isFinite(maxWidth)||maxWidth<0||maxWidth>10000||maxWidth%1!==0){message('fit-status','Maximum width must be a whole number from 1 to 10,000 px, or left blank.',true);return;}
  if($('fit-width').value!==''&&maxWidth===0){message('fit-status','Enter a positive maximum width, or leave it blank.',true);return;}
  const bitmap=source,ticket=++revision,target=Math.floor(maxKB*1024),allowShrink=$('fit-shrink').checked;
  let {width,height}=imagePlan(bitmap.width,bitmap.height,maxWidth),quality=.95;
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  revokeOutput();$('fit-make').disabled=true;$('fit-file').disabled=true;message('fit-status','Fitting the image on your device…');
  try{
    for(let step=0;step<30;step++){
      if(ticket!==revision||source!==bitmap)return;
      canvas.width=width;canvas.height=height;context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);
      let best=await toBlob(canvas,.95);quality=.95;
      if(best.size>target){
        let low=.08,high=.95;best=await toBlob(canvas,low);quality=low;
        if(best.size<=target){for(let k=0;k<8;k++){const mid=(low+high)/2,trial=await toBlob(canvas,mid);if(trial.size<=target){best=trial;quality=mid;low=mid;}else high=mid;}}
        else{
          if(!allowShrink)throw new Error('The limit is too small at these dimensions. Allow smaller dimensions, or raise the KB limit.');
          if(width===1&&height===1)throw new Error('The limit is below the smallest JPEG this browser can produce. Raise the KB limit.');
          const factor=Math.min(.85,Math.sqrt(target/best.size)*.93);
          width=Math.max(1,Math.floor(width*factor));height=Math.max(1,Math.floor(height*factor));await new Promise(resolve=>setTimeout(resolve,0));continue;
        }
      }
      if(ticket!==revision||source!==bitmap)return;
      show(best,best,width+' × '+height+' px / '+kb(best.size)+' / JPEG');
      message('fit-status','Fits under '+maxKB+' KB. Check the preview before using it.'+(quality<.35?' A tight limit has reduced image quality.':''));return;
    }
    throw new Error('Could not reach this limit. Try a larger KB limit.');
  }catch(error){if(ticket===revision)message('fit-status',error.message||'Could not process this image.',true);}
  finally{canvas.width=canvas.height=1;$('fit-file').disabled=false;$('fit-make').disabled=!source;}
});
$('fit-download').addEventListener('click',()=>{if(output)download(output,fileName+(kind==='pdf'?'-fit.pdf':'-fit.jpg'));});
window.addEventListener('pagehide',()=>{if(outputUrl)URL.revokeObjectURL(outputUrl);closeSource();});
