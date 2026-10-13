# UnjamKit search visibility

## Batch Rename addition (2026-10-13)

`/batch-rename/` renames up to 200 files in the browser with rules (prefix, suffix, find and replace, new text, numbering) or a two-column old → new list pasted from Excel or loaded as CSV (UTF-8 or GBK). Every new name is previewed and downloads are blocked on duplicates (case-insensitive), Windows-invalid characters, reserved names, trailing dots/spaces and, in list mode, files without a row. Output is a stored ZIP of the original bytes under the new names plus `rename-list.csv`. Main intent: "batch rename files", "rename files from Excel list". Secondary: "add sequential numbers to file names", "bulk rename without installing software". Facts table, FAQPage, WebApplication JSON-LD, homepage card and ItemList, sitemap, llms.txt and About list updated. CSP with `connect-src 'none'` and no analytics, like the other file pages.

Same day, extended: saved rule templates (localStorage + JSON export/import), drag/↑↓ manual order, remove first/last N characters, letter case, regex find/replace, `{name}`/`{date}`/`{modified}` placeholders, XLSX name lists (SheetJS loaded on demand), and undo by loading the tool's own rename-list.csv (columns swapped automatically). New guide `/guides/rename-files-from-excel-list/` (PowerShell, cmd ren, Mac Terminal, then the tool), linked from the tool's facts table, guides index, sitemap and llms.txt.

## GEO pass (2026-10-13)

Aimed at AI answer engines (ChatGPT search, Copilot, Perplexity, Google AI features) as well as classic search. Changes:

