# API Documentation

This document provides `curl` examples for the available API endpoints.

**Base URL:** `http://localhost:3000`

---

## Health Check

### Home
```bash
curl http://localhost:3000/
```

### Health
```bash
curl http://localhost:3000/health
```

---

## Authentication

Note: Auth routes are available at both `/` and `/api/`. Examples will use `/api/`.

### Login or Sign Up (Start OTP)
```bash
curl -X POST http://localhost:3000/api/users/Login_SignUp 
-H "Content-Type: application/json" 
-d '{"email": "user@example.com"}'
```

### Verify OTP
```bash
curl -X POST http://localhost:3000/api/users/otp-verify 
-H "Content-Type: application/json" 
-d '{"key": "session-key-from-previous-step", "id": "user-id-from-previous-step", "otp": "123456"}'
```

### Resend OTP
```bash
curl -X POST http://localhost:3000/api/users/resend-otp 
-H "Content-Type: application/json" 
-d '{"key": "session-key", "id": "user-id"}'
```

### Google Login
```bash
curl -X POST http://localhost:3000/api/users/google 
-H "Content-Type: application/json" 
-d '{"token": "google-id-token"}'
```

### Set User Details (Authentication Required)
```bash
# Replace YOUR_ACCESS_TOKEN and YOUR_CSRF_TOKEN with actual tokens from cookies
curl -X POST http://localhost:3000/api/users/SetUsersDetail 
-H "Content-Type: application/json" 
-H "Cookie: access=YOUR_ACCESS_TOKEN; csrftoken=YOUR_CSRF_TOKEN" 
-H "X-CSRF-Token: YOUR_CSRF_TOKEN" 
-d '{"first_name": "John", "last_name": "Doe", "mobile_number": "+1234567890"}'
```

### Get User Profile (Authentication Required)
```bash
# Replace YOUR_ACCESS_TOKEN with an actual access token
curl http://localhost:3000/api/Profile/UserProfile 
-H "Cookie: access=YOUR_ACCESS_TOKEN"
```

### Logout (Authentication Required)
```bash
# Replace YOUR_ACCESS_TOKEN and YOUR_CSRF_TOKEN with actual tokens from cookies
curl -X POST http://localhost:3000/api/users/logout 
-H "Cookie: access=YOUR_ACCESS_TOKEN; csrftoken=YOUR_CSRF_TOKEN" 
-H "X-CSRF-Token: YOUR_CSRF_TOKEN"
```

### Get Current User (Authentication Required)
```bash
# Replace YOUR_ACCESS_TOKEN with an actual access token
curl http://localhost:3000/api/core/me 
-H "Cookie: access=YOUR_ACCESS_TOKEN"
```

### Refresh Access Token
```bash
# Replace YOUR_REFRESH_TOKEN with an actual refresh token from the cookie
curl -X POST http://localhost:3000/api/core/token/refresh 
-H "Content-Type: application/json" 
-H "Cookie: refresh=YOUR_REFRESH_TOKEN"
```

---

## Mechanics

### Get Nearby Mechanics
```bash
# lat and lon are required query parameters
curl "http://localhost:3000/api/mechanics/nearby?lat=19.0760&lon=72.8777"
```

### Get All Mechanics
```bash
curl http://localhost:3000/api/mechanics/
```

### Get Mechanic by ID
```bash
curl http://localhost:3000/api/mechanics/123
```

---

## MS Mechanics (Managed Service)

### Get Nearby MS Mechanics
```bash
# lat and lon are required query parameters
curl "http://localhost:3000/api/ms-mechanics/nearby?lat=19.0760&lon=72.8777"
```

### Get All MS Mechanics
```bash
curl http://localhost:3000/api/ms-mechanics/
```

### Create MS Mechanic
```bash
curl -X POST http://localhost:3000/api/ms-mechanics/ 
-H "Content-Type: application/json" 
-d '{"name": "Pro Mechanics", "latitude": 19.0760, "longitude": 72.8777, "skills": ["Engine", "Brakes"]}'
```

### Get MS Mechanic by ID
```bash
curl http://localhost:3000/api/ms-mechanics/123
```

### Update MS Mechanic
```bash
curl -X PATCH http://localhost:3000/api/ms-mechanics/123 
-H "Content-Type: application/json" 
-d '{"name": "Pro Mechanics Updated"}'
```

### Delete MS Mechanic
```bash
curl -X DELETE http://localhost:3000/api/ms-mechanics/123
```

### Update MS Mechanic Location
```bash
curl -X PUT http://localhost:3000/api/ms-mechanics/123/location 
-H "Content-Type: application/json" 
-d '{"latitude": 19.0765, "longitude": 72.8780}'
```

### Update MS Mechanic Status
```bash
curl -X PUT http://localhost:3000/api/ms-mechanics/123/status 
-H "Content-Type: application/json" 
-d '{"status": "UNAVAILABLE"}'
```

---

## Vehicle

### Get Vehicle RC Info
```bash
curl -X POST http://localhost:3000/api/vehicle/rc-info 
-H "Content-Type: application/json" 
-d '{"vehicle_number": "MH14GH8765"}'
```

### Get Saved Vehicles
```bash
curl "http://localhost:3000/api/vehicle/saved?limit=10&offset=0"
```

### Get My Vehicles
```bash
curl "http://localhost:3000/api/vehicle/my-vehicles?vehicle_id=MH14GH8765"
```

### Get Saved Vehicle by ID
```bash
curl "http://localhost:3000/api/vehicle/saved/GJ01VW9893"
```

### Delete Saved Vehicle by ID
```bash
curl -X DELETE "http://localhost:3000/api/vehicle/saved/GJ01VW9893"
```
