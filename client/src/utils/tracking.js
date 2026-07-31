// ============================================================
// Tracking Configuration
// ============================================================
//
// FB Pixel ID: VITE_FB_PIXEL_ID in client/.env takes priority. If it is not
//              set, the Pixel ID saved in Admin → Facebook Integration is used.
// Google Ads:  Hardcoded in index.html (gtag AW-10976080417)
// GA4:         Hardcoded in index.html (G-9JFTTEVSL0)
// GTM / LinkedIn: set VITE_GTM_ID / VITE_LINKEDIN_PARTNER_ID in .env
// ============================================================

import { initAttribution } from './attribution';
import api from '../services/api';

// Read pixel IDs directly from Vite env vars
const ENV_FB_PIXEL_ID   = import.meta.env.VITE_FB_PIXEL_ID       || null;
const GTM_ID            = import.meta.env.VITE_GTM_ID            || null;
const LINKEDIN_PARTNER  = import.meta.env.VITE_LINKEDIN_PARTNER_ID || null;

// Resolved at init — either from the env var or from admin settings
let FB_PIXEL_ID = ENV_FB_PIXEL_ID;

let isInitialized = false;

const loadFacebookPixel = (pixelId) => {
  if (!pixelId) return;
  FB_PIXEL_ID = pixelId;

  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
};

// 1. Initialize all tracking platforms once (called from MainLayout on mount)
export const initTracking = () => {
  // Always run first-touch attribution check on page load/init
  initAttribution();

  if (isInitialized) return;
  isInitialized = true;

  // Facebook Pixel — the env var wins so a deploy-time override is always
  // authoritative; otherwise fall back to the Pixel ID saved in the admin panel.
  if (ENV_FB_PIXEL_ID) {
    loadFacebookPixel(ENV_FB_PIXEL_ID);
  } else {
    api.get('/settings/facebook')
      .then((res) => loadFacebookPixel(res.data?.pixelId))
      .catch(() => { /* tracking is best-effort — never block the page */ });
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
