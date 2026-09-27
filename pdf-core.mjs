export async function buildPdf(documents,pages,lib,isCurrent=()=>true){
  if(!pages.length)throw new Error('Choose at least one page.');
  const target=await lib.PDFDocument.create();target.setProducer('UnjamKit PDF Stack');
  for(const page of pages){
    if(!isCurrent())throw new Error('Cancelled.');
    const source=documents.find(d=>d.id===page.docId);
    if(!source)throw new Error('The source PDF is no longer available.');
    const [copied]=await target.copyPages(source.pdf,[page.index]);
    if(page.rotation)copied.setRotation(lib.degrees((copied.getRotation().angle+page.rotation)%360));
    target.addPage(copied);
  }
  return target.save();
}
