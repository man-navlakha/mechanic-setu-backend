const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
    try {
        console.log('🔄 Running vehicle RC table migration...');

        // Read the SQL file
        const sqlFile = path.join(__dirname, 'create_vehicle_rc_table.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        // Execute the SQL
        await pool.query(sql);

        console.log('✅ Migration completed successfully!');
        console.log('   - Created table: vehicle_rc_info');
        console.log('   - Created indexes for vehicle_id, license_plate, owner_name');
        console.log('   - Created automatic updated_at trigger');

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

runMigration();
