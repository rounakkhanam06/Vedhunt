// "View as client / employee" (server/utils/portalPreview.js).
//
// A Super Admin opens the real Client Portal or Employee Portal in a new tab as
// one client / employee. The read-only preview token lives in that tab's
// sessionStorage only — it is sent as X-Preview-Token, never written to the
// portal's own localStorage login, so it cannot replace or log out a real session
// in the same browser, and it is gone when the tab closes.
const KEY = 'portalPreview';
const HASH = '#portal-preview=';
const PATHS = { client: '/client/dashboard', employee: '/employee/dashboard' };

/** Called once on start-up: takes a preview handed over in the URL hash and removes it from the URL. */
export function capturePreviewFromUrl() {
  if (!window.location.hash.startsWith(HASH)) return;
  try {
    const preview = JSON.parse(decodeURIComponent(window.location.hash.slice(HASH.length)));
    if (preview?.kind && preview?.token) sessionStorage.setItem(KEY, JSON.stringify(preview));
  } catch { /* a broken link just opens the portal normally */ }
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

/** The preview this tab is in — for `kind` ('client' | 'employee') when given. */
export function getPreview(kind) {
  try {
    const preview = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    return preview && (!kind || preview.kind === kind) ? preview : null;
  } catch {
    return null;
  }
}

export function endPreview() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  window.close();
  // Tabs not opened by script can't close themselves
  window.location.href = '/admin';
}

/**
 * Super Admin: opens the portal as this client / employee in a new tab.
 * `http` is the Admin panel's axios instance. The tab is opened first so popup blockers allow it.
 */
export async function openPortalPreview(http, kind, id, path = PATHS[kind]) {
  const tab = window.open('', '_blank');
  try {
    const { data } = await http.post(`/admin/portal-preview/${kind}/${id}`);
    const handover = encodeURIComponent(JSON.stringify({ kind, token: data.data.token, name: data.data.name }));
    if (tab) tab.location.href = `${path}${HASH}${handover}`;
  } catch (err) {
    tab?.close();
    throw err;
  }
}
