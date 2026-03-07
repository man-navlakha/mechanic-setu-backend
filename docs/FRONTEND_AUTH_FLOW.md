# Frontend Authentication Flow Guide

Complete authentication flow for mechanic-setu application using the backend API.

---

## 📋 Complete Flow Sequence

```
1. User Login/SignUp → POST /users/Login_SignUp/
                ↓
2. Send OTP to Email ← (Automatic from backend)
                ↓
3. User Enters OTP → POST /users/otp-verify/
                ↓
4. Receive: accessToken, refreshToken, userId
                ↓
5. Store tokens in localStorage/sessionStorage
                ↓
6. Set User Details → POST /users/SetUsersDetail/ (if new user)
                ↓
7. Fetch User Profile → GET /Profile/UserProfile/
                ↓
8. Application Ready
```

---

## 🔐 Step 1: Login/SignUp

**Endpoint:** `POST /api/users/Login_SignUp/`

**Request:**
```javascript
const loginRequest = {
  email: 'user@example.com',
  // NO password - OTP based auth
};

fetch('http://localhost:3000/api/users/Login_SignUp/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(loginRequest)
})
.then(res => res.json())
.then(data => {
  // Shows message: "OTP sent to email"
  console.log(data);
});
```

**Response:**
```json
{
  "message": "OTP sent to your email",
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## ✅ Step 2: Verify OTP

**Endpoint:** `POST /api/users/otp-verify/`

**Request:**
```javascript
const otpData = {
  email: 'user@example.com',
  otp: '123456', // User enters this
  userId: 'returned-from-login'
};

fetch('http://localhost:3000/api/users/otp-verify/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include', // Important for cookies
  body: JSON.stringify(otpData)
})
.then(res => res.json())
.then(data => {
  console.log(data);
  // Store tokens
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('userId', data.userId);
});
```

**Response:**
```json
{
  "message": "OTP verified successfully",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "isNewUser": true
}
```

---

## 🔄 Step 3: Resend OTP (if user didn't receive)

**Endpoint:** `POST /api/users/resend-otp/`

**Request:**
```javascript
const resendData = {
  email: 'user@example.com',
  userId: 'returned-from-login'
};

fetch('http://localhost:3000/api/users/resend-otp/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(resendData)
})
.then(res => res.json())
.then(data => {
  console.log(data); // { message: "OTP resent to email" }
});
```

---

## 👤 Step 4: Set User Details (First Time Only)

**Endpoint:** `POST /api/users/SetUsersDetail/`
- **Requires:** Authorization header + CSRF token

**Request:**
```javascript
const userDetails = {
  name: 'John Doe',
  phone: '+91-9999999999',
  address: '123 Main St',
  city: 'Mumbai',
  state: 'Maharashtra',
  zipCode: '400001',
  userType: 'customer' // or 'mechanic'
};

fetch('http://localhost:3000/api/users/SetUsersDetail/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'X-CSRF-Token': localStorage.getItem('csrfToken') // from response
  },
  credentials: 'include',
  body: JSON.stringify(userDetails)
})
.then(res => res.json())
.then(data => {
  console.log('User details saved:', data);
});
```

**Response:**
```json
{
  "message": "User details updated successfully",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+91-9999999999"
  }
}
```

---

## 📱 Step 5: Get User Profile

**Endpoint:** `GET /api/Profile/UserProfile/`
- **Requires:** Authorization header

**Request:**
```javascript
fetch('http://localhost:3000/api/Profile/UserProfile/', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  },
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('User Profile:', data);
});
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+91-9999999999",
  "address": "123 Main St",
  "city": "Mumbai",
  "state": "Maharashtra"
}
```

---

## 🚗 Step 6: Get User Vehicles

**Endpoint:** `GET /api/Profile/UserVehicles/`
- **Requires:** Authorization header

**Request:**
```javascript
fetch('http://localhost:3000/api/Profile/UserVehicles/', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  },
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('User vehicles:', data);
});
```

**Response:**
```json
{
  "vehicles": [
    {
      "id": "vehicle-uuid",
      "userId": "user-uuid",
      "make": "Toyota",
      "model": "Fortuner",
      "year": 2022,
      "licensePlate": "MH01AB1234"
    }
  ]
}
```

---

## 📜 Step 7: Get User History

**Endpoint:** `GET /api/Profile/UserHistory/`
- **Requires:** Authorization header

**Request:**
```javascript
fetch('http://localhost:3000/api/Profile/UserHistory/', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  },
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('Request history:', data);
});
```

---

## 🔑 Step 8: Get Current User Info (/core/me/)

**Endpoint:** `GET /api/core/me/`
- **Requires:** Authorization header

**Request:**
```javascript
fetch('http://localhost:3000/api/core/me/', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  },
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('Current user:', data);
});
```

---

## 🔄 Step 9: Refresh Access Token

**Endpoint:** `POST /api/core/token/refresh/`

**Request:**
```javascript
fetch('http://localhost:3000/api/core/token/refresh/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
})
.then(res => res.json())
.then(data => {
  // Get new access token
  localStorage.setItem('accessToken', data.accessToken);
  console.log('Token refreshed');
});
```

**Response:**
```json
{
  "accessToken": "new-jwt-token",
  "expiresIn": 3600
}
```

---

## 🔓 Step 10: Logout

**Endpoint:** `POST /api/users/logout/`
- **Requires:** Authorization header + CSRF token

**Request:**
```javascript
fetch('http://localhost:3000/api/users/logout/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'X-CSRF-Token': localStorage.getItem('csrfToken')
  },
  credentials: 'include',
  body: JSON.stringify({})
})
.then(res => res.json())
.then(data => {
  // Clear local storage
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('csrfToken');
  console.log('Logged out');
  // Redirect to login
  window.location.href = '/login';
});
```

---

## 🔑 Step 11: Google Login

**Endpoint:** `POST /api/users/google/`

**Request:**
```javascript
// After getting Google token from react-google-login or similar
const googleData = {
  googleToken: 'google-id-token-from-client'
};

