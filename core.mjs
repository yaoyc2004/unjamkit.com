export function cleanText(text,{preserveParagraphs=true,trimSpaces=true,joinHyphens=false}={}) {
  let value=String(text).replace(/\r\n?/g,'\n');
  if(joinHyphens)value=value.replace(/(\p{L})-\n[ \t]*(?=\p{L})/gu,'$1');
  const groups=preserveParagraphs?value.split(/\n[ \t]*\n+/):[value];
  return groups.map(group=>{
    let result=group.split('\n').map(line=>trimSpaces?line.trim():line).join(' ');
    return trimSpaces?result.replace(/[ \t]+/g,' ').trim():result;
  }).join(preserveParagraphs?'\n\n':' ');
}
export function compareLists(a,b,{trimSpaces=true,ignoreCase=false}={}) {
  const key=s=>ignoreCase?s.toLowerCase():s;
  const parse=value=>{
    const map=new Map();
    for(let row of String(value).replace(/\r\n?/g,'\n').split('\n')){
      if(trimSpaces)row=row.trim();
      if(!row.trim())continue;
      if(!map.has(key(row)))map.set(key(row),row);
    }
    return map;
  };
  const left=parse(a),right=parse(b);
  return {both:[...left].filter(([k])=>right.has(k)).map(([,v])=>v),onlyA:[...left].filter(([k])=>!right.has(k)).map(([,v])=>v),onlyB:[...right].filter(([k])=>!left.has(k)).map(([,v])=>v),countA:left.size,countB:right.size};
}
export function imagePlan(width,height,maxWidth=0){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)throw new Error('Invalid image dimensions.');
  const ratio=maxWidth>0?Math.min(1,maxWidth/width):1;
  return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))};
}
