const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { config } = require('./config');
const { pool } = require('./db/pool');
const { router: apiRouter } = require('./routes/api');
const { router: eventsRouter } = require('./routes/events');
const { errorHandler } = require('./middleware/error-handler');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin(origin, callback) {
        if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
    }
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', async (req, res, next) => {
    try {
        await pool.query('SELECT 1');
        res.json({ data: { ok: true, service: 'quinn-house-api' } });
    } catch (error) {
        next(error);
    }
});

app.use('/api/v1', eventsRouter);
app.use('/api/v1', apiRouter);
app.use(errorHandler);

const server = app.listen(config.port, async () => {
    console.log(`Quinn House API listening on port ${config.port}`);
    
    // Auto-seed if database rooms table is empty
    try {
        const roomsCountRes = await pool.query('SELECT COUNT(*) FROM rooms');
        const count = parseInt(roomsCountRes.rows[0].count, 10);
        if (count === 0) {
            console.log('Database rooms table is empty. Running auto-seeder...');
            const { runSeeder } = require('../scripts/seed-from-state.js');
            
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await runSeeder(client);
                await client.query('COMMIT');
                console.log('Database auto-seeded successfully!');
            } catch (seedErr) {
                await client.query('ROLLBACK');
                console.error('Auto-seed transaction failed, rolled back:', seedErr);
            } finally {
                client.release();
            }
        }
    } catch (dbErr) {
        console.error('Failed to run auto-seed check:', dbErr);
    }
});

function shutdown() {
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { app };
