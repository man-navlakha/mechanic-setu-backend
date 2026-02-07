const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
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
            mechanics: {
                all: 'GET /api/mechanics',
                nearby: 'GET /api/mechanics/nearby?latitude=XX&longitude=XX&radius=10',
                byId: 'GET /api/mechanics/:id'
            },
            ms_mechanics: {
                all: 'GET /api/ms-mechanics',
                nearby: 'GET /api/ms-mechanics/nearby?latitude=XX&longitude=XX&radius=10',
                byId: 'GET /api/ms-mechanics/:id',
                create: 'POST /api/ms-mechanics',
                update: 'PATCH /api/ms-mechanics/:id',
                delete: 'DELETE /api/ms-mechanics/:id',
                updateLocation: 'PUT /api/ms-mechanics/:id/location',
                updateStatus: 'PUT /api/ms-mechanics/:id/status'
            }
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

// ==================== MS_MECHANIC ROUTES ====================

// Get all MS mechanics
app.get('/api/ms-mechanics', async (req, res) => {
    try {
        const { verified, status, limit = 50 } = req.query;

        let query = 'SELECT * FROM "MS_mechanic" WHERE 1=1';
        const params = [];

        if (verified !== undefined) {
            params.push(verified === 'true');
            query += ` AND is_verified = $${params.length}`;
        }

        if (status) {
            params.push(status.toUpperCase());
            query += ` AND status = $${params.length}`;
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        const result = await pool.query(query, params);

        res.json({
            success: true,
            total: result.rows.length,
            mechanics: result.rows
        });
    } catch (error) {
        console.error('Error fetching MS mechanics:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch MS mechanics' });
    }
});

