/**
 * Helper to check if a hostname is internal to Vedhunt
 */
const isInternalHost = (hostname) => {
  if (!hostname) return true;
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower === '127.0.0.1' ||
    lower === 'vedhunt.in' ||
    lower.endsWith('.vedhunt.in') ||
    lower === 'vedhunt.com' ||
    lower.endsWith('.vedhunt.com')
  );
};

/**
 * Maps raw utm_source values to user-friendly common sources
 */
const normalizeSource = (src) => {
  if (!src) return 'Direct';
  const clean = src.toLowerCase().trim();
  if (clean.includes('facebook') || clean === 'fb' || clean.includes('fbad')) return 'Facebook';
  if (clean.includes('instagram') || clean === 'ig' || clean.includes('igad')) return 'Instagram';
  if (clean.includes('google') || clean === 'gads' || clean === 'adwords' || clean === 'cpc') return 'Google';
  if (clean.includes('linkedin') || clean === 'li') return 'LinkedIn';
  if (clean.includes('whatsapp') || clean === 'wa') return 'WhatsApp';
  if (clean.includes('twitter') || clean === 't.co' || clean === 'x.com' || clean === 'x') return 'Twitter/X';
  if (clean.includes('youtube') || clean === 'yt') return 'YouTube';
  
  // Return capitalized first letter of the custom source
  return src.charAt(0).toUpperCase() + src.slice(1);
};

/**
 * Identifies the source from the document referrer
 */
const getReferrerSource = () => {
  const referrer = document.referrer;
  if (!referrer) return 'Direct';

  try {
    const referrerUrl = new URL(referrer);
    const hostname = referrerUrl.hostname.toLowerCase();
    
    // Ignore internal referrer navigation
    const currentHost = window.location.hostname.toLowerCase();
    if (hostname === currentHost || isInternalHost(hostname)) {
      return null;
    }

    if (hostname.includes('facebook.com')) return 'Facebook';
    if (hostname.includes('instagram.com')) return 'Instagram';
    if (hostname.includes('google.')) return 'Google';
    if (hostname.includes('linkedin.com') || hostname.includes('lnkd.in')) return 'LinkedIn';
    if (hostname.includes('whatsapp.com') || hostname.includes('wa.me')) return 'WhatsApp';
    if (hostname.includes('twitter.com') || hostname.includes('t.co') || hostname.includes('x.com')) return 'Twitter/X';
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'YouTube';
    
    return 'Referral';
  } catch (e) {
    const clean = referrer.toLowerCase();
    if (clean.includes('facebook')) return 'Facebook';
    if (clean.includes('instagram')) return 'Instagram';
    if (clean.includes('google')) return 'Google';
    if (clean.includes('linkedin')) return 'LinkedIn';
    if (clean.includes('whatsapp')) return 'WhatsApp';
    if (clean.includes('twitter') || clean.includes('t.co') || clean.includes('x.com')) return 'Twitter/X';
    if (clean.includes('youtube')) return 'YouTube';
    return 'Referral';
  }
};

/**
 * Initializes and saves the attribution source and UTMs in localStorage
 * implementing first-touch attribution.
 */
export const initAttribution = () => {
  try {
    const savedSource = localStorage.getItem('vedhunt_user_source');
    const hasSavedUtm = localStorage.getItem('vedhunt_utm_source');

    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const utmCampaign = urlParams.get('utm_campaign');
    const utmContent = urlParams.get('utm_content');
    const utmTerm = urlParams.get('utm_term');

    // 1. Save UTMs on first touch if they are present in URL
    if (!hasSavedUtm && (utmSource || utmMedium || utmCampaign || utmContent || utmTerm)) {
      if (utmSource) localStorage.setItem('vedhunt_utm_source', utmSource);
      if (utmMedium) localStorage.setItem('vedhunt_utm_medium', utmMedium);
      if (utmCampaign) localStorage.setItem('vedhunt_utm_campaign', utmCampaign);
      if (utmContent) localStorage.setItem('vedhunt_utm_content', utmContent);
      if (utmTerm) localStorage.setItem('vedhunt_utm_term', utmTerm);
    }

    // 2. Identify and save the source on first touch
    if (!savedSource) {
      let source = 'Direct';

      if (utmSource) {
        source = normalizeSource(utmSource);
      } else {
        const referrerSource = getReferrerSource();
        // If it returns null, it's internal navigation. We don't overwrite any source, 
        // but if it's the very first page load with no referrer, we treat it as Direct.
        if (referrerSource !== null) {
          source = referrerSource;
        }
      }

      localStorage.setItem('vedhunt_user_source', source);
    }
  } catch (error) {
    console.error('Failed to run first-touch attribution tracking:', error);
  }
};

/**
 * Retrieves the attribution source from localStorage
 */
export const getAttributionSource = () => {
  try {
    return localStorage.getItem('vedhunt_user_source') || 'Direct';
  } catch (e) {
    return 'Direct';
  }
};

/**
 * Retrieves all saved first-touch UTMs from localStorage
 */
export const getSavedUtms = () => {
  try {
    return {
      utmSource: localStorage.getItem('vedhunt_utm_source') || '',
      utmMedium: localStorage.getItem('vedhunt_utm_medium') || '',
      utmCampaign: localStorage.getItem('vedhunt_utm_campaign') || '',
      utmContent: localStorage.getItem('vedhunt_utm_content') || '',
      utmTerm: localStorage.getItem('vedhunt_utm_term') || ''
    };
  } catch (e) {
    return { utmSource: '', utmMedium: '', utmCampaign: '', utmContent: '', utmTerm: '' };
  }
};
