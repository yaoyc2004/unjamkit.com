# Preview validation

- Homepage: category filtering, search and empty-result state checked in the browser.
- Clean Copy: browser example, paragraph preservation, clipboard copy and clear state checked. Core tests cover CRLF, Unicode, spaces, hyphen joins, literal markup and empty input.
- List Match: browser shared and only-A groups checked. Core tests cover deduplication, case settings, whitespace settings, leading-zero IDs and empty lists.
- Image Fit: local synthetic PNG (1200 x 800; approximately 2817 KB) produced a 198.6 KB JPEG under the requested 200 KB limit. Invalid target handling removes stale output and disables downloading. Native browser download completion was not independently confirmed in the in-app browser; output creation and download-control states were checked.
- PDF Stack: two synthetic PDFs loaded as three pages with thumbnails. Reordering, rotation and selection were checked in the browser. The same export function passed engine checks. Independent pypdf readback confirmed the exported test PDF has two pages in B1 then A2 order, with the first rotated 90 degrees and original inputs unchanged.
- Wi-Fi Share: example generated a QR and enabled PNG download; this reuses the previously checked JustMakeQR implementation. Native phone Wi-Fi joining has not been tested here.
- All seven pages checked at a 390 px browser viewport; document content width remained within the available 375 px after scrollbar allowance. Local links, file references, anchors and duplicate IDs passed.
- No public deployment, live-domain configuration or GitHub merge was performed for this new collection.

Chrome extension automation could not select files without its file-URL permission. This is a test-environment limitation, not a permission requirement for ordinary users of the site. Safari/Firefox, large batches, encrypted PDFs and unusual PDFs need additional compatibility testing before claiming broad support.
