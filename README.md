# UnjamKit

Free browser tools for everyday office snags. Small fixes. Back to work.

| Tool | Task |
| --- | --- |
| Clean Copy | Clean line breaks in text copied from PDFs |
| Image Fit | Fit a JPG, PNG or WebP under a selected KB limit |
| PDF Stack | Merge, select, reorder and rotate PDF pages |
| List Match | Find common and missing items in two lists |
| QR Maker | Create static QR codes with direct destinations |
| Wi-Fi Share | Create Wi-Fi QR codes for guests |

This is the initial beta version. See [VALIDATION.md](VALIDATION.md) for checks and compatibility boundaries.

Serve this directory with any static HTTP server. For example:

    python -m http.server 8768 --bind 127.0.0.1

Then open http://127.0.0.1:8768/ . Use HTTP rather than opening HTML directly, because browsers restrict ES modules and PDF workers on file URLs.

No build step, account system, backend, external font or file upload is used. Tool content is not stored in browser storage. Basic Google Analytics visit statistics use first-party cookies; see [ANALYTICS.md](ANALYTICS.md) for the separate UnjamKit property and data boundaries. The server serves static files only. PDF libraries, worker, fonts and decoding resources are vendored locally. Clipboard access and downloads follow the browser's permissions and settings.

QR and Wi-Fi QR reuse the existing [JustMakeQR](https://justmakeqr.com/) implementation. Their canonicals still point to the independent public JustMakeQR pages. The collection's custom domain is not configured yet; homepage canonical, social URLs and sitemap should be set when it is connected. There is no CNAME file. The .nojekyll file allows the site to be served without a Jekyll build if GitHub Pages is enabled later.

Image Fit: one JPG/PNG/WebP at a time, JPEG output, up to 20 MB / 40 megapixels. The maximum size uses 1 KB = 1,024 bytes. Tiny limits can reduce quality or dimensions.

PDF Stack: standard unlocked PDFs, 30 MB per file / 60 MB total / 150 pages. Forms, bookmarks and signatures may not survive rebuilding. Secure redaction and text editing are outside its scope.

The privacy statements describe this version. Any future analytics, advertising or hosting change requires reviewing them against actual behavior.

