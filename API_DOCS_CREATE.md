# 🛠️ MS Mechanic API - Create Endpoint Documentation

This document provides detailed information on how to use the **Create Mechanic** API endpoint for the `MS_mechanic` table.

## 📌 Endpoint Overview

- **URL:** `/api/ms-mechanics`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Description:** Creates a new mechanic entry in the `MS_mechanic` table.
- **Key Feature:** **ALL FIELDS ARE OPTIONAL**. You can send as many or as few fields as you like. There are no mandatory fields.

---

## 📝 Request Body Parameters

You can include any of the following fields in your JSON body. **None are required.**

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `full_name` | `string` | Mechanic's full name | `"Raju Bhai"` |
| `phone` | `string` | Contact number | `"+919876543210"` |
| `email` | `string` | Email address | `"raju@garage.com"` |
| `shop_name` | `string` | Name of the mechanic shop | `"Raju Auto Garage"` |
| `shop_address` | `string` | Full address of the shop | `"123, SG Highway, Ahmedabad"` |
| `shop_latitude` | `float` | Latitude of the shop location | `23.0049` |
| `shop_longitude` | `float` | Longitude of the shop location | `72.5487` |
| `shop_google_map_link` | `string` | Google Maps Link | `"https://maps.app.goo.gl/..."` |
| `is_verified` | `boolean` | Verification status | `true` or `false` (default: `false`) |
| `status` | `string` | Online status | `"ONLINE"` or `"OFFLINE"` (default: `"OFFLINE"`) |
| `yes_for_startup` | `boolean` | Interested in startup program? | `true` |
| `user_id` | `integer` | ID of the linked user (if any) | `45` |
| `notes` | `string` | Internal notes | `"Good mechanic, verified"` |
| `profile_photo` | `string` | URL to profile photo | `"https://example.com/profile.jpg"` |
| `shop_photo` | `string` | URL to shop photo | `"https://example.com/shop.jpg"` |
| `KYC_document` | `string` | URL to KYC document (PDF/Image) | `"https://example.com/doc.pdf"` |
| `adhar_card` | `string` | Aadhaar card number | `"123456789012"` |
| `current_latitude` | `float` | Mechanic's live tracking latitude | `23.0051` |
| `current_longitude` | `float` | Mechanic's live tracking longitude | `72.5490` |

---

## 🚀 Usage Examples

### 1. Minimal Request

You can create a mechanic with just a name.

```json
POST /api/ms-mechanics

{
  "full_name": "Raju Bhai",
  "shop_name": "Speedy Repairs"
}
```

### 2. Full Profile Request

Create a complete profile with all details.

```json
POST /api/ms-mechanics

{
  "full_name": "Ramesh Kumar",
  "phone": "+919876543210",
  "email": "ramesh@mechanic.com",
  "shop_name": "Gujarat Motor Works",
  "shop_address": "Shop 4, Near Iscon Cross Road, Ahmedabad, Gujarat",
  "shop_latitude": 23.0225,
  "shop_longitude": 72.5714,
  "shop_google_map_link": "https://maps.google.com/?q=23.0225,72.5714",
  "status": "ONLINE",
  "is_verified": true,
  "yes_for_startup": true,
  "notes": "Verified by field agent on 12th Jan",
  "profile_photo": "https://example.com/ramesh.jpg",
  "shop_photo": "https://example.com/garage.jpg",
  "user_id": 101,
  "adhar_card": "998877665544",
  "KYC_document": "https://storage.googleapis.com/docs/kyc-101.pdf",
  "current_latitude": 23.0230,
  "current_longitude": 72.5720
}
```

### 3. Location-Only Request

Create an entry just to track a location.

```json
POST /api/ms-mechanics

{
  "current_latitude": 23.0049,
  "current_longitude": 72.5487,
  "status": "ONLINE"
}
```

### 4. Empty Request

Even an empty body works! It will create a record with mostly `null` values.

```json
POST /api/ms-mechanics

{}
```

---

## 📥 Response Format

### Success Response (201 Created)

Returns the created mechanic object including the generated `id` and timestamps.

```json
{
  "success": true,
  "message": "MS Mechanic created successfully",
  "mechanic": {
    "id": "15",
    "shop_name": "Gujarat Motor Works",
    "shop_address": "Shop 4, Near Iscon Cross Road, Ahmedabad, Gujarat",
    "shop_latitude": 23.0225,
    "shop_longitude": 72.5714,
    "is_verified": true,
    "status": "ONLINE",
    "user_id": "101",
    "KYC_document": "https://storage.googleapis.com/docs/kyc-101.pdf",
    "adhar_card": "998877665544",
    "current_latitude": 23.023,
    "current_longitude": 72.572,
    "created_at": "2026-02-07T12:00:00.000Z",
    "updated_at": "2026-02-07T12:00:00.000Z"
  }
}
```

### Error Response (500 Server Error)

Occurs if there is a database connection issue or invalid data type (e.g. sending text for latitude).

```json
{
  "success": false,
  "error": "Failed to create MS mechanic"
}
```

---

## 🧪 Testing with cURL

Copy and paste this command to your terminal to test:

```bash
curl -X POST http://localhost:3000/api/ms-mechanics \
  -H "Content-Type: application/json" \
  -d '{
    "shop_name": "Test Shop API",
    "status": "ONLINE",
    "shop_latitude": 23.00,
    "shop_longitude": 72.00
  }'
```
