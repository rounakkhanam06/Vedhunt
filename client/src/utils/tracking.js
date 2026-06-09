import { settingsService } from '../services/settingsService';

let trackingConfig = null;
let isInitialized = false;

// 1. Fetch from session storage or API
export const initTracking = async () => {
  if (isInitialized) return trackingConfig;

  try {
    const cached = sessionStorage.getItem('campaignSettings');
    if (cached) {
      trackingConfig = JSON.parse(cached);
    } else {
      const res = await settingsService.getCampaignSettings();
      if (res.data) {
        trackingConfig = res.data;
        sessionStorage.setItem('campaignSettings', JSON.stringify(trackingConfig));
      }
    }
    
    injectScripts(trackingConfig);
    isInitialized = true;
    return trackingConfig;
  } catch (error) {
    console.error('Failed to initialize tracking:', error);
    return null;
  }
};

// 2. Inject the actual scripts
const injectScripts = (config) => {
  if (!config) return;

  // Facebook Pixel
  if (config.facebookPixel?.enabled && config.facebookPixel?.id) {
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', config.facebookPixel.id);
    window.fbq('track', 'PageView');
  }

  // Google Analytics 4 & Google Ads
  const useGA = config.googleAnalytics?.enabled && config.googleAnalytics?.id;
  const useGAds = config.googleAds?.enabled && config.googleAds?.id;

  if (useGA || useGAds) {
    const script = document.createElement('script');
    script.async = true;
    // Load gtag based on either GA or GAds ID (Google loads both anyway)
    const loadId = useGA ? config.googleAnalytics.id : config.googleAds.id;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${loadId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());

    if (useGA) gtag('config', config.googleAnalytics.id);
    if (useGAds) gtag('config', config.googleAds.id);
  }

  // Google Tag Manager
  if (config.googleTagManager?.enabled && config.googleTagManager?.id) {
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer', config.googleTagManager.id);
  }

  // LinkedIn Insight Tag
  if (config.linkedInInsight?.enabled && config.linkedInInsight?.id) {
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(config.linkedInInsight.id);
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

// 3. Global Conversion Tracker
window.trackConversion = (eventDetails = {}) => {
  if (!trackingConfig) return; // Not initialized or failed

  console.log('Tracking conversion event:', eventDetails);

  // Facebook Lead Event
  if (trackingConfig.facebookPixel?.enabled && window.fbq) {
    window.fbq('track', 'Lead', eventDetails);
  }

  // Google Ads Conversion
  if (trackingConfig.googleAds?.enabled && window.gtag && trackingConfig.googleAds.conversionLabel) {
    window.gtag('event', 'conversion', {
      'send_to': `${trackingConfig.googleAds.id}/${trackingConfig.googleAds.conversionLabel}`,
      'value': eventDetails.value || 0,
      'currency': eventDetails.currency || 'USD'
    });
  }

  // Google Analytics Custom Event
  if (trackingConfig.googleAnalytics?.enabled && window.gtag) {
    window.gtag('event', 'generate_lead', {
      ...eventDetails
    });
  }
  
  // LinkedIn Lead
  if (trackingConfig.linkedInInsight?.enabled && window.lintrk) {
    window.lintrk('track', { conversion_id: trackingConfig.linkedInInsight.id });
  }
};
