// "View as client / employee": a Super Admin opens the real Client Portal or
// Employee Portal as one client or employee, to see exactly what they see.
//
// The preview token is a normal portal token for that person plus a `preview`
// claim, and it is deliberately weak:
//   • read-only — any request other than GET/HEAD is refused
//   • short-lived (30 minutes), never refreshed
//   • valid only while the Super Admin who opened it is still an active Super Admin
//   • sent in its own header (X-Preview-Token) so it never replaces a real login in
//     that browser, and refused by the Admin panel's auth outright
// Opening a preview is audited (PORTAL_PREVIEW).
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const PREVIEW_HEADER = 'x-preview-token';
const PREVIEW_TTL = '30m';
const KINDS = ['client', 'employee'];

const secretFor = (kind) => (kind === 'client'
  ? process.env.JWT_CLIENT_SECRET || process.env.JWT_SECRET
  : process.env.JWT_SECRET);

/** A preview token for `id` (Client or Admin id); `tv` is the client's tokenVersion. */
function signPreview({ kind, id, tv, by }) {
  if (!KINDS.includes(kind)) throw new Error(`Unknown preview kind: ${kind}`);
  return jwt.sign({ id: String(id), tv, preview: { kind, by: String(by) } }, secretFor(kind), { expiresIn: PREVIEW_TTL });
}

/** The previewing admin, while they are still an active Super Admin; else null. */
async function previewer(byId) {
  const admin = await Admin.findById(byId).select('firstName lastName isActive').populate('roles', 'permissions').lean();
  if (!admin?.isActive) return null;
  const isSuper = (admin.roles || []).some((r) => (r.permissions || []).includes('*'));
  return isSuper ? admin : null;
}

/** The token a portal request carries: the preview header first, then the portal's own cookie / bearer. */
function portalToken(req, cookieName) {
  const preview = req.headers[PREVIEW_HEADER];
  if (preview) return String(preview);
  if (req.cookies?.[cookieName]) return req.cookies[cookieName];
  const auth = req.headers.authorization;
  return auth && auth.startsWith('Bearer') ? auth.split(' ')[1] : null;
}

/**
 * For the portal auth middlewares once the token is verified. Returns null to carry on
 * (setting req.preview for a preview), or [status, body] to refuse the request.
 */
async function checkPreview(req, decoded, kind) {
  if (!decoded.preview) return null;
  if (decoded.preview.kind !== kind) return [401, { success: false, message: 'Not authorized, invalid token' }];
  const by = await previewer(decoded.preview.by);
  if (!by) return [401, { success: false, message: 'This preview has ended.' }];
  if (!['GET', 'HEAD'].includes(req.method)) {
    return [403, { success: false, preview: true, message: 'Preview is read-only — nothing can be changed here.' }];
  }
  req.preview = { kind, by: String(by._id), byName: [by.firstName, by.lastName].filter(Boolean).join(' ') };
  return null;
}

module.exports = { PREVIEW_HEADER, PREVIEW_TTL, signPreview, previewer, portalToken, checkPreview };
