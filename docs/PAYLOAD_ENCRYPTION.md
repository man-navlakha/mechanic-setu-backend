# 🕵️‍♂️ Hiding Data from Network Tab (Payload Encryption)

This guide shows how to encrypt your API responses so they appear as **unreadable garbage** in the Browser's Network Tab.

---

## 📸 The Result

**Before (Normal):**
Network Tab Response:

```json
{
  "full_name": "Raju Bhai",
  "phone": "+919876543210",
  "status": "ONLINE"
}
```

*(Anyone inspecting the page can steal this)*

**After (Encrypted):**
Network Tab Response:

```json
{
  "payload": "U2FsdGVkX1+s34...98s7f=:"
}
```

*(Completely unreadable in Network Tab)*

---

## 🛠️ Step 1: Update Backend (Node.js)

We will create a helper to send encrypted responses.

### A. Install CryptoJS (Standard library for cross-platform crypto)

Run this terminal command:

```bash
npm install crypto-js
```

### B. Updated `api/crypto.js`

Update your crypto file to use `crypto-js` (easiest compatibility with Frontend).

```javascript
const CryptoJS = require("crypto-js");

// SECRET KEY - Must match Frontend!
const SECRET_KEY = process.env.PAYLOAD_SECRET || "my-super-secret-key-123";

const encryptPayload = (data) => {
  return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
};

const decryptPayload = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};

module.exports = { encryptPayload, decryptPayload };
```

### C. Use in your API Routes (`api/index.js`)

Instead of `res.json(data)`, send the encrypted payload.

```javascript
const { encryptPayload } = require('./crypto');

app.get('/api/ms-mechanics', async (req, res) => {
    // ... fetch data from DB ...
    const mechanics = result.rows;

    // 🔒 SECURE SEND
    // res.json({ success: true, mechanics }); // <--- OLD WAY (Visible)
    
    res.json({ 
        success: true, 
        payload: encryptPayload(mechanics) 
    }); // <--- NEW WAY (Hidden)
});
```

---

## 💻 Step 2: Update Frontend (React/JS)

Your frontend needs to "unlock" this data to use it.

### A. Install CryptoJS

```bash
npm install crypto-js
```

### B. Create an Axios Interceptor (Auto-Decrypt)

This is the best way. It automatically decrypts EVERY response so you don't have to change your component code.

```javascript
import axios from 'axios';
import CryptoJS from 'crypto-js';

const SECRET_KEY = "my-super-secret-key-123"; // MUST MATCH BACKEND

const api = axios.create({
  baseURL: 'http://localhost:3000/api'
});

// Response Interceptor
api.interceptors.response.use(response => {
  // Check if response has encrypted payload
  if (response.data && response.data.payload) {
    try {
      // 🔓 DECRYPT HERE
      const bytes = CryptoJS.AES.decrypt(response.data.payload, SECRET_KEY);
      const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      
      // Replace the encrypted garbage with real data
      response.data = { ...response.data, ...decryptedData };
      delete response.data.payload; 
      
    } catch (e) {
      console.error("Failed to decrypt secure payload");
    }
  }
  return response;
});

export default api;
```

---

## 🛡️ Step 3: Field Masking (Extra Security)

For extremely sensitive fields (like Aadhaar/Phone), do not send the full number even encrypted, unless absolutely necessary.

**Backend Logic:**

```javascript
const safeMechanics = mechanics.map(m => ({
    ...m,
    adhar_card: "XXXXXXXX" + m.adhar_card.slice(-4), // Only send last 4 digits
    phone: m.phone.slice(0, 2) + "******" + m.phone.slice(-2) // Mask middle
}));

res.json({ payload: encryptPayload(safeMechanics) });
```

---

## ⚠️ Important Note

While this "hides" data from the **Network Tab**, a skilled hacker can still find the `SECRET_KEY` in your frontend JavaScript code.

**This method is great for:**

1. Hiding business logic/data from casual snooping.
2. Preventing users from easily scraping your API.
3. Obfuscating ID structures.

**It is NOT a replacement for Authentication.** Always check `API Keys` or `JWT` on the backend.
