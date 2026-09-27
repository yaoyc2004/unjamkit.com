/* UnjamKit GA4: page statistics only; never read tool inputs or files. */
(() => {
  if (location.protocol !== 'https:' || !['unjamkit.com', 'www.unjamkit.com'].includes(location.hostname)) return;
  const id = 'G-FMQZG5B3GL';
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  const page = location.origin + location.pathname;
  let referrer = '';
  try { referrer = document.referrer ? new URL(document.referrer).origin + '/' : ''; } catch {}
  window.gtag('js', new Date());
  window.gtag('config', id, {
    page_location: page,
    page_referrer: referrer,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_expires: 60 * 60 * 24 * 90
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  document.head.appendChild(script);
})();
