// ============================================================
// Dynamic Campaign & Tracking Configuration
// ============================================================
// Reads tracking configuration dynamically from Admin → Settings → Campaign Control
// (/api/settings/campaigns). If values are enabled in Campaign Control, they are
// loaded and fired dynamically on the client side.
// ============================================================

import { initAttribution } from './attribution';
import api from '../services/api';

let activeCampaignSettings = null;
let isInitialized = false;

// Dynamic loader for Facebook / Meta Pixel
const loadFacebookPixel = (pixelId) => {
  if (!pixelId || window.fbq) return;
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

// Dynamic loader for Google Tag Manager (GTM)
const loadGoogleTagManager = (gtmId) => {
  if (!gtmId || window._gtmLoaded) return;
  window._gtmLoaded = true;
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer', gtmId);
};

// Dynamic loader for LinkedIn Insight Tag
const loadLinkedInInsight = (partnerId) => {
  if (!partnerId || window.lintrk) return;
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(partnerId);
  (function(l) {
    if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
    window.lintrk.q=[]}
    var s = document.getElementsByTagName("script")[0];
    var b = document.createElement("script");
    b.type = "text/javascript";b.async = true;
    b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    s.parentNode.insertBefore(b, s);
  })(window.lintrk);
};

// Dynamic loader for Google Ads config (gtag)
const configureGoogleAds = (googleAdsId) => {
  if (!googleAdsId || !window.gtag) return;
  window.gtag('config', googleAdsId);
};

// 1. Initialize all tracking platforms dynamically
export const initTracking = async () => {
  initAttribution();

  if (isInitialized) return;
  isInitialized = true;

  try {
    const res = await api.get('/settings/campaigns');
    const settings = res.data;
    activeCampaignSettings = settings;

    // 1. Meta (Facebook) Pixel
    if (settings?.facebookPixel?.enabled && settings.facebookPixel.id) {
      loadFacebookPixel(settings.facebookPixel.id);
    } else {
      // Fallback: check legacy Facebook Integration endpoint
      api.get('/settings/facebook')
        .then((fbRes) => {
          if (fbRes.data?.pixelId && !window.fbq) {
            loadFacebookPixel(fbRes.data.pixelId);
          }
        })
        .catch(() => {});
    }

    // 2. Google Tag Manager
    if (settings?.googleTagManager?.enabled && settings.googleTagManager.id) {
      loadGoogleTagManager(settings.googleTagManager.id);
    }

    // 3. Google Ads
    if (settings?.googleAds?.enabled && settings.googleAds.id) {
      configureGoogleAds(settings.googleAds.id);
    }

    // 4. LinkedIn Insight Tag
    if (settings?.linkedInInsight?.enabled && settings.linkedInInsight.id) {
      loadLinkedInInsight(settings.linkedInInsight.id);
    }
  } catch (error) {
    console.error('Error loading dynamic tracking settings:', error);
  }
};

// 2. Global Conversion Tracker — called when lead forms are submitted
export const trackConversion = (eventDetails = {}) => {
  // Facebook Lead Event
  if (window.fbq) {
    window.fbq('track', 'Lead', eventDetails);
  }

  // Google Analytics 4 (GA4 generate_lead)
  if (window.gtag) {
    window.gtag('event', 'generate_lead', {
      ...eventDetails
    });
  }

  // Dynamic Google Ads Conversion
  const googleAds = activeCampaignSettings?.googleAds;
  if (googleAds?.enabled && googleAds.id && googleAds.conversionLabel && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: `${googleAds.id}/${googleAds.conversionLabel}`,
      value: eventDetails.value || 1.0,
      currency: eventDetails.currency || 'INR'
    });
  }

  // LinkedIn Conversion
  const linkedIn = activeCampaignSettings?.linkedInInsight;
  if (linkedIn?.enabled && linkedIn.id && window.lintrk) {
    window.lintrk('track', { conversion_id: linkedIn.id });
  }
};

// Attach to window so existing pages calling window.trackConversion keep working seamlessly
if (typeof window !== 'undefined') {
  window.trackConversion = trackConversion;
}
