// Client-scope checks for routes behind requirePageAccess on a client-scoped
// page. Every client record points at its client through `client_ref` (the
// Client itself uses its _id), so these cover lists, reads and writes.
const mongoose = require('mongoose');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/** True when the request is limited to a fixed list of clients. */
const isScoped = (req) => req.pageScope?.mode === 'clients';

const clientAllowed = (req, clientRef) =>
  !isScoped(req) || req.pageScope.clients.includes(String(clientRef?._id || clientRef));

/** client_ref value for a list query: the requested client when allowed, else every allowed client. */
const scopedClientRef = (req, requested) => {
  const wanted = requested && isValidId(requested) ? requested : undefined;
  if (!isScoped(req)) return wanted;
  if (wanted) return clientAllowed(req, wanted) ? wanted : { $in: [] };
  return { $in: req.pageScope.clients };
};

/** A record outside the person's clients answers exactly like a missing one. */
const outOfScope = (res, what) => res.status(404).json({ success: false, message: `${what} not found` });

module.exports = { isScoped, clientAllowed, scopedClientRef, outOfScope };
