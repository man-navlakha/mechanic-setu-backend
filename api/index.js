require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Import utilities and database
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
}

// ==================== ROUTES ====================

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Mechanic Setu API is running',
        version: '1.0.0',
        endpoints: {
            health: 'GET /',
            allMechanics: 'GET /api/mechanics',
            nearbyMechanics: 'GET /api/mechanics/nearby?latitude=XX&longitude=XX&radius=10',
            mechanicById: 'GET /api/mechanics/:id'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Mechanic Setu API is running' });
});

// Get nearby mechanics
app.get('/api/mechanics/nearby', async (req, res) => {
    try {
        const { latitude, longitude, radius = 10, limit = 20, onlineOnly = false } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required',
                example: '/api/mechanics/nearby?latitude=23.0049&longitude=72.5487'
            });
        }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);
        const searchRadius = parseFloat(radius);
        const maxResults = parseInt(limit);

        if (isNaN(userLat) || isNaN(userLon)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid latitude or longitude values'
            });
        }

        if (userLat < -90 || userLat > 90 || userLon < -180 || userLon > 180) {
            return res.status(400).json({
                success: false,
                error: 'Coordinates out of valid range'
            });
        }

        let query = `
      SELECT 
        m.id as mechanic_id,
        m.shop_name,
        m.shop_address,
        m.shop_latitude,
        m.shop_longitude,
        m.is_verified,
        m.status,
        m.current_latitude,
        m.current_longitude,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.mobile_number,
        u.profile_pic
      FROM users_mechanic m
      JOIN users_customuser u ON m.user_id = u.id
      WHERE m.shop_latitude IS NOT NULL 
        AND m.shop_longitude IS NOT NULL
        AND u.is_active = true
    `;

        if (onlineOnly === 'true' || onlineOnly === true) {
            query += ` AND m.status = 'ONLINE'`;
        }

        const result = await pool.query(query);

        const mechanicsWithDistance = result.rows
            .map(mechanic => {
                const mechanicLat = mechanic.current_latitude || mechanic.shop_latitude;
                const mechanicLon = mechanic.current_longitude || mechanic.shop_longitude;
                const distance = calculateDistance(userLat, userLon, mechanicLat, mechanicLon);

                return {
                    id: mechanic.mechanic_id,
                    shop_name: mechanic.shop_name,
                    shop_address: mechanic.shop_address,
                    location: {
                        shop: {
                            latitude: mechanic.shop_latitude,
                            longitude: mechanic.shop_longitude
                        },
                        current: mechanic.current_latitude ? {
                            latitude: mechanic.current_latitude,
                            longitude: mechanic.current_longitude
                        } : null
                    },
                    distance_km: distance,
                    distance_text: distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance} km`,
                    is_verified: mechanic.is_verified,
                    status: mechanic.status,
                    mechanic: {
                        id: mechanic.user_id,
                        name: `${mechanic.first_name} ${mechanic.last_name}`.trim(),
                        email: mechanic.email,
                        mobile: mechanic.mobile_number,
                        profile_pic: mechanic.profile_pic
                    }
                };
            })
            .filter(m => m.distance_km <= searchRadius)
            .sort((a, b) => a.distance_km - b.distance_km)
            .slice(0, maxResults);

        res.json({
            success: true,
            user_location: { latitude: userLat, longitude: userLon },
            search_radius_km: searchRadius,
            total_found: mechanicsWithDistance.length,
            mechanics: mechanicsWithDistance
        });

    } catch (error) {
        console.error('Error fetching nearby mechanics:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch nearby mechanics' });
    }
});

// Get all mechanics
app.get('/api/mechanics', async (req, res) => {
    try {
        const query = `
      SELECT 
        m.id as mechanic_id,
        m.shop_name,
        m.shop_address,
        m.shop_latitude,
        m.shop_longitude,
        m.is_verified,
        m.status,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.mobile_number,
        u.profile_pic
      FROM users_mechanic m
      JOIN users_customuser u ON m.user_id = u.id
      WHERE u.is_active = true
      ORDER BY m.is_verified DESC, m.shop_name ASC
    `;

        const result = await pool.query(query);

        const mechanics = result.rows.map(m => ({
            id: m.mechanic_id,
            shop_name: m.shop_name,
            shop_address: m.shop_address,
            location: {
                latitude: m.shop_latitude,
                longitude: m.shop_longitude
            },
            is_verified: m.is_verified,
            status: m.status,
            mechanic: {
                id: m.user_id,
                name: `${m.first_name} ${m.last_name}`.trim(),
                email: m.email,
                mobile: m.mobile_number,
                profile_pic: m.profile_pic
            }
        }));

        res.json({
            success: true,
            total: mechanics.length,
            mechanics
        });

    } catch (error) {
        console.error('Error fetching mechanics:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch mechanics' });
    }
});

// Get single mechanic by ID
app.get('/api/mechanics/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
      SELECT 
        m.id as mechanic_id,
        m.shop_name,
        m.shop_address,
        m.shop_latitude,
        m.shop_longitude,
        m.is_verified,
        m.status,
        m.current_latitude,
        m.current_longitude,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.mobile_number,
        u.profile_pic,
        u.date_joined
      FROM users_mechanic m
      JOIN users_customuser u ON m.user_id = u.id
      WHERE m.id = $1
    `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Mechanic not found' });
        }

        const m = result.rows[0];

        res.json({
            success: true,
            mechanic: {
                id: m.mechanic_id,
                shop_name: m.shop_name,
                shop_address: m.shop_address,
                location: {
                    shop: {
                        latitude: m.shop_latitude,
                        longitude: m.shop_longitude
                    },
                    current: m.current_latitude ? {
                        latitude: m.current_latitude,
                        longitude: m.current_longitude
                    } : null
                },
                is_verified: m.is_verified,
                status: m.status,
                user: {
                    id: m.user_id,
                    name: `${m.first_name} ${m.last_name}`.trim(),
                    email: m.email,
                    mobile: m.mobile_number,
                    profile_pic: m.profile_pic,
                    member_since: m.date_joined
                }
            }
        });

    } catch (error) {
        console.error('Error fetching mechanic:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch mechanic' });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Export for Vercel
module.exports = app;

// For local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on:`);
        console.log(`   Local:   http://localhost:${PORT}`);
    });
}
