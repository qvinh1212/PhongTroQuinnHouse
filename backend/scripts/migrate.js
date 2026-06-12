require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required');
    }

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version text PRIMARY KEY,
                applied_at timestamptz NOT NULL DEFAULT now()
            )
        `);

        const migrationsDir = path.join(__dirname, '..', 'migrations');
        const files = (await fs.readdir(migrationsDir))
            .filter(file => file.endsWith('.up.sql'))
            .sort();

        for (const file of files) {
            const version = file.replace('.up.sql', '');
            const existing = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
            if (existing.rowCount) {
                console.log(`Skipping ${version}`);
                continue;
            }

            const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
                await client.query('COMMIT');
                console.log(`Applied ${version}`);
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        }
    } finally {
        await client.end();
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
