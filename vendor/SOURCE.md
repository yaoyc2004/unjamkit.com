# Bundled browser dependencies

- pdf-lib 1.17.1, MIT, https://github.com/Hopding/pdf-lib ; copied from the bundled workspace runtime. License: pdf-lib-LICENSE.md.
- PDF.js (pdfjs-dist) 5.6.205, Apache-2.0, https://github.com/mozilla/pdf.js ; copied from the bundled workspace runtime. License: pdfjs/LICENSE. Local resources include CMaps, standard fonts, WebAssembly decoders and ICC profiles.
- QRCode.js, https://github.com/davidshimjs/qrcodejs ; reused from the existing JustMakeQR preview. License: qrcode-LICENSE.txt.

All libraries are served from this directory. No CDN requests are required.

- SheetJS Community Edition 0.20.3, Apache-2.0, https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs ; official ESM distribution, downloaded 2026-09-30. License: xlsx-LICENSE.txt. Used for CSV to Excel workbook generation and readback only.
- Papa Parse 5.5.3, MIT, https://raw.githubusercontent.com/mholt/PapaParse/5.5.3/papaparse.min.js ; unmodified upstream browser distribution, downloaded 2026-09-30. License: papaparse-LICENSE.txt. Loaded in the CSV worker with automatic value typing disabled.

SheetJS local modifications: `unescapexml` preserves CRLF instead of normalizing it during readback; `escapexml` escapes literal `_xHHHH_` strings and writes carriage returns as XML character references. These small, marked changes prevent identifier escape sequences from being decoded as different characters and preserve embedded CRLF across independent XML readers. Recheck these patches and the fidelity fixtures before upgrading. SheetJS is used only by CSV to Excel.

- libheif-js 1.23.5 (Emscripten build of libheif), LGPL-3.0, https://github.com/catdad-experiments/libheif-js ; unmodified `libheif-wasm/libheif-bundle.js` from the npm package (WebAssembly embedded), downloaded 2026-10-08. Licenses: libheif/libheif-js-LICENSE.txt and libheif/libheif-LICENSE.txt. It is loaded as a separate file only by heic-worker.js for HEIC Convert, so it can be replaced with another build of the same library.
