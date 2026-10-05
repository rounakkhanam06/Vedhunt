// While an account is still on a temporary password, the only things it may
// do are: identify itself, set a real password, and log out. Everything else
// is refused server-side — the frontend redirect alone could be bypassed by
// opening a portal URL directly.

const PASSWORD_RESET_REQUIRED = {
  success: false,
  code: 'PASSWORD_RESET_REQUIRED',
  message: 'Please set a new password before continuing.',
};

const requestPath = (req) => `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+$/, '');

/**
 * @param {object} req
 * @param {boolean} isTemporary  the account's isTemporaryPassword flag
 * @param {string[]} allowedPaths full paths, e.g. '/api/auth/me'
 * @returns {boolean} true if the request must be blocked
 */
const mustResetPassword = (req, isTemporary, allowedPaths) =>
  Boolean(isTemporary) && !allowedPaths.includes(requestPath(req));

module.exports = { mustResetPassword, PASSWORD_RESET_REQUIRED };
