# UnjamKit search visibility

## PPT Notes Compare addition (2026-10-03)

`/ppt-notes/` is a browser-only page for comparing PowerPoint speaker notes and preparing a recording checklist, with one-deck notes export as a second entry. The homepage links to it, and the canonical page is included in the sitemap. The visible page names matching uncertainty, file limits and the difference between a text change and a rerecording decision.

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

The local audit verifies all seven pages: unique title/H1/canonical, descriptions/social metadata, parseable JSON-LD, correct breadcrumb URLs, unchanged tool controls, existing local resources and fragment links, sitemap-to-canonical consistency and robots.txt. All seven pages were inspected at a 390px mobile viewport with no horizontal overflow. Desktop homepage and Image Fit layouts were visually inspected; browser console checks found no errors. The social image was visually checked. The tool logic files are unchanged.

## After deployment

1. Verify the live HTML and https://unjamkit.com/sitemap.xml and robots.txt.
2. Verify the UnjamKit property in Google Search Console and Bing Webmaster Tools, then submit the sitemap. Existing JustMakeQR verification does not establish UnjamKit ownership.
3. Inspect the homepage and four original-tool URLs, and request indexing where available. Submission does not guarantee indexing or ranking.
4. Use Search Console query/page data after crawling to assess impressions, clicks and actual wording; improve useful content based on evidence rather than keyword repetition.

Google's guidance emphasizes useful visible content, crawlable links and descriptive titles: [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide). The same foundations apply to Google's AI features; no special AI schema or machine-readable AI file is required: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features). Canonical URLs are signals rather than commands: [Canonicalization guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

