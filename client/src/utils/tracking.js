// ============================================================
// Tracking Configuration — config me hi rakha, admin se nahi
// ============================================================
//
// FB Pixel ID: Set VITE_FB_PIXEL_ID in client/.env
// Google Ads:  Hardcoded in index.html (gtag AW-10976080417)
// GA4:         Hardcoded in index.html (G-9JFTTEVSL0)
// GTM / LinkedIn: set VITE_GTM_ID / VITE_LINKEDIN_PARTNER_ID in .env
//
// To change Pixel ID: update client/.env → VITE_FB_PIXEL_ID=<your id>
// ============================================================

// Read pixel IDs directly from Vite env vars — no API call needed
const FB_PIXEL_ID       = import.meta.env.VITE_FB_PIXEL_ID       || null;
const GTM_ID            = import.meta.env.VITE_GTM_ID            || null;
const LINKEDIN_PARTNER  = import.meta.env.VITE_LINKEDIN_PARTNER_ID || null;

let isInitialized = false;

// 1. Initialize all tracking platforms once (called from MainLayout on mount)
export const initTracking = () => {
  if (isInitialized) return;
  isInitialized = true;

  // Facebook Pixel — only injects script if VITE_FB_PIXEL_ID is set
  if (FB_PIXEL_ID) {
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', FB_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  // Google Tag Manager (optional — set VITE_GTM_ID)
  if (GTM_ID) {
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer', GTM_ID);
  }

  // LinkedIn Insight Tag (optional — set VITE_LINKEDIN_PARTNER_ID)
  if (LINKEDIN_PARTNER) {
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(LINKEDIN_PARTNER);
    (function(l) {
    if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
    window.lintrk.q=[]}
    var s = document.getElementsByTagName("script")[0];
    var b = document.createElement("script");
    b.type = "text/javascript";b.async = true;
    b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    s.parentNode.insertBefore(b, s);})(window.lintrk);
  }
};

// 2. Global Conversion Tracker — call this after any lead form is submitted
//    Usage: window.trackConversion({ value: 0, currency: 'INR', service: 'SEO' })
window.trackConversion = (eventDetails = {}) => {
  // Facebook Lead Event
  if (FB_PIXEL_ID && window.fbq) {
    window.fbq('track', 'Lead', eventDetails);
  }

  // Google Ads Conversion (hardcoded label from GetQuote.jsx)
  // Additional gtag conversions can be fired from individual form pages directly

  // Google Analytics 4 (GA4 is hardcoded in index.html)
  if (window.gtag) {
    window.gtag('event', 'generate_lead', {
      ...eventDetails
    });
  }

  // LinkedIn Conversion
  if (LINKEDIN_PARTNER && window.lintrk) {
    window.lintrk('track', { conversion_id: LINKEDIN_PARTNER });
  }
};
