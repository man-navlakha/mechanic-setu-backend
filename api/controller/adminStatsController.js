const pool = require('../../db');

// GET /api/admin/stats — Dashboard stats: users, requests, mechanics, popular services
exports.getStats = async (req, res) => {
    try {
        // Run all stat queries in parallel
        const [
            totalUsersResult,
            totalRequestsResult,
            requestsByStatusResult,
            activeMechanicsResult,
            popularServicesResult,
            averageRequestPriceResult,
            recentRequestsResult
        ] = await Promise.all([
            // 1. Total users
            pool.query(`SELECT COUNT(*) as total FROM users_customuser`),

            // 2. Total service requests
            pool.query(`SELECT COUNT(*) as total FROM jobs_servicerequest`),

            // 3. Requests by status breakdown
            pool.query(`
                SELECT status, COUNT(*) as count
                FROM jobs_servicerequest
                GROUP BY status
                ORDER BY count DESC
            `),

            // 4. Active mechanics (online MS mechanics)
            pool.query(`
                SELECT COUNT(*) as total FROM "MS_mechanic" WHERE status = 'ONLINE'
            `),

            // 5. Popular services (most requested)
            pool.query(`
                SELECT
                    s.id,
                    s.name,
                    s.icon,
                    COUNT(sr.id) as request_count
                FROM services s
                LEFT JOIN jobs_servicerequest sr ON sr.problem ILIKE '%' || s.name || '%'
                    OR sr.additional_details ILIKE '%' || s.name || '%'
                GROUP BY s.id, s.name, s.icon
                ORDER BY request_count DESC
                LIMIT 10
            `),

            // 6. Average request price
            pool.query(`
                SELECT
                    ROUND(AVG(price)::numeric, 2) as average_price,
                    MIN(price) as min_price,
                    MAX(price) as max_price
                FROM jobs_servicerequest
                WHERE price IS NOT NULL AND price > 0
            `),

            // 7. Recent requests (last 5)
            pool.query(`
                SELECT
                    sr.id,
                    sr.status,
                    sr.vehical_type,
                    sr.problem,
                    sr.price,
                    sr.created_at,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM jobs_servicerequest sr
                LEFT JOIN users_customuser u ON u.id = sr.user_id
                ORDER BY sr.created_at DESC
                LIMIT 5
            `)
        ]);

        const totalUsers = parseInt(totalUsersResult.rows[0]?.total || '0', 10);
        const totalRequests = parseInt(totalRequestsResult.rows[0]?.total || '0', 10);
        const activeMechanics = parseInt(activeMechanicsResult.rows[0]?.total || '0', 10);

        // Format requests by status
        const requestsByStatus = {};
        requestsByStatusResult.rows.forEach(row => {
            requestsByStatus[row.status] = parseInt(row.count, 10);
        });

        // Popular services
        const popularServices = popularServicesResult.rows.map(row => ({
            id: row.id,
            name: row.name,
            icon: row.icon,
            request_count: parseInt(row.request_count, 10)
        }));

        // Price stats
        const priceStats = {
            average: parseFloat(averageRequestPriceResult.rows[0]?.average_price || '0'),
            min: parseFloat(averageRequestPriceResult.rows[0]?.min_price || '0'),
            max: parseFloat(averageRequestPriceResult.rows[0]?.max_price || '0')
        };

        // Recent requests
        const recentRequests = recentRequestsResult.rows.map(row => ({
            id: row.id,
            status: row.status,
            vehical_type: row.vehical_type,
            problem: row.problem,
            price: row.price,
            user_name: `${row.first_name} ${row.last_name}`.trim() || 'Unknown',
            user_email: row.email,
            created_at: row.created_at
        }));

        return res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            stats: {
                users: {
                    total: totalUsers
                },

                requests: {
                    total: totalRequests,
                    by_status: requestsByStatus,
                    average_price: priceStats.average,
                    price_range: {
                        min: priceStats.min,
                        max: priceStats.max
                    }
                },

                mechanics: {
                    active_online: activeMechanics
                },

                services: {
                    popular: popularServices
                },

                recent_requests: recentRequests
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
};