- Image Fit title, description, schema, steps, use cases and FAQ now describe PDF compression too; a FAQ that still said "images only" was corrected.
- Each tool page has an "at a glance" facts table (input, output, limits, what it does not do, upload, price), a visible "Last updated" date, and `datePublished`/`dateModified`, `publisher` and `featureList` in JSON-LD.
- Tool pages now add FAQPage markup generated from their visible FAQ. Google limits the FAQ rich result, but Bing and other engines still read it; the earlier "no FAQPage" choice was reversed for that reason.
- New `/about/` page (who runs the site, how processing works, how to check in the browser's Network panel that files are not uploaded, what is collected) and an `Organization` node on the homepage with `sameAs` links.
- New `/guides/` with five answer-first articles that cover native fixes before the matching tool: Excel leading zeros, HEIC, getting a photo under 200 KB, shrinking a PDF for a portal, comparing PowerPoint speaker notes.
- Sitemap carries real `lastmod` dates and the new pages plus `/contact/`. `/llms.txt` summarizes the tools and guides.
- IndexNow: the key file at the root and `.github/workflows/indexnow.yml` submit changed sitemap pages after each GitHub Pages deployment (run it manually to submit everything).

When a page changes, update its visible date, `dateModified` and the sitemap `lastmod` together.

## HEIC Convert addition (2026-10-08)

`/heic-to-jpg/` converts HEIC/HEIF photos to JPG or one combined PDF in the browser. Main intent: "HEIC to JPG" (iPhone photos a PC, portal or form will not open). Secondary: "HEIC to PDF", "convert multiple HEIC to JPG", combining phone photos of receipts or documents into one PDF. The URL, title, H1, description, social metadata and homepage card use that wording. Visible content adds steps, two use cases, an eight-question FAQ (JPG, PDF, privacy, quality, metadata, Live Photos/bursts/HDR, mixing JPG/PNG, iPhone's own settings) and related links to Image Fit and PDF Stack, which also link back. JSON-LD adds WebPage, BreadcrumbList and a free WebApplication with a feature list matching the controls. No FAQPage markup. The homepage ItemList and sitemap include the page.

## PPT Notes Compare addition (2026-10-03)

`/ppt-notes/` is a browser-only page for comparing PowerPoint speaker notes and preparing a recording checklist, with one-deck notes export as a second entry. The homepage links to it, and the canonical page is included in the sitemap. The visible page names matching uncertainty, file limits and the difference between a text change and a rerecording decision.

Main intent: "compare PowerPoint speaker notes" (two versions of a PPTX). Secondary: "extract speaker notes from PPTX", rerecording a narrated course after slide updates, finding outdated wording in notes. The H1, title, description, Open Graph/Twitter metadata and homepage card use that wording. Visible content adds use cases, an eight-question FAQ (comparison, moved slides, one-deck extraction, rerecording decisions, privacy, Google Slides/Keynote/.ppt conversion, non-Latin scripts, scope limits) and related tool links. JSON-LD adds WebPage, BreadcrumbList and a free WebApplication with a feature list matching the visible controls, plus the user guide PDF as `subjectOf`. FAQ content is visible HTML only; no FAQPage markup is used, since Google limits that rich result to authoritative government and health sites. The practice decks and guide in `ppt-notes/guide/` are linked from the page and need no sitemap entry.

## CSV to Excel addition (local, 2026-09-30)

`/csv-to-excel/` targets "CSV to Excel without losing leading zeros" and related searches about long IDs and SKU values changing when Excel opens a CSV. Its visible introduction and first FAQ explain the key timing: Excel can save a CSV as XLSX, but Save As cannot restore an identifier already changed during CSV import. The page also names Excel's built-in Text import as a valid alternative and limits this tool's promise to preserving values present in the original CSV. The title, description, social metadata, H1, homepage card and WebApplication schema reflect that same behavior. This addition has not yet been published.

This change improves the existing homepage and all six tool pages. It targets concrete tasks while preserving the static architecture and the paper/ink/yellow design. No backend, new tool functionality or ranking guarantees are introduced by the SEO changes. Basic visit statistics were separately added in PR #3; this preview preserves them and the updated privacy disclosure.

## Page intent

| Page | Main search intent | Supported secondary tasks |
| --- | --- | --- |
| / | free office tools; free browser tools | PDF, image, text, list and QR tasks |
| /clean-copy/ | remove PDF line breaks; remove line breaks but keep paragraphs | clean pasted PDF text; optional split-word hyphen cleanup |
| /image-fit/ | compress image to 200 KB; compress image to 100 KB; image size limit | JPG/PNG/WebP input to JPEG; maximum width |
| /pdf-stack/ | merge PDFs; reorder PDF pages | rotate pages; extract selected pages into one PDF |
| /list-match/ | compare two lists; find missing items | compare pasted spreadsheet columns; common/unique values |
| /ppt-notes/ | compare PowerPoint speaker notes | extract notes; recording checklist; script export |
| /batch-rename/ | batch rename files; rename files from an Excel list | sequential numbering; prefix/replace; rename list for delivery |
| /heic-to-jpg/ | HEIC to JPG | HEIC to PDF; batch HEIC conversion; phone photos into one PDF |
| /qr-code/ | free static QR code generator | logo, frames, PNG, browser print-to-PDF |
| /wifi-qr-code/ | Wi-Fi QR code generator | guest Wi-Fi sharing |

These are qualitative task phrases grounded in the actual tools and search language, not measured search-volume estimates. The English site targets English queries; it does not claim localized Chinese search coverage.

## Implemented

- Unique descriptive titles, descriptions and H1s on all seven pages.
- Useful explanations in static HTML, with steps, examples, limitations and visible FAQs. The generator remains above the extended explanations.
- Relevant crawlable tool links and descriptive homepage cards. No thin keyword variants or doorway pages.
- HTTPS canonical URLs, matching social URLs, Open Graph and Twitter metadata, and a 1200 x 630 locally served social image.
- WebSite, CollectionPage/ItemList, WebPage, BreadcrumbList and free WebApplication JSON-LD matching the visible functionality. No fabricated ratings, reviews or unsupported claims.
- robots.txt allows the site and declares sitemap.xml. No blocking of scripts, styles, PDF workers or fonts.
- A sitemap listing the five preferred UnjamKit URLs. It omits invented priorities, change frequencies and lastmod dates.

## QR canonical policy

The two UnjamKit QR pages retain their established cross-domain canonical targets: https://justmakeqr.com/ and https://justmakeqr.com/wifi-qr-code/ . They remain usable and linked from UnjamKit, but are omitted from the UnjamKit canonical sitemap. This consolidates duplicate-page search signals under the independent JustMakeQR URLs; it deliberately does not promise both copies will appear separately in search. Switching to independent ranking for the collection copies would require reviewing this policy and differentiating the pages.

## Honest limits

Clean Copy does not extract PDF text or run OCR. Image Fit outputs JPEG, loses transparency/animation and cannot guarantee readable results at arbitrary small limits. PDF Stack does not edit text, reliably preserve forms/signatures, unlock PDFs, compress PDFs or securely redact content. List Match compares full-line membership, not complete workbook records or fuzzy identities. These boundaries are stated in visible content and no unsupported feature is advertised in schema.

## Validation

The local audit verifies all seven pages (and, since 2026-10-03, `/ppt-notes/`): unique title/H1/canonical, descriptions/social metadata, parseable JSON-LD, correct breadcrumb URLs, unchanged tool controls, existing local resources and fragment links, sitemap-to-canonical consistency and robots.txt. All seven pages were inspected at a 390px mobile viewport with no horizontal overflow. Desktop homepage and Image Fit layouts were visually inspected; browser console checks found no errors. The social image was visually checked. The tool logic files are unchanged.

## After deployment

1. Verify the live HTML and https://unjamkit.com/sitemap.xml and robots.txt.
2. Verify the UnjamKit property in Google Search Console and Bing Webmaster Tools, then submit the sitemap. Existing JustMakeQR verification does not establish UnjamKit ownership.
3. Inspect the homepage and four original-tool URLs, and request indexing where available. Submission does not guarantee indexing or ranking.
4. Use Search Console query/page data after crawling to assess impressions, clicks and actual wording; improve useful content based on evidence rather than keyword repetition.

Google's guidance emphasizes useful visible content, crawlable links and descriptive titles: [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide). The same foundations apply to Google's AI features; no special AI schema or machine-readable AI file is required: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features). Canonical URLs are signals rather than commands: [Canonicalization guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

