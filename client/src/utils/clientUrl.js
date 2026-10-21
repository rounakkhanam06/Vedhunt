// Client sites are entered by hand in the admin, so tolerate a missing protocol.
export const getClientUrl = (url) => {
  const raw = (url || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return parsed.href;
  } catch {
    return null;
  }
};

export const getClientDomain = (url) => {
  const href = getClientUrl(url);
  return href ? new URL(href).hostname.replace(/^www\./, '') : '';
};
