const express = require('express');
const { requireApiKey } = require('../middleware/auth');
const { subscribe } = require('../services/event-bus');

const router = express.Router();

router.get('/events', requireApiKey, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = event => {
        res.write(`id: ${event.id || Date.now()}\n`);
        res.write(`event: ${event.event_type || 'message'}\n`);
        res.write(`data: ${JSON.stringify(event.payload || event)}\n\n`);
    };

    send({ event_type: 'connected', payload: { ok: true } });

    const unsubscribe = subscribe(send);
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
    });
});

module.exports = { router };
