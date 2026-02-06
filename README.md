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

### Get All Mechanics
```
GET /api/mechanics
```

### Get Nearby Mechanics
```
GET /api/mechanics/nearby?latitude=23.0049&longitude=72.5487&radius=10
```

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `latitude` | float | ✅ | - | User's latitude |
| `longitude` | float | ✅ | - | User's longitude |
| `radius` | float | ❌ | 10 | Search radius in km |
| `limit` | int | ❌ | 20 | Max results |
| `onlineOnly` | bool | ❌ | false | Only online mechanics |

### Get Mechanic by ID
```
GET /api/mechanics/:id
```

## 📦 Environment Variables

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

## 🔧 Tech Stack

- Node.js + Express
- PostgreSQL (Neon)
- Haversine formula for distance calculation
- Vercel Serverless Functions
