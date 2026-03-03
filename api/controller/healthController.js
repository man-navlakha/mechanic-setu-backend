const pool = require('../../db');

exports.getHome = (req, res) => {
    res.json({
        status: 'ok',
        message: 'Mechanic Setu API is running',
        version: '1.0.0',
        endpoints: {
            health: 'GET /',
            mechanics: {
                all: 'GET /api/mechanics',
                nearby: 'GET /api/mechanics/nearby?latitude=XX&longitude=XX&radius=10',
                byId: 'GET /api/mechanics/:id'
            },
            ms_mechanics: {
                all: 'GET /api/ms-mechanics',
                nearby: 'GET /api/ms-mechanics/nearby?latitude=XX&longitude=XX&radius=10',
                byId: 'GET /api/ms-mechanics/:id',
                create: 'POST /api/ms-mechanics',
                update: 'PATCH /api/ms-mechanics/:id',
                delete: 'DELETE /api/ms-mechanics/:id',
                updateLocation: 'PUT /api/ms-mechanics/:id/location',
                updateStatus: 'PUT /api/ms-mechanics/:id/status'
            }
        }
    });
};

exports.getHealth = (req, res) => {
    res.json({ status: 'ok', message: 'Mechanic Setu API is running' });
};

// GET /api/schema — returns all public tables with their column definitions
exports.getSchema = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                c.table_name,
                c.column_name,
                c.data_type,
                c.udt_name,
                c.character_maximum_length,
                c.is_nullable,
                c.column_default,
                c.ordinal_position,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT ku.table_name, ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku
                  ON tc.constraint_name = ku.constraint_name
                 AND tc.table_schema = ku.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = 'public'
            ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
            WHERE c.table_schema = 'public'
            ORDER BY c.table_name, c.ordinal_position
        `);

        // Group columns by table
        const schema = {};
        for (const row of result.rows) {
            if (!schema[row.table_name]) {
                schema[row.table_name] = { table: row.table_name, columns: [] };
            }
            schema[row.table_name].columns.push({
                name: row.column_name,
                type: row.udt_name === 'varchar' ? `varchar(${row.character_maximum_length})` : row.data_type,
                nullable: row.is_nullable === 'YES',
                default: row.column_default,
                primary_key: row.is_primary_key
            });
        }

        const tables = Object.values(schema);

        return res.status(200).json({
            success: true,
            total_tables: tables.length,
            tables
        });
    } catch (error) {
        console.error('Error fetching schema:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch schema' });
    }
};