# CSV to Excel

Local preview: `/csv-to-excel/`. Static HTML, shared site CSS, ES modules and a classic worker. No build step or server processing.

## Data handling

- Only local File objects are read, in a worker. All parsed fields remain strings; every output Data cell has an explicit string type and text number format.
- Inputs, preview rows and output Blob URLs exist only in memory. Clear terminates the worker, clears displayed input content and revokes the output URL. `pagehide` also clears working state. There is no localStorage, sessionStorage, IndexedDB, cookie or service-worker persistence in this tool.
- No analytics script, telemetry or external dependencies are loaded by this page. Its document CSP restricts scripts and workers to this origin and sets `connect-src 'none'`. The worker has no fetch/XHR/beacon/storage calls; it loads only bundled code. Hosting still receives normal static-asset requests.
- Limits: 10 MiB input, 50,000 data records plus an optional header, 256 columns, 250,000 total cells, 32,767 UTF-16 code units per cell. Invalid UTF-8 and unsupported XML control characters are rejected.
- UTF-8 BOM is accepted. Separator choices: comma, semicolon, tab and pipe. Auto-detection probes parsed records; the user can override it. The preview shows up to six data records and eight columns. Full conversion includes all accepted rows and columns.
- OOXML escape-shaped text involving `_x005F_`, including overlapping sequences such as `_x005F_x0041_`, is rejected. Independent readers disagree on how to decode it; the tool will not silently produce a plausible changed identifier.
- Headers, duplicate labels, whitespace, quoted separators, escaped quotes and embedded line breaks remain literal text. Blank records remain as empty rows. One terminal record separator does not create another empty row. Ragged nonblank records and parser quote errors are rejected.
- Header selection affects preview and counts only. The Data sheet is never given an invented header. The optional Conversion notes sheet summarizes rules/counts without duplicating source values.
- Numeric conversion, formula execution, recovery of previously damaged identifiers, alternative encodings, batching and account features are outside this first version.

## Verification

Every generated workbook is read back before a download link is offered. Dimensions, every Data cell's text/type/position, absence of formulas and optional notes are checked. A failed check produces no download.

Run `node tests/csv-excel.test.mjs` for fidelity and input-boundary cases. Then run `python tests/verify-csv.py` in an environment with openpyxl for independent XLSX readback. Generated validation files stay under ignored `work/csv-validation/`.

The bundled SheetJS has small documented fidelity patches: see `vendor/SOURCE.md`. Retest embedded CRLF and literal OOXML escape-shaped identifiers when updating the dependency.

## Checks performed 2026-09-30

- Core tests: UTF-8/BOM, four separators, leading zeros, long IDs, E notation, formula-like strings, Unicode/emoji, literal markup, duplicate headers, quoted commas/quotes/newlines, spaces, empty fields and blank rows, no-header export, notes on/off, header-only export rejection, malformed CSV, dimensions and cell-length limits.
- Independent openpyxl readback confirms exact values and string types for the edge-case workbook, including non-overlapping literal `_xHHHH_` text and embedded CRLF.
- Browser: example preview and workbook generation work in the Codex browser and Chrome. Real UTF-8 BOM/semicolon file selection, duplicate headers and Chinese values checked in the Codex browser. Invalid UTF-8 and inconsistent field counts show errors with no stale download. Changing notes invalidates the previous result. Clear discards the displayed data and disables export.
- Responsive: 390 px viewport checked, both empty and generated states; document width stays within the viewport and the table scrolls within its panel. Desktop preview visually checked. No browser console errors observed during the checked flows.
- Download link creation is verified, but automation did not report a completed native download in either browser. Manual download confirmation and opening the resulting file in desktop Excel remain release checks. Safari/Firefox and low-memory devices are not yet tested.

This is a local implementation for review; nothing has been published.
