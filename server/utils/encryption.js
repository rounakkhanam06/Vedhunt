const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
// Ensure key is exactly 32 bytes
const SECRET_KEY = Buffer.from(
  (process.env.ENCRYPTION_KEY || 'v3dhunt_hrms_sec_key_32_chars_long').substring(0, 32),
  'utf-8'
);
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed, returning source text:', error.message);
    return text;
  }
}

module.exports = { encrypt, decrypt };
