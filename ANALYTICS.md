# UnjamKit Analytics

UnjamKit has a separate GA4 property and web stream from JustMakeQR.

- Measurement ID: `G-FMQZG5B3GL`
- Stream name: UnjamKit website
- Stream ID: `15854837850`
- Website: https://unjamkit.com/
- Reporting time zone: America/Toronto
- Enhanced measurement: off

All seven pages load analytics.js. Its production hostname and HTTPS guard prevents localhost/preview traffic. It configures one UnjamKit measurement destination and never reads tool controls, files, filenames, rendered results or QR payloads. Page query strings and fragments are removed; referrers are reduced to their origin. Advertising signals/personalization are disabled in the tag. First-party GA cookies expire after 90 days. Visitor statistics are separate from local file/text processing; the homepage and QR privacy notes disclose this distinction.

No JustMakeQR repository files or existing Analytics settings are changed. No cross-domain linker or shared measurement ID is configured. Google Analytics automatically collects standard visit/device/network information; this is not a claim of zero visitor data collection.

Reference: https://developers.google.com/analytics/devguides/collection/ga4/reference/config