// Get nearby MS mechanics
app.get('/api/ms-mechanics/nearby', async (req, res) => {
    try {
        const { latitude, longitude, radius = 10, limit = 20, onlineOnly = false } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Latitude and longitude are required',
                example: '/api/ms-mechanics/nearby?latitude=23.0049&longitude=72.5487'
            });
        }

        const userLat = parseFloat(latitude);
        const userLon = parseFloat(longitude);
        const searchRadius = parseFloat(radius);
        const maxResults = parseInt(limit);

        let query = `SELECT * FROM "MS_mechanic" WHERE shop_latitude IS NOT NULL AND shop_longitude IS NOT NULL`;

        if (onlineOnly === 'true') {
            query += ` AND status = 'ONLINE'`;
        }

        const result = await pool.query(query);

        const mechanicsWithDistance = result.rows
            .map(m => {
                const mechanicLat = m.current_latitude || m.shop_latitude;
                const mechanicLon = m.current_longitude || m.shop_longitude;
                const distance = calculateDistance(userLat, userLon, mechanicLat, mechanicLon);
                return { ...m, distance_km: distance, distance_text: distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance} km` };
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
        console.error('Error fetching nearby MS mechanics:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch nearby MS mechanics' });
    }
});

// Get single MS mechanic by ID
app.get('/api/ms-mechanics/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM "MS_mechanic" WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'MS Mechanic not found' });
        }

        res.json({ success: true, mechanic: result.rows[0] });
    } catch (error) {
        console.error('Error fetching MS mechanic:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch MS mechanic' });
    }
});

// Create new MS mechanic (all fields optional)
app.post('/api/ms-mechanics', async (req, res) => {
    try {
        const {
            shop_name, shop_address, shop_latitude, shop_longitude, is_verified, status,
            user_id, KYC_document, adhar_card, current_latitude, current_longitude,
            full_name, phone, email, yes_for_startup, notes, profile_photo, shop_photo, shop_google_map_link,
            special_skills, vehicle_type, electric, electric_vehicle_types, fuel_delivery_types,
            services_offered, working_hours
        } = req.body;

        const query = `
            INSERT INTO "MS_mechanic" (
                shop_name, shop_address, shop_latitude, shop_longitude,
                is_verified, status, user_id, "KYC_document", adhar_card,
                current_latitude, current_longitude,
                full_name, phone, email, yes_for_startup, notes,
                profile_photo, shop_photo, shop_google_map_link,
                special_skills, vehicle_type,
                electric, electric_vehicle_types, fuel_delivery_types,
                services_offered, working_hours
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
            RETURNING *
        `;

        const values = [
            shop_name || null,
            shop_address || null,
            shop_latitude || null,
            shop_longitude || null,
            is_verified || false,
            status || 'OFFLINE',
            user_id || null,
            KYC_document || null,
            adhar_card || null,
            current_latitude || null,
            current_longitude || null,
            full_name || null,
            phone || null,
            email || null,
            yes_for_startup || false,
            notes || null,
            profile_photo || null,
            shop_photo || null,
            shop_google_map_link || null,
            special_skills || null,
            vehicle_type || null,
            electric || false,
            electric_vehicle_types || null,
            fuel_delivery_types || null,
            services_offered || null,
            working_hours || null
        ];

        const result = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'MS Mechanic created successfully',
            mechanic: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating MS mechanic:', error);
        res.status(500).json({ success: false, error: 'Failed to create MS mechanic' });
    }
});

// Update MS mechanic (partial update)
app.patch('/api/ms-mechanics/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Check if mechanic exists
        const existCheck = await pool.query('SELECT id FROM "MS_mechanic" WHERE id = $1', [id]);
        if (existCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'MS Mechanic not found' });
        }

        // Build dynamic update query
        const allowedFields = [
            'shop_name', 'shop_address', 'shop_latitude', 'shop_longitude',
            'is_verified', 'status', 'user_id', 'KYC_document', 'adhar_card',
            'current_latitude', 'current_longitude',
            'full_name', 'phone', 'email', 'yes_for_startup', 'notes',
            'profile_photo', 'shop_photo', 'shop_google_map_link',
            'special_skills', 'vehicle_type',
            'electric', 'electric_vehicle_types',
            'fuel_delivery_types', 'services_offered', 'working_hours'
        ];

        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                const columnName = key === 'KYC_document' ? '"KYC_document"' : key;
                setClauses.push(`${columnName} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        setClauses.push(`updated_at = NOW()`);
        values.push(id);

        const query = `
            UPDATE "MS_mechanic" 
            SET ${setClauses.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        res.json({
            success: true,
            message: 'MS Mechanic updated successfully',
            mechanic: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating MS mechanic:', error);
        res.status(500).json({ success: false, error: 'Failed to update MS mechanic' });
    }
});

// Delete MS mechanic
app.delete('/api/ms-mechanics/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM "MS_mechanic" WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'MS Mechanic not found' });
        }

        res.json({
            success: true,
            message: 'MS Mechanic deleted successfully',
            deleted: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting MS mechanic:', error);
        res.status(500).json({ success: false, error: 'Failed to delete MS mechanic' });
    }
});

// Update MS mechanic location
app.put('/api/ms-mechanics/:id/location', async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude } = req.body;

        const result = await pool.query(
            `UPDATE "MS_mechanic" 
             SET current_latitude = $1, current_longitude = $2, updated_at = NOW()
             WHERE id = $3 RETURNING *`,
            [latitude || null, longitude || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'MS Mechanic not found' });
        }

        res.json({
            success: true,
            message: 'Location updated',
            mechanic: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ success: false, error: 'Failed to update location' });
    }
});

// Toggle MS mechanic status (ONLINE/OFFLINE)
app.put('/api/ms-mechanics/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (status && !['ONLINE', 'OFFLINE'].includes(status.toUpperCase())) {
            return res.status(400).json({
                success: false,
                error: 'Status must be ONLINE or OFFLINE'
            });
        }

        const result = await pool.query(
            `UPDATE "MS_mechanic" 
             SET status = $1, updated_at = NOW()
             WHERE id = $2 RETURNING *`,
            [status ? status.toUpperCase() : 'OFFLINE', id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'MS Mechanic not found' });
        }

        res.json({
            success: true,
            message: `Status changed to ${result.rows[0].status}`,
            mechanic: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ success: false, error: 'Failed to update status' });
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

// Start server (Vercel sets VERCEL=1, so this won't run on Vercel)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on:`);
        console.log(`   Local:   http://localhost:${PORT}`);
    });
}


