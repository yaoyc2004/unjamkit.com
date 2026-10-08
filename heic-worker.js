// Decodes HEIC/HEIF photos with libheif (WebAssembly) on this device. No network requests.
importScripts('vendor/libheif/libheif-bundle.js');
let ready = null, decoder = null;
const load = () => ready || (ready = Promise.resolve(typeof libheif === 'function' ? libheif() : libheif));

self.onmessage = async ({data: {id, buffer, maxPixels}}) => {
  let images = [];
  try {
    const lib = await load();
    decoder = decoder || new lib.HeifDecoder(); // decode() frees the previous file's context
    images = decoder.decode(new Uint8Array(buffer));
    if (!images.length) throw new Error('No photo was found in this file.');
    const image = images.find((item) => item.is_primary()) || images[0];
    const width = image.get_width(), height = image.get_height();
    if (width * height > maxPixels) throw new Error('This photo is over ' + Math.round(maxPixels / 1e6) + ' megapixels.');
    const pixels = await new Promise((resolve, reject) => {
      image.display({data: new Uint8ClampedArray(width * height * 4), width, height}, (result) => result ? resolve(result.data) : reject(new Error('The photo could not be decoded.')));
    });
    self.postMessage({id, width, height, pixels: pixels.buffer, count: images.length}, [pixels.buffer]);
  } catch (error) {
    self.postMessage({id, error: error && error.message ? error.message : 'The photo could not be decoded.'});
  } finally {
    for (const image of images) try { image.free(); } catch {}
  }
};
