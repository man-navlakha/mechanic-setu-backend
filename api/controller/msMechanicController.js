const pool = require('../../db');
const { calculateDistance } = require('../utils/geo');

exports.getAllMsMechanics = async (req, res) => {
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
};

exports.getNearbyMsMechanics = async (req, res) => {
    try {
        const { latitude, longitude, radius = 10, limit = 20, onlineOnly = false, service_id } = req.query;

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

        const parsedServiceId = service_id ? parseInt(service_id, 10) : null;

        const mechanicsWithDistance = result.rows
            .map(m => {
                const mechanicLat = m.current_latitude || m.shop_latitude;
                const mechanicLon = m.current_longitude || m.shop_longitude;
                const distance = calculateDistance(userLat, userLon, mechanicLat, mechanicLon);
                return { ...m, distance_km: distance, distance_text: distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance} km` };
            })
            .filter(m => m.distance_km <= searchRadius)
            .filter(m => !parsedServiceId || (Array.isArray(m.service_ids) && m.service_ids.includes(parsedServiceId)))
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
};

exports.getMsMechanicById = async (req, res) => {
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
};

exports.createMsMechanic = async (req, res) => {
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
};

exports.updateMsMechanic = async (req, res) => {
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
            'fuel_delivery_types', 'services_offered', 'working_hours', 'service_ids'
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
};

exports.deleteMsMechanic = async (req, res) => {
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
};

exports.updateMsMechanicLocation = async (req, res) => {
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
};

exports.updateMsMechanicStatus = async (req, res) => {
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
};