const pool = require('../../db');

// GET /api/vehicle/admin — List all vehicles with owner info and request counts
exports.getAllVehicles = async (req, res) => {
    try {
        const { limit = 50, offset = 0, search, vehicle_category } = req.query;

        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
        const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

        const clauses = [];
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            clauses.push(`(
                v.vehicle_id ILIKE $${params.length}
                OR v.license_plate ILIKE $${params.length}
                OR v.brand_name ILIKE $${params.length}
                OR v.brand_model ILIKE $${params.length}
                OR v.owner_name ILIKE $${params.length}
            )`);
        }

        if (vehicle_category) {
            params.push(vehicle_category.toLowerCase());
            clauses.push(`v.vehicle_category = $${params.length}`);
        }

        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

        const query = `
            SELECT
                v.vehicle_id,
                v.license_plate,
                v.brand_name,
                v.brand_model,
                v.fuel_type,
                v.color,
                v.vehicle_category,
                v.owner_name,
                v.rc_status,
                v.registration_date,
                v.insurance_expiry,
                v.vehicle_image,
                v.created_at,
                v.last_synced_at,

                -- How many users saved this vehicle
                COALESCE(uv.owner_count, 0) AS total_owners,

                -- Service request count for this vehicle
                COALESCE(sr.request_count, 0) AS total_requests

            FROM vehicle_rc_info v

            LEFT JOIN (
                SELECT vehicle_id, COUNT(*) AS owner_count
                FROM user_vehicles
                GROUP BY vehicle_id
            ) uv ON uv.vehicle_id = v.vehicle_id

            LEFT JOIN (
                SELECT vehical_details->>'vehicle_id' AS vid, COUNT(*) AS request_count
                FROM jobs_servicerequest
                WHERE vehical_details IS NOT NULL
                  AND vehical_details->>'vehicle_id' IS NOT NULL
                GROUP BY vehical_details->>'vehicle_id'
            ) sr ON sr.vid = v.vehicle_id

            ${whereSql}
            ORDER BY v.last_synced_at DESC NULLS LAST
            LIMIT $${params.length + 1}
            OFFSET $${params.length + 2}
        `;

        params.push(safeLimit, safeOffset);

        const countParams = params.slice(0, params.length - 2);
        const countQuery = `SELECT COUNT(*) FROM vehicle_rc_info v ${whereSql}`;

        const [dataResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        return res.status(200).json({
            success: true,
            total_vehicles: parseInt(countResult.rows[0]?.count || '0', 10),
            page_size: safeLimit,
            offset: safeOffset,
            vehicles: dataResult.rows
        });
    } catch (error) {
        console.error('Error fetching vehicle list:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch vehicle list' });
    }
};

// GET /api/vehicle/admin/:vehicleId — Full vehicle detail with owners and service history
exports.getVehicleById = async (req, res) => {
    try {
        const vehicleId = req.params.vehicleId?.trim().toUpperCase();

        if (!vehicleId) {
            return res.status(400).json({ success: false, error: 'Vehicle ID is required' });
        }

        // 1. Full vehicle info
        const vehicleResult = await pool.query(
            'SELECT * FROM vehicle_rc_info WHERE vehicle_id = $1',
            [vehicleId]
        );

        if (vehicleResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        const vehicle = vehicleResult.rows[0];

        // Run remaining queries in parallel
        const [ownersResult, requestsResult] = await Promise.all([
            // 2. Users who saved this vehicle
            pool.query(
                `SELECT
                    uv.user_id,
                    uv.is_owner,
                    uv.notification_enabled,
                    uv.created_at AS saved_at,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.mobile_number
                 FROM user_vehicles uv
                 LEFT JOIN users_customuser u ON u.id = uv.user_id
                 WHERE uv.vehicle_id = $1
                 ORDER BY uv.created_at DESC`,
                [vehicleId]
            ),

            // 3. Service requests involving this vehicle
            pool.query(
                `SELECT
                    sr.id,
                    sr.status,
                    sr.vehical_type,
                    sr.problem,
                    sr.additional_details,
                    sr.price,
                    sr.location,
                    sr.cancellation_reason,
                    sr.created_at,
                    sr.updated_at,
                    sr.user_id,
                    u.first_name AS user_first_name,
                    u.last_name AS user_last_name,
                    sr.assigned_mechanic_id,
                    ms.full_name AS mechanic_name
                 FROM jobs_servicerequest sr
                 LEFT JOIN users_customuser u ON u.id = sr.user_id
                 LEFT JOIN "MS_mechanic" ms ON ms.id = sr.assigned_mechanic_id
                 WHERE sr.vehical_details->>'vehicle_id' = $1
                    OR sr.vehical_details->>'license_plate' = $1
                 ORDER BY sr.created_at DESC`,
                [vehicleId]
            )
        ]);

        // Strip raw_response for cleaner output (it's huge)
        const { raw_response, ...vehicleClean } = vehicle;

        return res.status(200).json({
            success: true,
            vehicle: {
                ...vehicleClean,

                total_owners: ownersResult.rows.length,
                owners: ownersResult.rows,

                total_requests: requestsResult.rows.length,
                service_requests: requestsResult.rows
            }
        });
    } catch (error) {
        console.error('Error fetching vehicle detail:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch vehicle detail' });
    }
};

