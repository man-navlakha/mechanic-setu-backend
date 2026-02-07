# Mechanic Setu API

A Node.js/Express API for finding nearby mechanics using geolocation.

## 🚀 Deployment

### Vercel (Recommended)

1. Push this repo to GitHub
2. Import to Vercel: https://vercel.com/new
3. Add Environment Variable:
   - `DATABASE_URL` = your PostgreSQL connection string

### Local Development

```bash
npm install
npm run dev
```

## 📍 API Endpoints

### Health Check
```
GET /
GET /health
```

---

## 🔧 Original Mechanics API (users_mechanic table)

### Get All Mechanics
```
GET /api/mechanics
```

### Get Nearby Mechanics
```
GET /api/mechanics/nearby?latitude=23.0049&longitude=72.5487&radius=10
```

### Get Mechanic by ID
```
GET /api/mechanics/:id
```

---

## 🆕 MS Mechanics API (MS_mechanic table - no mandatory fields)

### Get All MS Mechanics
```
GET /api/ms-mechanics
GET /api/ms-mechanics?verified=true&status=ONLINE&limit=20
```

### Get Nearby MS Mechanics
```
GET /api/ms-mechanics/nearby?latitude=23.0049&longitude=72.5487&radius=10
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `latitude` | float | ✅ | - | User's latitude |
| `longitude` | float | ✅ | - | User's longitude |
| `radius` | float | ❌ | 10 | Search radius in km |
| `limit` | int | ❌ | 20 | Max results |
| `onlineOnly` | bool | ❌ | false | Only online mechanics |

### Get MS Mechanic by ID
```
GET /api/ms-mechanics/:id
```

### Create MS Mechanic (All fields optional!)
```
POST /api/ms-mechanics
Content-Type: application/json

{
  "shop_name": "My Shop",
  "shop_address": "123 Main St",
  "shop_latitude": 23.0049,
  "shop_longitude": 72.5487,
  "is_verified": false,
  "status": "OFFLINE",
  "user_id": 1,
  "KYC_document": "https://example.com/doc.pdf",
  "adhar_card": "123456789012"
}
```

### Update MS Mechanic (Partial update)
```
PATCH /api/ms-mechanics/:id
Content-Type: application/json

{
  "shop_name": "Updated Shop Name",
  "is_verified": true
}
```

### Delete MS Mechanic
```
DELETE /api/ms-mechanics/:id
```

### Update Location
```
PUT /api/ms-mechanics/:id/location
Content-Type: application/json

{
  "latitude": 23.0049,
  "longitude": 72.5487
}
```

### Toggle Status (ONLINE/OFFLINE)
```
PUT /api/ms-mechanics/:id/status
Content-Type: application/json

{
  "status": "ONLINE"
}
```

---

## 📦 Environment Variables

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

## 🗃️ Database Tables

### MS_mechanic (New - No mandatory fields)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | BIGSERIAL | NO | Primary key |
| shop_name | VARCHAR(255) | YES | Shop name |
| shop_address | TEXT | YES | Full address |
| shop_latitude | DOUBLE | YES | Shop location |
| shop_longitude | DOUBLE | YES | Shop location |
| is_verified | BOOLEAN | YES | Verification status |
| status | VARCHAR(50) | YES | ONLINE/OFFLINE |
| user_id | BIGINT | YES | Reference to user |
| KYC_document | VARCHAR(500) | YES | Document URL |
| adhar_card | VARCHAR(50) | YES | Aadhaar number |
| current_latitude | DOUBLE | YES | Live location |
| current_longitude | DOUBLE | YES | Live location |
| working_hours | TEXT | YES | Operating hours |
| created_at | TIMESTAMP | YES | Creation time |
| updated_at | TIMESTAMP | YES | Last update |

## 🔧 Tech Stack

- Node.js + Express
- PostgreSQL (Neon)
- Haversine formula for distance calculation
- Vercel Serverless Functions
