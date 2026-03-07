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

### Get User History (Authentication Required)
Returns the vehicles you have looked up while logged in. The backend automatically saves a record whenever you fetch RC info with a valid `access` cookie.
```bash
# Replace YOUR_ACCESS_TOKEN with an actual access token
curl http://localhost:3000/api/Profile/UserHistory \
  -H "Cookie: access=YOUR_ACCESS_TOKEN"
```

Sample response
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "vehicle_id": "GJ27AA3978",
      "is_owner": false,
      "notification_enabled": true,
      "id": 5,
      "license_plate": "GJ27AA3978",
      "brand_name": "Maruti Suzuki",
      "brand_model": "Swift",
      "owner_name": "Rahul Shah",
      "fuel_type": "Petrol",
      "class": "Hatchback",
      "vehicle_image": "https://cdn.imagin.studio/getimage?customer=hrjavascript-mastery&make=maruti&modelFamily=swift&zoomType=fullscreen",
      "raw_response": { "provider": "rto_provider", "reg_no": "GJ27AA3978" },
      "last_synced_at": "2026-02-17T18:15:10.123Z",
      "created_at": "2026-02-17T18:15:10.123Z",
      "updated_at": "2026-02-17T18:15:10.123Z"
    }
  ]
}
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

## User Management (Admin)

### List All Users
```bash
# List all users with pagination and search
# Optional query parameters: limit (1-200, default 50), offset (default 0), search (searches email, first_name, last_name, mobile_number)
curl "http://localhost:3000/api/user/admin?limit=50&offset=0"
```

Sample response
```json
{
  "success": true,
  "total_users": 150,
  "page_size": 50,
  "offset": 0,
  "users": [
    {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "mobile_number": "+1234567890",
      "profile_pic": null,
      "is_active": true,
      "is_staff": false,
      "date_joined": "2026-01-15T10:30:00.000Z",
      "last_login": "2026-03-07T15:45:00.000Z",
      "total_vehicles": 2,
      "total_services": 5,
      "is_mechanic": false,
      "is_ms_mechanic": false
    }
  ]
}
```

### Search Users
```bash
# Search users by email, name, or phone number
curl "http://localhost:3000/api/user/admin?search=john&limit=50"
```

### Get User by ID
```bash
# Get detailed information about a specific user
curl http://localhost:3000/api/user/admin/1
```

Sample response
```json
{
  "success": true,
  "user": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "mobile_number": "+1234567890",
    "profile_pic": null,
    "google_id": null,
    "is_active": true,
    "is_staff": false,
    "is_superuser": false,
    "date_joined": "2026-01-15T10:30:00.000Z",
    "last_login": "2026-03-07T15:45:00.000Z",
    "total_vehicles": 2,
    "vehicles": [
      {
        "vehicle_id": "GJ27AA3978",
        "is_owner": true,
        "saved_at": "2026-02-17T18:15:10.123Z",
        "license_plate": "GJ27AA3978",
        "brand_name": "Maruti Suzuki",
        "brand_model": "Swift"
      }
    ],
    "total_services": 3,
    "service_requests": [
      {
        "id": 1,
        "service_id": 5,
        "service_name": "Engine Service",
        "vehicle_id": "GJ27AA3978",
        "status": "COMPLETED",
        "created_at": "2026-02-20T10:00:00.000Z"
      }
    ],
    "is_mechanic": false,
    "mechanic_profile": null,
    "is_ms_mechanic": false,
    "ms_mechanic_profile": null
  }
}
```

### Create User
```bash
# Create a new user with email, password, and optional details
curl -X POST http://localhost:3000/api/user/admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "securePassword123",
    "first_name": "Jane",
    "last_name": "Smith",
    "mobile_number": "+9876543210",
    "is_staff": false,
    "is_superuser": false
  }'
```

Sample response
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": 201,
    "email": "newuser@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "mobile_number": "+9876543210",
    "is_staff": false,
    "is_superuser": false,
    "is_active": true,
    "date_joined": "2026-03-07T12:00:00.000Z"
  }
}
```

### Update User
```bash
# Update user details (all fields are optional)
curl -X PATCH http://localhost:3000/api/user/admin/1 \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Smith",
    "mobile_number": "+1111111111",
    "is_active": true,
    "is_staff": true,
    "is_superuser": false
  }'
```

Sample response
```json
{
  "success": true,
  "message": "User updated successfully",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Smith",
    "mobile_number": "+1111111111",
    "is_staff": true,
    "is_superuser": false,
    "is_active": true,
    "date_joined": "2026-01-15T10:30:00.000Z",
    "last_login": "2026-03-07T15:45:00.000Z"
  }
}
```

### Delete User
```bash
# Delete a user and all associated data (vehicles, service requests, OTP sessions, tokens)
curl -X DELETE http://localhost:3000/api/user/admin/1
```

Sample response
```json
{
  "success": true,
  "message": "User deleted successfully",
  "deleted_user_id": 1,
  "deleted_user_email": "john@example.com"
}
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
> Alias: the same controller also answers `DELETE http://localhost:3000/api/ms-mechanics/123/deleted` if you want a more descriptive path.

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

