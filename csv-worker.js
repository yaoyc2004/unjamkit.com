// Dependencies are served with the site. No input data leaves this worker.
importScripts('./vendor/papaparse-5.5.3.min.js');
const modules = Promise.all([import('./vendor/xlsx-0.20.3.mjs'), import('./csv-core.mjs')]);
let text = '', parsed = null;
self.onmessage = async ({data}) => {
  try {
    const [XLSX, {decodeCsv, parseCsv, summarize, exportWorkbook}] = await modules;
    if (data.type === 'load') {
      parsed = null;
      text = decodeCsv(await data.file.arrayBuffer());
      parsed = parseCsv(text, data.delimiter, self.Papa);
      self.postMessage({type: 'preview', summary: summarize(parsed, data.header)});
    } else if (data.type === 'parse') {
      parsed = null;
      parsed = parseCsv(text, data.delimiter, self.Papa);
      self.postMessage({type: 'preview', summary: summarize(parsed, data.header)});
    } else if (data.type === 'export') {
      if (!parsed) throw new Error('Choose a valid CSV first.');
      self.postMessage({type: 'progress', message: 'Building your workbook and checking every cell…'});
      const result = exportWorkbook(parsed, data, XLSX);
      self.postMessage({type: 'exported', ...result}, [result.bytes]);
    }
  } catch (error) {
    self.postMessage({type: 'error', message: error instanceof Error ? error.message : 'The file could not be processed. Try another CSV.'});
  }
};
