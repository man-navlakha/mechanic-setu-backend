const pool = require('../../db');

// GET /api/user/admin — List all users with summary info
exports.getAllUsers = async (req, res) => {
    try {
        const { limit = 50, offset = 0, search } = req.query;

        const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
        const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

        const params = [];
        let whereSql = '';

        if (search) {
            params.push(`%${search}%`);
            whereSql = `WHERE u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR u.mobile_number ILIKE $1`;
        }

        const query = `
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.mobile_number,
                u.profile_pic,
                u.is_active,
                u.is_staff,
                u.date_joined,
                u.last_login,

                -- Total vehicles
                COALESCE(v.vehicle_count, 0) AS total_vehicles,

                -- Total service requests
                COALESCE(r.request_count, 0) AS total_services,

                -- Is mechanic (traditional)
                CASE WHEN m.id IS NOT NULL THEN true ELSE false END AS is_mechanic,

                -- Is MS mechanic
                CASE WHEN ms.id IS NOT NULL THEN true ELSE false END AS is_ms_mechanic

            FROM users_customuser u

            LEFT JOIN (
                SELECT user_id, COUNT(*) AS vehicle_count
                FROM user_vehicles
                GROUP BY user_id
            ) v ON v.user_id = u.id

            LEFT JOIN (
                SELECT user_id, COUNT(*) AS request_count
                FROM request_js
                GROUP BY user_id
            ) r ON r.user_id = u.id

            LEFT JOIN (
                SELECT DISTINCT ON (user_id) id, user_id
                FROM users_mechanic
            ) m ON m.user_id = u.id

            LEFT JOIN (
                SELECT DISTINCT ON (user_id) id, user_id
                FROM "MS_mechanic"
                WHERE user_id IS NOT NULL
            ) ms ON ms.user_id = u.id

            ${whereSql}
            ORDER BY u.date_joined DESC
            LIMIT $${params.length + 1}
            OFFSET $${params.length + 2}
        `;

        params.push(safeLimit, safeOffset);

        const countParams = search ? [`%${search}%`] : [];
        const countQuery = `SELECT COUNT(*) FROM users_customuser u ${whereSql}`;

        const [dataResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        // Clean up — never expose password
        const users = dataResult.rows.map(u => {
            const { password, ...safe } = u;
            return safe;
        });

        return res.status(200).json({
            success: true,
            total_users: parseInt(countResult.rows[0]?.count || '0', 10),
            page_size: safeLimit,
            offset: safeOffset,
            users
        });
    } catch (error) {
        console.error('Error fetching user list:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch user list' });
    }
};

// GET /api/user/admin/:id — Full detail for a single user
exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Base user info
        const userResult = await pool.query(
            `SELECT id, first_name, last_name, email, mobile_number, profile_pic,
                    google_id, is_active, is_staff, is_superuser, date_joined, last_login
             FROM users_customuser WHERE id = $1`,
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Run remaining queries in parallel
        const [vehiclesResult, requestsResult, mechanicResult, msMechanicResult] = await Promise.all([
            // 2. Vehicles — join with vehicle_rc_info for plate numbers & details
            pool.query(
                `SELECT
                    uv.vehicle_id,
                    uv.is_owner,
                    uv.created_at AS saved_at,
                    vr.license_plate,
                    vr.brand_name,
                    vr.brand_model,
                    vr.fuel_type,
                    vr.color,
                    vr.vehicle_category,
                    vr.owner_name,
                    vr.registration_date,
                    vr.insurance_expiry,
                    vr.rc_status
                 FROM user_vehicles uv
                 LEFT JOIN vehicle_rc_info vr ON vr.vehicle_id = uv.vehicle_id
                 WHERE uv.user_id = $1
                 ORDER BY uv.created_at DESC`,
                [id]
            ),

            // 3. Service requests — with service name from services table
            pool.query(
                `SELECT
                    rj.id,
                    rj.service_id,
                    s.name AS service_name,
                    s.icon AS service_icon,
                    rj.service_type,
                    rj.vehicle_id,
                    rj.vehicle_type,
                    rj.vehicle_category,
                    rj.problem,
                    rj.additional_details,
                    rj.location,
                    rj.latitude,
                    rj.longitude,
                    rj.preferred_date,
                    rj.preferred_time,
                    rj.status,
                    rj.mechanic_id,
                    rj.created_at,
                    rj.updated_at
                 FROM request_js rj
                 LEFT JOIN services s ON s.id = rj.service_id
                 WHERE rj.user_id = $1
                 ORDER BY rj.created_at DESC`,
                [id]
            ),

            // 4. Traditional mechanic profile
            pool.query(
                `SELECT * FROM users_mechanic WHERE user_id = $1`,
                [id]
            ),

            // 5. MS mechanic profile
            pool.query(
                `SELECT * FROM "MS_mechanic" WHERE user_id = $1`,
                [id]
            )
        ]);

        return res.status(200).json({
            success: true,
            user: {
                ...user,

                // Vehicles
                total_vehicles: vehiclesResult.rows.length,
                vehicles: vehiclesResult.rows,

                // Service requests
                total_services: requestsResult.rows.length,
                service_requests: requestsResult.rows,

                // Mechanic info
                is_mechanic: mechanicResult.rows.length > 0,
                mechanic_profile: mechanicResult.rows[0] || null,

                is_ms_mechanic: msMechanicResult.rows.length > 0,
                ms_mechanic_profile: msMechanicResult.rows[0] || null
            }
        });
    } catch (error) {
        console.error('Error fetching user detail:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch user detail' });
    }
};
