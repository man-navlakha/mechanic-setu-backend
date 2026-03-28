const pool = require('../db');

function hasApplyFlag(argv) {
    return argv.includes('--apply');
}

async function tableExists(client, tableName) {
    const result = await client.query(
        `SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
        ) AS exists`,
        [tableName]
    );

    return result.rows[0]?.exists === true;
}

async function getDuplicateGroups(client) {
    const result = await client.query(`
        WITH ranked AS (
            SELECT
                id,
                shop_name,
                full_name,
                created_at,
                LOWER(TRIM(COALESCE(shop_name, ''))) AS shop_name_key,
                LOWER(TRIM(COALESCE(full_name, ''))) AS full_name_key,
                ROW_NUMBER() OVER (
                    PARTITION BY LOWER(TRIM(COALESCE(shop_name, ''))), LOWER(TRIM(COALESCE(full_name, '')))
                    ORDER BY created_at ASC NULLS FIRST, id ASC
                ) AS row_number_in_group,
                COUNT(*) OVER (
                    PARTITION BY LOWER(TRIM(COALESCE(shop_name, ''))), LOWER(TRIM(COALESCE(full_name, '')))
                ) AS group_count,
                MIN(id) OVER (
                    PARTITION BY LOWER(TRIM(COALESCE(shop_name, ''))), LOWER(TRIM(COALESCE(full_name, '')))
                ) AS keep_id
            FROM "MS_mechanic"
        )
        SELECT
            keep_id,
            MAX(shop_name) AS shop_name,
            MAX(full_name) AS full_name,
            MAX(group_count)::int AS duplicate_count,
            ARRAY_AGG(id ORDER BY created_at ASC NULLS FIRST, id ASC) AS ids
        FROM ranked
        WHERE group_count > 1
        GROUP BY shop_name_key, full_name_key, keep_id
        ORDER BY MAX(group_count) DESC, MAX(shop_name) ASC
    `);

    return result.rows;
}

function buildDeletePairs(groups) {
    return groups.flatMap(group =>
        group.ids
            .filter(id => String(id) !== String(group.keep_id))
            .map(id => ({
                delete_id: id,
                keep_id: group.keep_id,
                shop_name: group.shop_name,
                full_name: group.full_name
            }))
    );
}

async function getMsMechanicCount(client) {
    const result = await client.query('SELECT COUNT(*)::int AS count FROM "MS_mechanic"');
    return result.rows[0]?.count || 0;
}

async function main() {
    const apply = hasApplyFlag(process.argv.slice(2));
    const client = await pool.connect();

    try {
        const beforeCount = await getMsMechanicCount(client);
        const groups = await getDuplicateGroups(client);
        const deletePairs = buildDeletePairs(groups);
        const deleteIds = deletePairs.map(pair => pair.delete_id);

        const summary = {
            apply,
            duplicate_groups: groups.length,
            duplicate_rows_to_delete: deletePairs.length,
            groups_preview: groups.slice(0, 20),
            deleted_preview: deletePairs.slice(0, 20)
        };

        const hasJobsServiceRequest = await tableExists(client, 'jobs_servicerequest');

        if (!apply) {
            let referencedRequests = 0;

            if (hasJobsServiceRequest && deleteIds.length > 0) {
                const result = await client.query(
                    'SELECT COUNT(*)::int AS count FROM jobs_servicerequest WHERE assigned_mechanic_id = ANY($1::bigint[])',
                    [deleteIds]
                );
                referencedRequests = result.rows[0]?.count || 0;
            }

            console.log(JSON.stringify({
                ...summary,
                referenced_jobs_servicerequest_rows: referencedRequests,
                message: 'Dry run only. Re-run with --apply to delete duplicates.'
            }, null, 2));
            return;
        }

        await client.query('BEGIN');

        let reassignedRequests = 0;

        if (hasJobsServiceRequest && deletePairs.length > 0) {
            for (const pair of deletePairs) {
                const result = await client.query(
                    `UPDATE jobs_servicerequest
                     SET assigned_mechanic_id = $1
                     WHERE assigned_mechanic_id = $2`,
                    [pair.keep_id, pair.delete_id]
                );
                reassignedRequests += result.rowCount;
            }
        }

        let deletedRows = 0;

        if (deleteIds.length > 0) {
            await client.query(
                'DELETE FROM "MS_mechanic" WHERE id = ANY($1::bigint[])',
                [deleteIds]
            );
        }

        await client.query('COMMIT');
        const afterCount = await getMsMechanicCount(client);
        deletedRows = beforeCount - afterCount;

        console.log(JSON.stringify({
            ...summary,
            deleted_rows: deletedRows,
            reassigned_jobs_servicerequest_rows: reassignedRequests,
            message: 'Duplicate MS_mechanic rows removed successfully.'
        }, null, 2));
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch {}
        console.error(error);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main();
