const { config } = require('../config');

function requireApiKey(req, res, next) {
    if (!config.apiKey) return next();

    const headerKey = req.get('x-api-key');
    const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '');

    if (headerKey === config.apiKey || bearer === config.apiKey) {
        return next();
    }

    return res.status(401).json({
        error: {
            code: 'unauthorized',
            message: 'Missing or invalid API key'
        }
    });
}

module.exports = { requireApiKey };
