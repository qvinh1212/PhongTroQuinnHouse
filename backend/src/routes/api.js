const express = require('express');
const { z } = require('zod');
const { requireApiKey } = require('../middleware/auth');
const { validationError } = require('../utils/api-error');
const service = require('../services/quinn-service');

const router = express.Router();

const roomPatchSchema = z.object({
    title: z.string().min(1).optional(),
    floor: z.number().int().optional(),
    price: z.number().int().nonnegative().optional(),
    size: z.number().int().nonnegative().optional(),
    status: z.enum(['vacant', 'rented', 'repair']).optional(),
    occupants: z.number().int().nonnegative().optional(),
    maxOccupants: z.number().int().positive().optional(),
    deposit: z.number().int().nonnegative().optional(),
    paymentDay: z.string().optional(),
    fixedUtilities: z.number().int().nonnegative().nullable().optional(),
    furniture: z.array(z.string()).optional()
});

const invoiceStatusSchema = z.object({
    status: z.enum(['Unpaid', 'Paid', 'Overdue', 'Cancelled'])
});

const settingsPatchSchema = z.object({
    dienGia: z.number().int().nonnegative().optional(),
    dienMethod: z.string().optional(),
    nuocGia: z.number().int().nonnegative().optional(),
    nuocMethod: z.string().optional(),
    services: z.array(z.unknown()).optional()
});

function parse(schema, body) {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw validationError(result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code
        })));
    }
    return result.data;
}

const { config } = require('../config');

router.get('/debug-status', (req, res) => {
    const key = config.apiKey || '';
    res.json({
        nodeEnv: config.nodeEnv,
        apiKeyConfigured: !!key,
        apiKeyLength: key.length,
        apiKeyHint: key.length > 3 ? `${key.substring(0, 3)}***` : (key.length > 0 ? '***' : '')
    });
});

router.use(requireApiKey);

router.get('/snapshot', async (req, res, next) => {
    try {
        res.json({ data: await service.getSnapshot() });
    } catch (error) {
        next(error);
    }
});

router.post('/sync', async (req, res, next) => {
    try {
        await service.syncState(req.body);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

router.get('/rooms', async (req, res, next) => {
    try {
        res.json({ data: await service.listRooms() });
    } catch (error) {
        next(error);
    }
});

router.get('/rooms/:id', async (req, res, next) => {
    try {
        res.json({ data: await service.getRoom(req.params.id) });
    } catch (error) {
        next(error);
    }
});

router.patch('/rooms/:id', async (req, res, next) => {
    try {
        const patch = parse(roomPatchSchema, req.body);
        res.json({ data: await service.updateRoom(req.params.id, patch) });
    } catch (error) {
        next(error);
    }
});

router.get('/invoices', async (req, res, next) => {
    try {
        res.json({ data: await service.listInvoices(req.query) });
    } catch (error) {
        next(error);
    }
});

router.patch('/invoices/:id/status', async (req, res, next) => {
    try {
        const body = parse(invoiceStatusSchema, req.body);
        res.json({ data: await service.updateInvoiceStatus(req.params.id, body.status) });
    } catch (error) {
        next(error);
    }
});

router.get('/contracts', async (req, res, next) => {
    try {
        res.json({ data: await service.listContracts() });
    } catch (error) {
        next(error);
    }
});

router.get('/settings', async (req, res, next) => {
    try {
        res.json({ data: await service.getSettings() });
    } catch (error) {
        next(error);
    }
});

router.patch('/settings', async (req, res, next) => {
    try {
        const patch = parse(settingsPatchSchema, req.body);
        res.json({ data: await service.updateSettings(patch) });
    } catch (error) {
        next(error);
    }
});

module.exports = { router };
