# Contact / tool requests

The homepage links to `/contact/` and `/contact/?topic=tool-request`.
The form uses a public Formspree ID, with recipients configured in the service dashboard. No recipient address or email API secret belongs in the static site. It does not use `mailto:` or open the visitor's email app.

## Integration

The configured endpoint is `https://formspree.io/f/maenzgby`. This static HTML/ES-module site uses the vanilla JavaScript AJAX approach through native `fetch`; no React, bundler, CDN SDK, or new backend is needed. The form stays on the contact page when submitted.

The recipient remains configured only in Formspree. Endpoint configuration alone does not verify mailbox delivery.

## Deployment checks

1. Confirm the recipient is configured and verified in the owner's existing Formspree form.
2. Configure spam protection and allowed domains in that account as supported by its plan. The frontend includes Formspree's `_gotcha` honeypot.
3. Deploy the contact page, scripts, styles, and homepage changes together. If the endpoint changes, update only the public form ID in `contact-config.mjs`.
4. Test delivery from the deployed domain with an explicitly authorized test message; verify receipt and reply-to behavior. Test a failed submission as well.

The form enables its fields after the script reads a valid configured ID. If the ID is cleared or invalid, the form is visibly unavailable and its fields stay disabled. A local preview or mocked response does not verify delivery.

Submission uses FormData with an `Accept: application/json` header. Only a successful HTTP response with `ok: true` clears the form. Failed or uncertain requests preserve the draft; duplicate clicks are blocked during a request. There are no file attachments, browser storage writes, or analytics scripts on the contact page.

Feedback is sent to and may be retained by the form provider and recipient. This differs from tool file processing. The page includes a disclosure; the homepage privacy section also distinguishes contact submissions. Do not extend any no-storage claim to feedback.

References: https://formspree.io/blog/formspree-ajax/ and https://help.formspree.io/articles/building-your-form/submit-forms-with-javascript-ajax
