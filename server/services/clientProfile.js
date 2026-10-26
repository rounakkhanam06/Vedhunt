// Validation / normalisation for Client.profile (portfolio fields). Only the
// keys sent are touched, so a partial edit never wipes the rest of the profile.
const mongoose = require('mongoose');

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

const cleanList = (v, max = 30) => {
  const arr = Array.isArray(v) ? v : String(v ?? '').split(',');
  return [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))].slice(0, max);
};

const cleanDate = (v) => {
  if (v === null || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/**
 * @returns { value, errors } — `value` holds only the profile keys that were
 * sent and valid; a key sent as null/'' clears that field.
 */
function sanitizeProfile(input = {}) {
  const value = {};
  const errors = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);

  if (has('logoUrl')) {
    const url = String(input.logoUrl || '').trim();
    if (url && !/^https?:\/\//i.test(url)) errors.push('Logo must be an http(s) URL');
    else value.logoUrl = url;
  }
  if (has('domains')) {
    const domains = cleanList(input.domains, 10).map((d) => d.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase());
    const bad = domains.find((d) => !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/.*)?$/.test(d));
    if (bad) errors.push(`"${bad}" is not a valid domain`);
    else value.domains = domains;
  }
  if (has('sectors')) value.sectors = cleanList(input.sectors);
  if (has('services')) value.services = cleanList(input.services);
  if (has('platforms')) value.platforms = cleanList(input.platforms);

  if (has('accountManager')) {
    if (!input.accountManager) value.accountManager = null;
    else if (!isId(input.accountManager)) errors.push('Invalid account manager');
    else value.accountManager = input.accountManager;
  }
  if (has('dedicatedTeam')) {
    const team = Array.isArray(input.dedicatedTeam) ? input.dedicatedTeam : [];
    const seen = new Set();
    value.dedicatedTeam = [];
    for (const m of team) {
      const employee = m?.employee?._id || m?.employee;
      if (!isId(employee)) { errors.push('Invalid team member'); continue; }
      if (seen.has(String(employee))) continue;
      seen.add(String(employee));
      value.dedicatedTeam.push({ employee, role: String(m.role || '').trim().slice(0, 80) });
    }
  }
  for (const key of ['onboardingDate', 'adAccountLiveDate', 'paymentReceivedDate']) {
    if (!has(key)) continue;
    const d = cleanDate(input[key]);
    if (d === undefined) errors.push(`${key} is not a valid date`);
    else value[key] = d;
  }
  if (has('monthlyAdBudget')) {
    if (input.monthlyAdBudget === null || input.monthlyAdBudget === '') value.monthlyAdBudget = null;
    else {
      const n = Number(input.monthlyAdBudget);
      if (!Number.isFinite(n) || n < 0) errors.push('Monthly ad budget must be a number of zero or more');
      else value.monthlyAdBudget = n;
    }
  }
  if (has('authorisedSignatory')) value.authorisedSignatory = String(input.authorisedSignatory || '').trim().slice(0, 120);

  return { value, errors };
}

/** Cross-field rule, checked against the profile as it will be saved. */
function profileDateErrors(profile = {}) {
  const errors = [];
  if (profile.onboardingDate && profile.adAccountLiveDate && new Date(profile.adAccountLiveDate) < new Date(profile.onboardingDate)) {
    errors.push('Ad account live date cannot be before the onboarding date');
  }
  return errors;
}

/** What an audit entry records about the profile (team, account manager, budget, services). */
const profileAuditSnapshot = (profile = {}) => ({
  accountManager: profile.accountManager ? String(profile.accountManager._id || profile.accountManager) : null,
  dedicatedTeam: (profile.dedicatedTeam || []).map((m) => ({ employee: String(m.employee?._id || m.employee), role: m.role || '' })),
  monthlyAdBudget: profile.monthlyAdBudget ?? null,
  services: profile.services || [],
  sectors: profile.sectors || [],
});

module.exports = { sanitizeProfile, profileDateErrors, profileAuditSnapshot, cleanList };
