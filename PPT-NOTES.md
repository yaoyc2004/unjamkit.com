# PPT Notes Compare

Page: `/ppt-notes/`. For local preview, serve the repository over HTTP, then open that path. The page uses no external library, backend, analytics script, AI service or browser storage.

## Workflow

- Compare mode reads two PPTX files, extracts slide titles, text and speaker notes, proposes slide matches, and highlights changed note text. Exact unique slide body matches are automatic. Matches based on titles or position are marked uncertain for human review. A manual match can replace an earlier match, leaving the displaced page unmatched.
- One-deck mode extracts and exports all speaker notes without a comparison.
- Each updated slide has a review status: To review, No rerecording, Record or Done. The status is the user's decision, not an automatic importance judgment.
- The review list filters by changed notes, status or attention flags. Attention flags include uncertain matches, empty notes, duplicate notes, changed slide text with unchanged notes, and user-specified old terms. The text diff is inline or side by side. Whitespace-only changes may be ignored.
- HTML checklist contains the full updated script and, in compare mode, note differences. Its checkboxes are printable but are not persisted. The text recording script contains only slides marked Record. All-notes export contains every updated page. The JSON project contains extracted slide body text and notes, matches and decisions and can be imported to resume. Reading mode shows slides marked Record and allows marking them Done. The reading-time estimate uses a user-provided non-space character rate.

## Boundaries

- Standard `.pptx` only: maximum 30 MB and 500 slides per input. ZIP64, split ZIP, encryption and unsupported compression are rejected. XML parts are capped at 4 MB. No file data leaves the page.
- Notes extraction reads standard notes-body placeholders. Slide text is used for page matching and old-term checks. Image text, charts, slide visuals, audio, animation, comments and slide formatting are not interpreted.
- The app does not write to the source PPTX. The saved project is a plain JSON file with extracted presentation text, so it should be handled like the original deck.
- Large unmatched note blocks are shown as full removal and addition when fine-grained diff would be expensive. This keeps the displayed change exact while bounding computation.

## Validation

Run `node --test tests/ppt-notes.test.mjs` for diff, matching, flags and project validation. Verify the page in a browser using the fictional sample and two real or synthetic PPTX files, including moved/inserted slides, Chinese punctuation and empty notes. Check the HTML checklist, text downloads, saved-project round trip and reading mode. The browser's downloads are subject to its normal download settings.
