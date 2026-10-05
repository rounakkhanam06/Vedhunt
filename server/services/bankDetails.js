// Employee bank details: validation, encryption at rest and masking.
// Account numbers saved before encryption was introduced are plain text —
// decryptAccount() returns those unchanged, so old and new records both work.
const { encrypt, decrypt } = require('../utils/encryption');

const ENCRYPTED = /^[0-9a-f]{32}:[0-9a-f]+$/i;

const encryptAccount = (n) => (n ? (ENCRYPTED.test(n) ? n : encrypt(String(n))) : '');
const decryptAccount = (n) => (n && ENCRYPTED.test(n) ? decrypt(n) : (n || ''));
const maskAccount = (n) => {
  const plain = decryptAccount(n);
  return plain ? `${'•'.repeat(Math.max(0, plain.length - 4))}${plain.slice(-4)}` : '';
};

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

// Returns { details } or { error }
function validateBankDetails(input = {}) {
  const details = {
    bankName: clean(input.bankName),
    accountName: clean(input.accountName),
    accountNumber: clean(input.accountNumber).replace(/\s+/g, ''),
    ifscCode: clean(input.ifscCode).toUpperCase(),
  };
  if (!details.bankName || !details.accountName || !details.accountNumber || !details.ifscCode) {
    return { error: 'Please fill in bank name, account holder name, account number and IFSC code.' };
  }
  if (!/^[a-zA-Z\s.&'-]{2,80}$/.test(details.bankName)) return { error: 'Bank Name must contain only letters and spaces.' };
  if (!/^[a-zA-Z\s.'-]{2,80}$/.test(details.accountName)) return { error: 'Account Holder Name must contain only letters and spaces.' };
  if (!/^\d{9,18}$/.test(details.accountNumber)) return { error: 'Account Number must be 9–18 digits.' };
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(details.ifscCode)) return { error: 'Invalid IFSC Code format (e.g. HDFC0000123).' };
  return { details };
}

const forStorage = (d = {}) => ({
  bankName: d.bankName || '',
  accountName: d.accountName || '',
  accountNumber: encryptAccount(d.accountNumber),
  ifscCode: d.ifscCode || '',
});

const masked = (d = {}) => ({
  bankName: d.bankName || '',
  accountName: d.accountName || '',
  accountNumber: maskAccount(d.accountNumber),
  ifscCode: d.ifscCode || '',
});

const decrypted = (d = {}) => ({
  bankName: d.bankName || '',
  accountName: d.accountName || '',
  accountNumber: decryptAccount(d.accountNumber),
  ifscCode: d.ifscCode || '',
});

const sameDetails = (a = {}, b = {}) =>
  ['bankName', 'accountName', 'ifscCode'].every((k) => (a[k] || '').toLowerCase() === (b[k] || '').toLowerCase())
  && decryptAccount(a.accountNumber) === decryptAccount(b.accountNumber);

module.exports = { validateBankDetails, forStorage, masked, decrypted, decryptAccount, maskAccount, encryptAccount, sameDetails };
