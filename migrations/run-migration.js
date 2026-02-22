const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigration() {
    try {
        const arg = process.argv[2];
        const migrationsDir = __dirname;

        const runSqlFile = async (filename) => {
            const sqlFile = path.join(migrationsDir, filename);
            const sql = fs.readFileSync(sqlFile, 'utf8');
            console.log(`🔄 Applying migration: ${filename}`);
            await pool.query(sql);
            console.log(`✅ Applied: ${filename}`);
        };

        if (arg) {
            await runSqlFile(arg);
            process.exit(0);
        }

        const sqlFiles = fs.readdirSync(migrationsDir)
            .filter((name) => name.toLowerCase().endsWith('.sql'))
            .sort((a, b) => a.localeCompare(b));

        if (!sqlFiles.length) {
            console.log('ℹ️ No .sql files found in migrations/');
            process.exit(0);
        }

        console.log(`🔄 Running ${sqlFiles.length} migration(s)...`);
        for (const filename of sqlFiles) {
            // Files are written with IF NOT EXISTS and safe to re-run.
            await runSqlFile(filename);
        }

        console.log('🎉 All migrations applied successfully.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

runMigration();
