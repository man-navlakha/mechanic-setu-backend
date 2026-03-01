const pool = require('../../../db');

const mapMechanicProfile = (row) => ({
    id: row.mechanic_id,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    profile_pic: row.profile_pic,
    mobile_number: row.mobile_number,
    shop_name: row.shop_name,
    shop_address: row.shop_address,
    shop_latitude: row.shop_latitude,
    shop_longitude: row.shop_longitude,
    status: row.status,
    is_verified: row.is_verified,
    KYC_document: row.kyc_document,
    adhar_card: row.adhar_card
});

exports.getMechanicProfile = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                error: 'Authentication credentials were not provided.'
            });
        }

        const query = `
            SELECT
                m.id AS mechanic_id,
                u.email,
                u.first_name,
                u.last_name,
                u.profile_pic,
                u.mobile_number,
                m.shop_name,
                m.shop_address,
                m.shop_latitude,
                m.shop_longitude,
                m.status,
                m.is_verified,
                m."KYC_document" AS kyc_document,
                m.adhar_card
            FROM users_mechanic m
            JOIN users_customuser u ON m.user_id = u.id
            WHERE m.user_id = $1
            LIMIT 1
        `;

        const result = await pool.query(query, [req.user.id]);

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Mechanic profile not found.' });
        }

        res.json(mapMechanicProfile(result.rows[0]));
    } catch (error) {
        console.error('getMechanicProfile error:', error);
        res.status(500).json({ error: 'Unable to load mechanic profile.' });
    }
};