fetch('http://localhost:3000/api/users/google/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify(googleData)
})
.then(res => res.json())
.then(data => {
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  console.log('Google login successful');
});
```

---

## 🛠️ Helper Functions (React Example)

```javascript
// api/authService.js
const API_URL = 'http://localhost:3000/api';

export const authService = {
  // 1. Login/SignUp
  loginSignUp: async (email) => {
    const res = await fetch(`${API_URL}/users/Login_SignUp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return res.json();
  },

  // 2. Verify OTP
  verifyOtp: async (email, otp, userId) => {
    const res = await fetch(`${API_URL}/users/otp-verify/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, otp, userId })
    });
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('userId', data.userId);
    }
    return data;
  },

  // 3. Resend OTP
  resendOtp: async (email, userId) => {
    const res = await fetch(`${API_URL}/users/resend-otp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userId })
    });
    return res.json();
  },

  // 4. Get User Profile
  getUserProfile: async () => {
    const res = await fetch(`${API_URL}/Profile/UserProfile/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      credentials: 'include'
    });
    return res.json();
  },

  // 5. Set User Details
  setUserDetails: async (details) => {
    const res = await fetch(`${API_URL}/users/SetUsersDetail/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'X-CSRF-Token': localStorage.getItem('csrfToken') || ''
      },
      credentials: 'include',
      body: JSON.stringify(details)
    });
    return res.json();
  },

  // 6. Refresh Token
  refreshToken: async () => {
    const res = await fetch(`${API_URL}/core/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        refreshToken: localStorage.getItem('refreshToken')
      })
    });
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
    }
    return data;
  },

  // 7. Logout
  logout: async () => {
    await fetch(`${API_URL}/users/logout/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'X-CSRF-Token': localStorage.getItem('csrfToken') || ''
      },
      credentials: 'include'
    });
    localStorage.clear();
  }
};
```

---

## ⚡ Key Points

| Point | Details |
|-------|---------|
| **Base URL** | `http://localhost:3000/api` (add `/api` prefix) |
| **Authentication** | JWT tokens in Authorization header: `Bearer <token>` |
| **CSRF Protection** | Required for POST/PUT/DELETE with auth (check response) |
| **Credentials** | Use `credentials: 'include'` for cookie-based sessions |
| **Token Storage** | Use localStorage for tokens (be aware of XSS risks) |
| **Token Refresh** | Call `/core/token/refresh/` when access token expires |
| **Error Handling** | Check status codes: 401 = unauthorized, 403 = forbidden |

---

## 🚨 Error Handling

```javascript
const handleApiCall = async (url, options) => {
  try {
    const res = await fetch(url, options);
    
    if (res.status === 401) {
      // Token expired - refresh
      await authService.refreshToken();
      return fetch(url, options); // Retry
    }
    
    if (res.status === 403) {
      // Forbidden - no permission
      console.error('Access denied');
      return null;
    }
    
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
  }
};
```

---

## 🔐 Security Tips

1. **Never** store sensitive data in localStorage (consider sessionStorage)
2. **Always** use HTTPS in production
3. **Enable** CORS only for trusted domains
4. **Validate** CSRF tokens from backend
5. **Expire** tokens appropriately (access: 1 hour, refresh: 7 days)
6. **Clear** tokens on logout
7. **Use** httpOnly cookies when possible (set by backend)

