const mongoose = require('mongoose');
const Client = require('../models/Client');
const Employee = require('../models/Employee');
const requirePageAccess = require('./requirePageAccess');
const { pageScope } = require('../config/pageAccess');

/**
 * Client page access that also includes the clients the person is Account
 * Manager of (Client.profile.accountManager → Employee). Being made a client's
 * account manager is the decision to let that person look after it.
 *
 * - Full access (scope null): unchanged.
 * - A grant limited to some clients: their managed clients are added to it,
 *   for whatever actions that grant gives.
 * - No grant at all: View only, on their managed clients.
 * Create/delete are never widened — those stay with the grant or role.
 */
const WIDEN = ['view', 'edit'];

async function managedClientIds(adminId) {
  if (!mongoose.isValidObjectId(adminId)) return [];
  const employee = await Employee.findOne({ adminId }, '_id').lean();
  if (!employee) return [];
  const clients = await Client.find({ 'profile.accountManager': employee._id, deletedAt: null }, '_id').lean();
  return clients.map((c) => String(c._id));
}

const withManagedClients = (page, action) => {
  const base = requirePageAccess(page, action);
  if (page !== 'clients' || !WIDEN.includes(action)) return base;
  return (req, res, next) => {
    (async () => {
      const scope = pageScope(req.user, page, action);
      if (scope === null) return base(req, res, next);
      if (scope === false && action !== 'view') return base(req, res, next);

      const managed = req.user?._id ? await managedClientIds(req.user._id) : [];
      if (scope === false) {
        if (!managed.length) return base(req, res, next);
        req.pageScope = { mode: 'clients', clients: managed };
        return next();
      }
      if (scope.mode === 'clients') {
        req.pageScope = { ...scope, clients: [...new Set([...(scope.clients || []).map(String), ...managed])] };
        return next();
      }
      return base(req, res, next);
    })().catch(next);
  };
};

module.exports = { withManagedClients, managedClientIds };
