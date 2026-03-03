const pool = require('../../db');

// GET /api/services
// Query params: vehicle_type (optional), active (optional, defaults true)
exports.getAllServices = async (req, res) => {
    try {
        const { vehicle_type, active = 'true' } = req.query;

        const params = [];
        const clauses = [];

        if (active !== 'false') {
            clauses.push('is_active = TRUE');
        }

        if (vehicle_type) {
            const normalized = vehicle_type.toLowerCase().trim();
            // Match services that list the requested vehicle type OR 'all'
            params.push(normalized);
            clauses.push(`($${params.length} = ANY(vehicle_types) OR 'all' = ANY(vehicle_types))`);
        }

        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const query = `SELECT * FROM services ${where} ORDER BY id ASC`;

        const result = await pool.query(query, params);

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            services: result.rows
        });
    } catch (error) {
        console.error('Error fetching services:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch services' });
    }
};

// POST /api/services
exports.createService = async (req, res) => {
    try {
        const {
            name,
            description,
            base_price,
            vehicle_types,
            icon,
            max_radius,
            estimated_time,
            is_active
        } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'name is required' });
        }

        const result = await pool.query(
            `INSERT INTO services
                (name, description, base_price, vehicle_types, icon, max_radius, estimated_time, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                name,
                description || null,
                base_price !== undefined ? parseFloat(base_price) : null,
                vehicle_types || [],
                icon || null,
                max_radius !== undefined ? parseInt(max_radius, 10) : 20,
                estimated_time || null,
                is_active !== undefined ? is_active : true
            ]
        );

        return res.status(201).json({ success: true, service: result.rows[0] });
    } catch (error) {
        console.error('Error creating service:', error);
        return res.status(500).json({ success: false, error: 'Failed to create service' });
    }
};

// GET /api/services/:id
exports.getServiceById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM services WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }

        return res.status(200).json({ success: true, service: result.rows[0] });
    } catch (error) {
        console.error('Error fetching service:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch service' });
    }
};
