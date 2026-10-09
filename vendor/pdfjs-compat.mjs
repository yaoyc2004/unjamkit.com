// Polyfills for newer built-ins that PDF.js 5.6 calls without checking, so PDF pages
// also render in browsers released before these APIs (e.g. Chrome < 145, Safari < 26.2).
for(const C of [Map,WeakMap]){
  if(!C.prototype.getOrInsert)C.prototype.getOrInsert=function(key,value){if(!this.has(key))this.set(key,value);return this.get(key);};
  if(!C.prototype.getOrInsertComputed)C.prototype.getOrInsertComputed=function(key,make){if(!this.has(key))this.set(key,make(key));return this.get(key);};
}
if(!Uint8Array.prototype.toHex)Uint8Array.prototype.toHex=function(){let s='';for(const b of this)s+=b.toString(16).padStart(2,'0');return s;};
if(!Uint8Array.prototype.toBase64)Uint8Array.prototype.toBase64=function(){let s='';for(let i=0;i<this.length;i+=32768)s+=String.fromCharCode.apply(null,this.subarray(i,i+32768));return btoa(s);};
if(!Uint8Array.fromBase64)Uint8Array.fromBase64=function(text){const s=atob(String(text).replace(/\s+/g,''));const out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;};
