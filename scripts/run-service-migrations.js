/**
 * Run pending service migrations against the configured DATABASE_URL.
 * Usage:  node scripts/run-service-migrations.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Run these in order — later migrations depend on the services table
const MIGRATIONS = [
    '20260303_create_services_table.sql',
    '20260303_add_service_id_to_request_js.sql',
    '20260303_add_service_ids_to_ms_mechanic.sql'
];

async function runMigrations() {
    const client = await pool.connect();
    try {
        for (const file of MIGRATIONS) {
            const filePath = path.resolve(__dirname, '../migrations', file);
            const sql = fs.readFileSync(filePath, 'utf8');
            console.log(`\n▶  Running: ${file}`);
            await client.query(sql);
            console.log(`✓  Done:    ${file}`);
        }
        console.log('\n✅ All service migrations applied successfully.\n');
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations();
