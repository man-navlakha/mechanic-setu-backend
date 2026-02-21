const pool = require('../../db');

const inferVehicleCategory = (vehicleType) => {
    const normalized = (vehicleType || '').toString().toLowerCase();

    if (/auto|rickshaw|three/.test(normalized)) return 'autorickshaw';
    if (/scooter|motorcycle|bike|2w|two[-\s]?wheeler/.test(normalized)) return 'bike';
    if (/bus|coach/.test(normalized)) return 'bus';

    // Default bucket for four-wheelers if some type is present
    return normalized ? 'car' : null;
};

// Normalize and save a service/breakdown request into request_js
exports.createServiceRequest = async (req, res) => {
    try {
        const body = req.body || {};

        // Accept both auth cookie user and explicit user_id
        const userId = req.user?.id || body.user_id || null;
        const mechanicId = body.mechanic_id || null;
        const vehicleRcId = body.vehicle_rc_id || null;

        const vehicleId = (body.vehicle_id || body.vehicleId || body.vehicle_number || '').toString().trim() || null;
        const vehicleType = body.vehicle_type || body.vehical_type || null; // tolerate common typo
        const vehicleCategory = body.vehicle_category || inferVehicleCategory(vehicleType);

        const serviceType = body.service_type || body.service || 'GENERAL_SERVICE';
        const problem = body.problem || serviceType || null;
        const additionalDetails = body.additional_details || body.notes || null;

        const location = body.location || null;
        const latitude = body.latitude !== undefined ? parseFloat(body.latitude) : null;
        const longitude = body.longitude !== undefined ? parseFloat(body.longitude) : null;

        const preferredDate = body.date || body.preferred_date || null;   // PG will cast if ISO/date-like
        const preferredTime = body.time || body.preferred_time || null;   // PG will cast if HH:MM[:SS]
        const preferredDay = body.day || body.preferred_day || null;

        const status = body.status || 'PENDING';

        if (!problem) {
            return res.status(400).json({ success: false, error: 'problem or service_type is required' });
        }

        const insertQuery = `
            INSERT INTO request_js (
                user_id, mechanic_id, vehicle_rc_id,
                vehicle_id, vehicle_type, vehicle_category, service_type,
                problem, additional_details,
                location, latitude, longitude,
                preferred_date, preferred_time, preferred_day,
                status, raw_payload
            ) VALUES (
                $1,$2,$3,
                $4,$5,$6,$7,
                $8,$9,
                $10,$11,$12,
                $13,$14,$15,
                $16,$17
            )
            RETURNING *;
        `;

        const values = [
            userId,
            mechanicId,
            vehicleRcId,
            vehicleId,
            vehicleType,
            vehicleCategory,
            serviceType,
            problem,
            additionalDetails,
            location,
            Number.isFinite(latitude) ? latitude : null,
            Number.isFinite(longitude) ? longitude : null,
            preferredDate,
            preferredTime,
            preferredDay,
            status,
            body // store original payload for auditing/debugging
        ];

        const result = await pool.query(insertQuery, values);

        return res.status(201).json({
            success: true,
            message: 'Service request created',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating service request:', error);
        return res.status(500).json({ success: false, error: 'Failed to create service request' });
    }
};

// Fetch the authenticated user's service/breakdown request history
exports.getUserRequestHistory = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'User not authenticated.' });
        }

        const { limit = 50, offset = 0, status, vehicle_id } = req.query;

        // Keep pagination bounded to avoid accidental heavy queries
        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
        const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

        const clauses = ['user_id = $1'];
        const params = [userId];
        let paramIndex = 2;

        if (status) {
            clauses.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        if (vehicle_id) {
            clauses.push(`vehicle_id ILIKE $${paramIndex}`);
            params.push(`%${vehicle_id}%`);
            paramIndex++;
        }

        const whereSql = clauses.join(' AND ');

        const dataQuery = `
            SELECT
                id,
                mechanic_id,
                vehicle_rc_id,
                vehicle_id,
                vehicle_type,
                vehicle_category,
                service_type,
                problem,
                additional_details,
                location,
                latitude,
                longitude,
                preferred_date,
                preferred_time,
                preferred_day,
                status,
                created_at,
                updated_at
            FROM request_js
            WHERE ${whereSql}
            ORDER BY created_at DESC
            LIMIT $${paramIndex}
            OFFSET $${paramIndex + 1};
        `;

        const dataParams = [...params, safeLimit, safeOffset];

        const countQuery = `SELECT COUNT(*) FROM request_js WHERE ${whereSql};`;

        const [countResult, dataResult] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, dataParams)
        ]);

        return res.status(200).json({
            success: true,
            count: parseInt(countResult.rows[0]?.count || '0', 10),
            page_size: safeLimit,
            offset: safeOffset,
            data: dataResult.rows
        });
    } catch (error) {
        console.error('Error fetching user request history:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch request history' });
    }
};
