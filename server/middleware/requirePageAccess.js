const { pageScope, widestScope } = require('../config/pageAccess');

/**
 * Allow the request when the user may do `action` on `page` — through the
 * page's role permission or a person-wise grant. Sets req.pageScope: null for
 * full access, else the scope the route must apply to every query (see
 * utils/clientScope.js and utils/leadScope.js).
 *
 * For a route several pages share, pass a list of [page, action] pairs:
 * any one of them is enough, and the broadest scope applies.
 */
const requirePageAccess = (page, action) => (req, res, next) => {
  const scope = Array.isArray(page) ? widestScope(req.user, page) : pageScope(req.user, page, action);
  if (scope === false) {
    const label = Array.isArray(page) ? page.map(([p]) => p).join(' or ') : page;
    return res.status(403).json({ success: false, message: `You don't have ${Array.isArray(page) ? 'access' : `${action} access`} to ${label}.` });
  }
  req.pageScope = scope;
  next();
};

module.exports = requirePageAccess;
