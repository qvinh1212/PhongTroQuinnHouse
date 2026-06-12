const { ApiError } = require('../utils/api-error');

function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
            error: {
                code: error.code,
                message: error.message,
                details: error.details
            }
        });
    }

    console.error(JSON.stringify({
        level: 'error',
        message: error.message,
        method: req.method,
        path: req.path,
        stack: error.stack
    }));

    return res.status(500).json({
        error: {
            code: 'internal_error',
            message: 'Internal server error'
        }
    });
}

module.exports = { errorHandler };