### Add Vehicle Manually
Add complete vehicle details manually using the same JSON structure returned by `/rc-info`. Simply paste the entire vehicle data object.
```bash
curl -X POST http://localhost:3000/api/vehicle/manual-add \
-H "Content-Type: application/json" \
-d '{
  "id": "19",
  "vehicle_id": "GJ05RA8458",
  "license_plate": "GJ05RA8458",
  "chassis_number": null,
  "engine_number": null,
  "brand_name": "MARUTI SUZUKI INDIA LTD",
  "brand_model": "MARUTI SWIFT VDI BSIV",
  "fuel_type": "DIESEL",
  "color": "ARCTIC WHITE",
  "cubic_capacity": 1248,
  "cylinders": 4,
  "seating_capacity": "5",
  "vehicle_age": null,
  "class": "Motor Car",
  "norms": "BHARAT STAGE IV",
  "owner_name": "BHAMAR NANDUBHAI NAVLAKHA",
  "father_name": null,
  "owner_count": 3,
  "present_address": "3-10 UMASUT FLAT,OPP RASHMI FLAT,VASNA,380007",
  "permanent_address": "3-10 UMASUT FLAT,OPP RASHMI FLAT,VASNA,380007",
  "registration_date": "2017-08-01",
  "rc_status": "ACTIVE",
  "insurance_company": "United India Insurance Co. Ltd.",
  "insurance_policy": "2902003125P104560375",
  "insurance_expiry": "2026-06-19",
  "tax_paid_upto": null,
  "tax_upto": "2032-07-31",
  "permit_type": null,
  "permit_number": null,
  "permit_issue_date": null,
  "permit_valid_from": null,
  "permit_valid_upto": null,
  "national_permit_number": null,
  "national_permit_issued_by": null,
  "national_permit_upto": null,
  "pucc_number": "RJ01900570003487",
  "pucc_upto": "2026-08-09",
  "raw_response": {
    "class": "Motor Car",
    "fuel_type": "DIESEL",
    "owner_name": "BHAMAR NANDUBHAI NAVLAKHA",
    "brand_model": "MARUTI SWIFT VDI BSIV",
    "raw_response": {
      "result": {
        "color": "ARCTIC WHITE",
        "model": "MARUTI SWIFT VDI BSIV",
        "state": "Gujarat",
        "reg_no": "GJ05RA8458",
        "status": "ACTIVE",
        "fit_upto": "2032-07-31",
        "reg_date": "2017-08-01",
        "reg_upto": "2032-07-31",
        "tax_upto": "2032-07-31",
        "body_type": "HATCH BACK",
        "cubic_cap": 1248,
        "engine_no": "D13A-691986",
        "chassis_no": "MA3FHEB1S00D13491",
        "fuel_descr": "DIESEL",
        "owner_name": "BHAMAR NANDUBHAI NAVLAKHA",
        "vehicle_hp": 0,
        "norms_descr": "BHARAT STAGE IV",
        "office_name": "AHMEDABAD",
        "owner_count": 3,
        "cylinders_no": 4,
        "vehicle_catg": "LMV",
        "vehicle_type": "Non-Transport",
        "unladen_weight": 1045,
        "vehicle_class_desc": "Motor Car",
        "vehicle_seat_capacity": 5,
        "vehicle_gross_weight": 1505,
        "vehicle_pucc_details": {
          "pucc_no": "RJ01900570003487",
          "pucc_upto": "09-08-2026"
        },
        "vehicle_insurance_details": {
          "reg_no": "GJ05RA8458",
          "policy_no": "2902003125P104560375",
          "insurance_upto": "2026-06-19",
          "insurance_company_name": "United India Insurance Co. Ltd."
        }
      },
      "status": "success",
      "message": "Vehicle Found"
    },
    "license_plate": "GJ05RA8458"
  },
  "created_at": "2026-02-22T03:53:19.909Z",
  "updated_at": "2026-02-22T05:34:52.569Z",
  "last_synced_at": "2026-02-22T03:53:19.909Z",
  "vehicle_image": "http://localhost:3002/api/vehicle/MARUTI_SWIFT",
  "vehicle_category": "car"
}'
```

