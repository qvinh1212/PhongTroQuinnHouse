require('dotenv').config();

function parseList(value) {
    return (value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 8080),
    databaseUrl: process.env.DATABASE_URL,
    apiKey: process.env.API_KEY || '',
    corsOrigins: parseList(process.env.CORS_ORIGIN)
};

module.exports = { config };
