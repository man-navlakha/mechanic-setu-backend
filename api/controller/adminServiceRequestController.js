const pool = require('../../db');

// GET /api/service-requests/admin — List all service requests with summary
exports.getAllServiceRequests = async (req, res) => {
    try {
        const { limit = 50, offset = 0, status, search } = req.query;

        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
        const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

        const clauses = [];
        const params = [];

        if (status) {
            params.push(status);
            clauses.push(`sr.status = $${params.length}`);
        }

        if (search) {
            params.push(`%${search}%`);
            clauses.push(`(
                u.first_name ILIKE $${params.length}
                OR u.last_name ILIKE $${params.length}
                OR u.email ILIKE $${params.length}
                OR sr.location ILIKE $${params.length}
                OR sr.problem ILIKE $${params.length}
            )`);
        }

        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

        const query = `
            SELECT
                sr.id,
                sr.status,
                sr.vehical_type,
                sr.problem,
                sr.additional_details,
                sr.price,
                sr.location,
                sr.latitude,
                sr.longitude,
                sr.cancellation_reason,
                sr.vehical_details,
                sr.created_at,
                sr.updated_at,

                -- User info
                sr.user_id,
                u.first_name AS user_first_name,
                u.last_name AS user_last_name,
                u.email AS user_email,
                u.mobile_number AS user_phone,

                -- Assigned mechanic info
                sr.assigned_mechanic_id,
                ms.full_name AS mechanic_name,
                ms.phone AS mechanic_phone,
                ms.shop_name AS mechanic_shop

            FROM jobs_servicerequest sr
            LEFT JOIN users_customuser u ON u.id = sr.user_id
            LEFT JOIN "MS_mechanic" ms ON ms.id = sr.assigned_mechanic_id

            ${whereSql}
            ORDER BY sr.created_at DESC
            LIMIT $${params.length + 1}
            OFFSET $${params.length + 2}
        `;

        params.push(safeLimit, safeOffset);

        const countParams = params.slice(0, params.length - 2);
        const countQuery = `
            SELECT COUNT(*)
            FROM jobs_servicerequest sr
            LEFT JOIN users_customuser u ON u.id = sr.user_id
            ${whereSql}
        `;

        const [dataResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        return res.status(200).json({
            success: true,
            total_requests: parseInt(countResult.rows[0]?.count || '0', 10),
            page_size: safeLimit,
            offset: safeOffset,
            service_requests: dataResult.rows
        });
    } catch (error) {
        console.error('Error fetching service requests:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch service requests' });
    }
};

// GET /api/service-requests/admin/:id — Full detail for a single service request
exports.getServiceRequestById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT
                sr.id,
                sr.status,
                sr.vehical_type,
                sr.problem,
                sr.additional_details,
                sr.price,
                sr.location,
                sr.latitude,
                sr.longitude,
                sr.cancellation_reason,
                sr.vehical_details,
                sr.created_at,
                sr.updated_at,

                -- Full user info
                sr.user_id,
                u.first_name AS user_first_name,
                u.last_name AS user_last_name,
                u.email AS user_email,
                u.mobile_number AS user_phone,
                u.profile_pic AS user_profile_pic,
                u.date_joined AS user_joined,

                -- Full mechanic info
                sr.assigned_mechanic_id,
                ms.full_name AS mechanic_name,
                ms.phone AS mechanic_phone,
                ms.email AS mechanic_email,
                ms.shop_name AS mechanic_shop,
                ms.shop_address AS mechanic_shop_address,
                ms.shop_latitude AS mechanic_shop_lat,
                ms.shop_longitude AS mechanic_shop_lon,
                ms.profile_photo AS mechanic_profile_photo,
                ms.status AS mechanic_status,
                ms.is_verified AS mechanic_verified,
                ms.special_skills AS mechanic_skills,
                ms.vehicle_type AS mechanic_vehicle_types,
                ms.services_offered AS mechanic_services_offered,
                ms.service_ids AS mechanic_service_ids,
                ms.working_hours AS mechanic_working_hours

            FROM jobs_servicerequest sr
            LEFT JOIN users_customuser u ON u.id = sr.user_id
            LEFT JOIN "MS_mechanic" ms ON ms.id = sr.assigned_mechanic_id
            WHERE sr.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Service request not found' });
        }

        const row = result.rows[0];

        // Structure the response cleanly
        return res.status(200).json({
            success: true,
            service_request: {
                id: row.id,
                status: row.status,
                vehical_type: row.vehical_type,
                problem: row.problem,
                additional_details: row.additional_details,
                price: row.price,
                location: row.location,
                latitude: row.latitude,
                longitude: row.longitude,
                cancellation_reason: row.cancellation_reason,
                vehical_details: row.vehical_details,
                created_at: row.created_at,
                updated_at: row.updated_at,

                user: {
                    id: row.user_id,
                    first_name: row.user_first_name,
                    last_name: row.user_last_name,
                    email: row.user_email,
                    phone: row.user_phone,
                    profile_pic: row.user_profile_pic,
                    date_joined: row.user_joined
                },

                mechanic: row.assigned_mechanic_id ? {
                    id: row.assigned_mechanic_id,
                    full_name: row.mechanic_name,
                    phone: row.mechanic_phone,
                    email: row.mechanic_email,
                    shop_name: row.mechanic_shop,
                    shop_address: row.mechanic_shop_address,
                    shop_latitude: row.mechanic_shop_lat,
                    shop_longitude: row.mechanic_shop_lon,
                    profile_photo: row.mechanic_profile_photo,
                    status: row.mechanic_status,
                    is_verified: row.mechanic_verified,
                    special_skills: row.mechanic_skills,
                    vehicle_type: row.mechanic_vehicle_types,
                    services_offered: row.mechanic_services_offered,
                    service_ids: row.mechanic_service_ids,
                    working_hours: row.mechanic_working_hours
                } : null
            }
        });
    } catch (error) {
        console.error('Error fetching service request detail:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch service request detail' });
    }
};
