const crypto = require('crypto');

// Use environment variable for key, or fallback to default for dev (NEVER use default in prod)
// Key must be 32 bytes (256 bits)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
const IV_LENGTH = 16; // AES block size

/**
 * Encrypts a text string
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted text (iv:encrypted_content)
 */
function encrypt(text) {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        console.error('Encryption Failed:', e.message);
        return null; // Don't crash
    }
}

/**
 * Decrypts an encrypted string
 * @param {string} text - Encrypted text (iv:encrypted_content)
 * @returns {string} - Decrypted original text
 */
function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        if (textParts.length !== 2) return text; // Maybe it wasn't encrypted? Return raw.

        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        console.error('Decryption Failed:', e.message);
        return text; // Return original if decryption fails (fallback)
    }
}

module.exports = { encrypt, decrypt };
