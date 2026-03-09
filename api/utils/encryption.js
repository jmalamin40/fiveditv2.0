const crypto = require('crypto');

function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) {
    return Buffer.from(envKey.substring(0, 32), 'utf8');
  }
  return Buffer.from('default-encryption-key-32-chars!!', 'utf8');
}

function decryptPassword(encryptedPassword) {
  if (!encryptedPassword || encryptedPassword.length < 33) return '';
  const algorithm = 'aes-256-cbc';
  const key = getEncryptionKey();
  try {
    const iv = Buffer.from(encryptedPassword.substring(0, 32), 'hex');
    const encrypted = encryptedPassword.substring(32);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return '';
  }
}

function encryptPassword(password) {
  if (!password) return '';
  const algorithm = 'aes-256-cbc';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + encrypted;
}

module.exports = { getEncryptionKey, decryptPassword, encryptPassword };