// PATCH /api/vehicle/admin/:vehicleId — Update vehicle fields
exports.updateVehicle = async (req, res) => {
    try {
        const vehicleId = req.params.vehicleId?.trim().toUpperCase();

        if (!vehicleId) {
            return res.status(400).json({ success: false, error: 'Vehicle ID is required' });
        }

        const updates = req.body || {};

        const allowedFields = [
            'license_plate', 'chassis_number', 'engine_number',
            'brand_name', 'brand_model', 'fuel_type', 'color',
            'cubic_capacity', 'cylinders', 'seating_capacity',
            'vehicle_age', 'vehicle_category', 'class', 'norms',
            'owner_name', 'father_name', 'owner_count',
            'present_address', 'permanent_address',
            'registration_date', 'rc_status', 'source',
            'is_financed', 'financer', 'noc_details',
            'insurance_company', 'insurance_policy', 'insurance_expiry',
            'tax_paid_upto', 'tax_upto',
            'permit_type', 'permit_number', 'permit_issue_date',
            'permit_valid_from', 'permit_valid_upto',
            'national_permit_number', 'national_permit_issued_by', 'national_permit_upto',
            'pucc_number', 'pucc_upto', 'vehicle_image'
        ];

        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                const columnName = key === 'class' ? '"class"' : key;
                setClauses.push(`${columnName} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        values.push(vehicleId);

        const result = await pool.query(
            `UPDATE vehicle_rc_info
             SET ${setClauses.join(', ')}
             WHERE vehicle_id = $${paramIndex}
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        const { raw_response, ...vehicleClean } = result.rows[0];

        return res.status(200).json({
            success: true,
            message: `Vehicle ${vehicleId} updated successfully`,
            vehicle: vehicleClean
        });
    } catch (error) {
        console.error('Error updating vehicle:', error);
        return res.status(500).json({ success: false, error: 'Failed to update vehicle' });
    }
};

// DELETE /api/vehicle/admin/:vehicleId — Delete vehicle and unlink from users
exports.deleteVehicle = async (req, res) => {
    try {
        const vehicleId = req.params.vehicleId?.trim().toUpperCase();

        if (!vehicleId) {
            return res.status(400).json({ success: false, error: 'Vehicle ID is required' });
        }

        // Delete user-vehicle links first (FK constraint)
        await pool.query('DELETE FROM user_vehicles WHERE vehicle_id = $1', [vehicleId]);

        // Delete the vehicle
        const result = await pool.query(
            'DELETE FROM vehicle_rc_info WHERE vehicle_id = $1 RETURNING vehicle_id, license_plate, brand_name, brand_model',
            [vehicleId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        return res.status(200).json({
            success: true,
            message: `Vehicle ${vehicleId} deleted successfully`,
            deleted: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        return res.status(500).json({ success: false, error: 'Failed to delete vehicle' });
    }
};
