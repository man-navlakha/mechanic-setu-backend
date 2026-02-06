# 🔒 Securing Mechanic Setu API

Here is a comprehensive guide to securing your API. Currently, all endpoints are public, meaning anyone can create, update, or delete data.

## 🛡️ Top 7 Security Recommendations

### 1. **Implement API Authentication (KEY/JWT)**

**Problem:** Anyone can call your API.
**Solution:** Require an API Key or JWT Token in the headers.

#### Option A: Simple API Key (Easiest)

Add a secret key in your `.env` file (e.g., `API_SECRET_KEY=my_secret_123`) and check it in middleware.

```javascript
// Middleware
const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_SECRET_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};
// Apply to routes
app.post('/api/ms-mechanics', authenticate, ...);
```

#### Option B: JWT (JSON Web Tokens) (Best for User Login)

If users log in, issue a JWT token and verify it on every request. This ensures only logged-in users can act.

### 2. **Rate Limiting**

**Problem:** An attacker can spam your API (DDoS) and crash your server or spike your database costs.
**Solution:** Use `express-rate-limit`.

```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);
```

### 3. **Input Validation & Sanitization**

**Problem:** Malicious users can send SQL injection queries or huge payloads.
**Solution:** Validate data types before sending to DB.

- Use `Joi` or `Zod` to validate incoming JSON.
- Ensure latitude/longitude are numbers.
- Ensure strings aren't too long.

### 4. **CORS Configuration**

**Problem:** Malicious websites can make requests to your API from a user's browser.
**Solution:** Restrict `Access-Control-Allow-Origin` to ONLY your frontend domain (e.g., `https://mechanic-setu.com`), not `*`.

```javascript
app.use(cors({
    origin: ['https://your-frontend-domain.com', 'http://localhost:3000']
}));
```

### 5. **Secure HTTP Headers (Helmet)**

**Problem:** Default headers give away server info.
**Solution:** Use `helmet` to set secure HTTP headers automatically.

```javascript
const helmet = require('helmet');
app.use(helmet());
```

### 6. **SQL Injection Protection**

**Good News:** You are already using Parameterized Queries (`values = [$1, $2]`), which protects against SQL Injection.
**Action:** Always maintain this pattern. NEVER do `query('SELECT * FROM users WHERE id = ' + req.params.id)`.

### 7. **Environment Variables**

**Action:** Never commit `.env` to GitHub. You already have it in `.gitignore`, which is great!

---

## 🚀 Implementation Plan (Suggested Order)

1. **Add Rate Limiting:** Prevent abuse immediately.
2. **Add API Key Middleware:** simplest way to stop unauthorized external requests.
3. **Configure CORS:** Lock it down to your frontend.
4. **Helmet:** Easy security win.

### Example: Secure Middleware Setup

```javascript
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// 1. Secure Headers
app.use(helmet());

// 2. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100 
});
app.use(limiter);

// 3. API Key Auth Middleware
app.use((req, res, next) => {
  // Public routes (like GET nearby) might be open
  if (req.method === 'GET') return next();
  
  // Protect Write operations (POST, PATCH, DELETE)
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_SECRET_KEY) {
      return res.status(401).json({ error: 'Unauthorized Access' });
  }
  next();
});
```

### 8. **Content Encryption & Decryption (Cryptography)**

To protect sensitive data (like Aadhaar Card numbers or Phone numbers) even if the database is leaked, you should encrypt specific fields.

#### A. Encryption in Transit (HTTPS)

**Status:** ✅ **Already Handled.**
Since you are deploying to **Vercel**, all traffic is automatically encrypted via **HTTPS (SSL/TLS)**. No action needed.

#### B. Encryption at Rest (Database Layer)

**Status:** ✅ **Likely Handled.**
Neon (PostgreSQL) encrypts data on the disk. However, a database admin can still see the raw data.

#### C. Application-Level Encryption (Recommended for PII)

**Action:** Encrypt sensitive fields (like `adhar_card`) inside your Node.js code *before* sending to the database.

**Algorithm:** Use **AES-256-CBC** (Advanced Encryption Standard).

**How it works:**

1. **User sends:** `"123456789012"` (Raw Aadhaar)
2. **API Encrypts:** `"a1b2c3d4..."` (Gibberish) -> **Saves to DB**
3. **API Reads DB:** `"a1b2c3d4..."` -> **Decrypts** -> `"123456789012"` -> **Sends to Frontend**

---

### 🛡️ Encryption Implementation Example

Create a file `api/crypto.js` to handle this logic.

```javascript
/* api/crypto.js */
const crypto = require('crypto');

// Must be 32 characters long (Store in .env)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; 
const IV_LENGTH = 16; // AES block size

function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return null;
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

module.exports = { encrypt, decrypt };
```

#### Usage in API (`api/index.js`)

```javascript
const { encrypt, decrypt } = require('./crypto');

// CREATE: Encrypt Aadhaar before saving
const adhar_card_encrypted = encrypt(req.body.adhar_card);

// READ: Decrypt before sending back to user
const raw_adhar = decrypt(mechanicFromDb.adhar_card);
```

#### ⚠️ Critical Security Rules for Encryption

1. **NEVER** commit the `ENCRYPTION_KEY` to GitHub.
2. **NEVER** lose the `ENCRYPTION_KEY` (you will lose all data forever).
3. **NEVER** encrypt passwords. **Hash** them using `bcrypt` instead.
