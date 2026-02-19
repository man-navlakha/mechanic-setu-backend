const pool = require('../../db');

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
                vehicle_id, vehicle_type, service_type,
                problem, additional_details,
                location, latitude, longitude,
                preferred_date, preferred_time, preferred_day,
                status, raw_payload
            ) VALUES (
                $1,$2,$3,
                $4,$5,$6,
                $7,$8,
                $9,$10,$11,
                $12,$13,$14,
                $15,$16
            )
            RETURNING *;
        `;

        const values = [
            userId,
            mechanicId,
            vehicleRcId,
            vehicleId,
            vehicleType,
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