Sample response
```json
{
  "success": true,
  "data": {
    "vehicle_id": "GJ05RA8458",
    "license_plate": "GJ05RA8458",
    "brand_name": "MARUTI SUZUKI INDIA LTD",
    "brand_model": "MARUTI SWIFT VDI BSIV",
    "owner_name": "BHAMAR NANDUBHAI NAVLAKHA",
    "fuel_type": "DIESEL",
    "class": "Motor Car",
    "vehicle_category": "car",
    "vehicle_image": "http://localhost:3002/api/vehicle/MARUTI_SWIFT",
    "raw_response": {
      "class": "Motor Car",
      "fuel_type": "DIESEL",
      "owner_name": "BHAMAR NANDUBHAI NAVLAKHA",
      "brand_model": "MARUTI SWIFT VDI BSIV",
      "raw_response": {
        "result": {
          "color": "ARCTIC WHITE",
          "reg_no": "GJ05RA8458",
          "status": "ACTIVE",
          "vehicle_class_desc": "Motor Car",
          "vehicle_seat_capacity": 5
        },
        "status": "success",
        "message": "Vehicle Found"
      },
      "license_plate": "GJ05RA8458"
    },
    "created_at": "2026-03-07T10:30:00.000Z",
    "updated_at": "2026-03-07T10:30:00.000Z",
    "last_synced_at": "2026-03-07T10:30:00.000Z"
  },
  "source": "manual_entry"
}
```

### Add Vehicle from MyMotor API
Add vehicle by sending the complete MyMotor API response. The endpoint maps all MyMotor fields to the database schema.
```bash
curl -X POST http://localhost:3000/api/vehicle/mymotor \
-H "Content-Type: application/json" \
-d '{
  "status": "success",
  "data": {
    "key_information": {
      "ownership": "1",
      "registration_date": "26-Jun-2020",
      "rto": "AHMEDABAD, Gujarat",
      "rc_status": "ACTIVE",
      "rc_expiry": "25-Jun-2035",
      "financer": "IDFC FIRST BANK LTD",
      "owner_name": "NA",
      "rc_reg_no": "GJ01VE2323",
      "rc_blacklist_status": "NA"
    },
    "vehicle_details": {
      "manufacturer": "HONDA MOTORCYCLE AND SCOOTER INDIA (P) LTD",
      "model_name": "ACTIVA 6G DLX",
      "color": "PEARL PRECIOUS WHITE",
      "vehicle_class": "M-Cycle/Scooter(2WN)",
      "fuel_type": "PETROL",
      "vehicle_cubic_capacity": "109.51",
      "vehicle_type": "2W",
      "rc_tax_upto": "25-06-2035"
    },
    "insurance_details": {
      "insurance_company": "IndusInd General Insurance Co. Ltd",
      "insurance_valid_upto": "23-Jun-2025",
      "status": "Expire"
    },
    "puc_details": {
      "expiry_date": "NA",
      "status": "Expire",
      "emission_norm": "BHARAT STAGE VI"
    }
  },
  "message": "vehicle details fetched successfully",
  "status_code": 200
}'
```

Sample response
```json
{
  "success": true,
  "data": {
    "vehicle_id": "GJ01VE2323",
    "license_plate": "GJ01VE2323",
    "chassis_number": null,
    "engine_number": null,
    "brand_name": "HONDA MOTORCYCLE AND SCOOTER INDIA (P) LTD",
    "brand_model": "ACTIVA 6G DLX",
    "fuel_type": "PETROL",
    "color": "PEARL PRECIOUS WHITE",
    "cubic_capacity": 109.51,
    "class": "M-Cycle/Scooter(2WN)",
    "owner_name": "NA",
    "registration_date": "26-Jun-2020",
    "rc_status": "ACTIVE",
    "source": "mymotor",
    "is_financed": false,
    "financer": "IDFC FIRST BANK LTD",
    "insurance_company": "IndusInd General Insurance Co. Ltd",
    "insurance_expiry": "23-Jun-2025",
    "tax_upto": "25-06-2035",
    "vehicle_category": "bike",
    "vehicle_image": "https://img-server-theta.vercel.app/api/vehicle/activa_6g_dlx",
    "raw_response": {
      "status": "success",
      "data": {
        "key_information": { ...complete data... },
        "vehicle_details": { ...complete data... },
        "insurance_details": { ...complete data... },
        "puc_details": { ...complete data... }
      }
    },
    "created_at": "2026-03-07T10:30:00.000Z",
    "updated_at": "2026-03-07T10:30:00.000Z",
    "last_synced_at": "2026-03-07T10:30:00.000Z"
  },
  "source": "mymotor"
}
```

### Generate Vehicle Image URL
Generate a vehicle image URL by providing the vehicle model name. Useful for getting image URLs without adding vehicle to database.
```bash
# Simple model name
curl "http://localhost:3000/api/vehicle/generate-image?model=Swift"

# Or with brand_model parameter
curl "http://localhost:3000/api/vehicle/generate-image?brand_model=Maruti%20Swift%20VDI"
```

Sample response
```json
{
  "success": true,
  "model": "Swift",
  "vehicle_image": "https://img-server-theta.vercel.app/api/vehicle/swift",
  "url_slug": "swift"
}
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

### Update Saved Vehicle by ID
```bash
curl -X PATCH "http://localhost:3000/api/vehicle/saved/GJ01VW9893" \
  -H "Content-Type: application/json" \
  -d '{"owner_name": "Updated Owner", "fuel_type": "Petrol"}'
```

### Delete Saved Vehicle by ID
```bash
curl -X DELETE "http://localhost:3000/api/vehicle/saved/GJ01VW9893"
```
