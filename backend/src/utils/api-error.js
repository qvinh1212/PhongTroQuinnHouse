class ApiError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

function notFound(message = 'Resource not found') {
    return new ApiError(404, 'not_found', message);
}

function validationError(details) {
    return new ApiError(422, 'validation_error', 'Request validation failed', details);
}

module.exports = { ApiError, notFound, validationError };
