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

const server = app.listen(config.port, () => {
    console.log(`Quinn House API listening on port ${config.port}`);
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
