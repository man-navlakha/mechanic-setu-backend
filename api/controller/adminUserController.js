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

// POST /api/user/admin — Create a new user
exports.createUser = async (req, res) => {
    try {
        const { email, password, first_name, last_name, mobile_number, is_staff, is_superuser } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ success: false, error: 'Invalid email format' });
        }

        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users_customuser WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'User with this email already exists' });
        }

        // Hash password
        const crypto = require('crypto');
        const saltRounds = 10;
        // Simple password hashing (consider using bcrypt in production)
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

        // Create user
        const result = await pool.query(
            `INSERT INTO users_customuser 
             (email, password, first_name, last_name, mobile_number, is_staff, is_superuser, is_active, date_joined)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
             RETURNING id, email, first_name, last_name, mobile_number, is_staff, is_superuser, is_active, date_joined`,
            [email, passwordHash, first_name || '', last_name || '', mobile_number || '', 
             is_staff || false, is_superuser || false]
        );

        const newUser = result.rows[0];

        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: newUser
        });
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ success: false, error: 'Failed to create user' });
    }
};

// PATCH /api/user/admin/:id — Update a user
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, mobile_number, email, is_active, is_staff, is_superuser } = req.body;

        // Verify user exists
        const userExists = await pool.query(
            'SELECT id FROM users_customuser WHERE id = $1',
            [id]
        );

        if (userExists.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // If email is being updated, check for duplicates
        if (email) {
            const emailExists = await pool.query(
                'SELECT id FROM users_customuser WHERE email = $1 AND id != $2',
                [email, id]
            );

            if (emailExists.rows.length > 0) {
                return res.status(409).json({ success: false, error: 'Email already in use by another user' });
            }
        }

        // Build update query dynamically based on provided fields
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (first_name !== undefined) {
            updates.push(`first_name = $${paramIndex++}`);
            params.push(first_name);
        }
        if (last_name !== undefined) {
            updates.push(`last_name = $${paramIndex++}`);
            params.push(last_name);
        }
        if (mobile_number !== undefined) {
            updates.push(`mobile_number = $${paramIndex++}`);
            params.push(mobile_number);
        }
        if (email !== undefined) {
            updates.push(`email = $${paramIndex++}`);
            params.push(email);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            params.push(is_active);
        }
        if (is_staff !== undefined) {
            updates.push(`is_staff = $${paramIndex++}`);
            params.push(is_staff);
        }
        if (is_superuser !== undefined) {
            updates.push(`is_superuser = $${paramIndex++}`);
            params.push(is_superuser);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        params.push(id);

        const updateQuery = `
            UPDATE users_customuser 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING id, email, first_name, last_name, mobile_number, is_staff, is_superuser, is_active, date_joined, last_login
        `;

        const result = await pool.query(updateQuery, params);

        return res.status(200).json({
            success: true,
            message: 'User updated successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ success: false, error: 'Failed to update user' });
    }
};

// DELETE /api/user/admin/:id — Delete a user
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Verify user exists
        const userExists = await pool.query(
            'SELECT id, email FROM users_customuser WHERE id = $1',
            [id]
        );

        if (userExists.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = userExists.rows[0];

        // Cascade delete related records
        await Promise.all([
            // Delete OTP sessions
            pool.query('DELETE FROM auth_otp_sessions WHERE user_id = $1', [id]),
            
            // Delete refresh tokens
            pool.query('DELETE FROM auth_refresh_tokens WHERE user_id = $1', [id]),
            
            // Delete user vehicles
            pool.query('DELETE FROM user_vehicles WHERE user_id = $1', [id]),
            
            // Delete service requests
            pool.query('DELETE FROM request_js WHERE user_id = $1', [id])
        ]);

        // Finally delete the user
        await pool.query('DELETE FROM users_customuser WHERE id = $1', [id]);

        return res.status(200).json({
            success: true,
            message: 'User deleted successfully',
            deleted_user_id: id,
            deleted_user_email: user.email
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
};
