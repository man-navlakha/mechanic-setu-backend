# 🛠️ MS Mechanic API - Read & Update Operations

This document provides detailed information on how to **Retrieve** and **Update** mechanic entries in the `MS_mechanic` table.

---

## 📋 1. Get All MS Mechanics

Retrieve a list of mechanics with optional filtering.

- **URL:** `/api/ms-mechanics`
- **Method:** `GET`

### 🔹 Query Parameters

You can filter results using the following query parameters:

| Parameter  | Type      | Description                                      | Example              |
|------------|-----------|--------------------------------------------------|----------------------|
| `verified` | `boolean` | Filter by verification status (`true` / `false`) | `?verified=true`     |
| `status`   | `string`  | Filter by online status (`ONLINE` / `OFFLINE`)   | `?status=ONLINE`     |
| `limit`    | `integer` | Limit number of results (Default: 50)            | `?limit=10`          |

### 🔹 Usage Examples

**Get all mechanics:**
```http
GET /api/ms-mechanics
```

**Get only verified online mechanics:**
```http
GET /api/ms-mechanics?verified=true&status=ONLINE
```

### 🔹 Response Example

```json
{
  "success": true,
  "total": 2,
  "mechanics": [
    {
      "id": "15",
      "shop_name": "Raju Auto",
      "status": "ONLINE",
      "is_verified": true,
      "working_hours": "Mon-Sat 9am-9pm",
      "created_at": "2026-02-01T10:00:00.000Z"
    },
    {
      "id": "16",
      "shop_name": "Speedy Garage",
      "status": "OFFLINE",
      "is_verified": false,
      "working_hours": null,
      "created_at": "2026-02-02T11:00:00.000Z"
    }
  ]
}
```

---

## 🔍 2. Get Single MS Mechanic by ID

Retrieve full details of a specific mechanic.

- **URL:** `/api/ms-mechanics/:id`
- **Method:** `GET`

### 🔹 Path Variables

| Variable | Type      | Description                  |
|----------|-----------|------------------------------|
| `id`     | `integer` | The unique ID of the mechanic |

### 🔹 Usage Example

```http
GET /api/ms-mechanics/15
```

### 🔹 Response Example

```json
{
  "success": true,
  "mechanic": {
    "id": "15",
    "shop_name": "Raju Auto",
    "shop_address": "123 MG Road",
    "full_name": "Raju Bhai",
    "phone": "+919988776655",
    "services_offered": "puncture, oil_change",
    "working_hours": "Mon-Sat 9am-9pm",
    "status": "ONLINE",
    "is_verified": true,
    "current_latitude": 23.01,
    "current_longitude": 72.51,
    "shop_latitude": 23.01,
    "shop_longitude": 72.51,
    "shop_photo": "https://example.com/shop.jpg",
    "profile_photo": "https://example.com/profile.jpg"
  }
}
```

---

## ✏️ 3. Update MS Mechanic

Update specific fields of an existing mechanic. Only the fields you send/provide will be updated.

- **URL:** `/api/ms-mechanics/:id`
- **Method:** `PATCH`
- **Content-Type:** `application/json`

### 🔹 Request Body Parameters

Support all fields from the Create API. Common updateable fields:

| Field Name | Type | Description |
|------------|------|-------------|
| `working_hours` | `string` | Shop operating hours (e.g., "Mon-Fri 9-6") |
| `status` | `string` | "ONLINE" or "OFFLINE" |
| `is_verified` | `boolean` | Verification status |
| `shop_name` | `string` | Name of the shop |
| `services_offered` | `string` | Updated list of services |
| `fuel_delivery_types` | `string` | Updated fuel options |
| `current_latitude` | `float` | Live tracking update |
| `current_longitude` | `float` | Live tracking update |
| *(All other fields)* | ... | *See Create Docs for full list* |

### 🔹 Usage Example

**Update working hours and status:**

```json
PATCH /api/ms-mechanics/15

{
  "working_hours": "Mon-Sun 8:00 AM to 10:00 PM",
  "status": "ONLINE",
  "notes": "Updated hours for festival season",
  "fuel_delivery_types": "petrol, diesel, ev_charging"
}
```

### 🔹 Response Example

```json
{
  "success": true,
  "message": "MS Mechanic updated successfully",
  "mechanic": {
    "id": "15",
    "shop_name": "Raju Auto",
    "working_hours": "Mon-Sun 8:00 AM to 10:00 PM",
    "status": "ONLINE",
    "updated_at": "2026-02-07T14:30:00.000Z",
    "...": "..."
  }
}
```

---

## 📍 4. Get Nearby MS Mechanics

Find mechanics within a specific radius of a user's location.

- **URL:** `/api/ms-mechanics/nearby`
- **Method:** `GET`

### 🔹 Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `latitude` | `float` | ✅ Yes | - | User's current latitude |
| `longitude` | `float` | ✅ Yes | - | User's current longitude |
| `radius` | `float` | No | `10` | Search radius in kilometers |
| `limit` | `integer` | No | `20` | Max results to return |
| `onlineOnly` | `boolean` | No | `false` | If `true`, returns only "ONLINE" mechanics |

### 🔹 Usage Example

```http
GET /api/ms-mechanics/nearby?latitude=23.0049&longitude=72.5487&radius=5&onlineOnly=true
```

### 🔹 Response Example

```json
{
  "success": true,
  "user_location": {
    "latitude": 23.0049,
    "longitude": 72.5487
  },
  "search_radius_km": 5,
  "total_found": 1,
  "mechanics": [
    {
      "id": "15",
      "shop_name": "Raju Auto",
      "status": "ONLINE",
      "distance_km": 0.5,
      "distance_text": "500 m",
      "working_hours": "Mon-Sat 9am-9pm"
    }
  ]
}
```
