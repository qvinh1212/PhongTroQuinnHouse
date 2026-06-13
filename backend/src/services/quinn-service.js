const { query, transaction } = require('../db/pool');
const { notFound } = require('../utils/api-error');
const { formatDate, todayVietnamDate } = require('../utils/dates');
const { publish } = require('./event-bus');

function toRoom(row, tenant, utilityHistory = [], maintenanceLogs = []) {
    return {
        id: row.id,
        title: row.title,
        floor: row.floor,
        price: row.price,
        size: row.size,
        status: row.status,
        occupants: row.occupants,
        maxOccupants: row.max_occupants,
        deposit: row.deposit,
        paymentDay: row.payment_day,
        fixedUtilities: row.fixed_utilities,
        furniture: row.furniture || [],
        tenant: tenant ? {
            name: tenant.name,
            phone: tenant.phone,
            startDate: formatDate(tenant.start_date),
            endDate: formatDate(tenant.end_date),
            vehicles: tenant.vehicles
        } : null,
        utilities: { utilityCost: row.current_utility_cost || 0 },
        utilityHistory,
        maintenanceLogs
    };
}

function toInvoice(row) {
    return {
        id: row.id,
        roomId: row.room_id,
        tenantName: row.tenant_name,
        period: row.period,
        createdDate: formatDate(row.created_date),
        roomPrice: row.room_price,
        utilityCost: row.utility_cost,
        servicesCost: row.services_cost,
        total: row.total,
        status: row.status,
        paymentDate: formatDate(row.payment_date),
        details: row.details || {}
    };
}

function toContract(row) {
    return {
        id: row.id,
        roomId: row.room_id,
        tenantName: row.tenant_name,
        startDate: formatDate(row.start_date),
        endDate: formatDate(row.end_date),
        paymentDay: row.payment_day,
        deposit: row.deposit,
        status: row.status
    };
}

async function listRooms() {
    const { rows } = await query(`
        SELECT r.*,
               ur.utility_cost AS current_utility_cost,
               t.id AS tenant_id,
               t.name AS tenant_name,
               t.phone AS tenant_phone,
               t.vehicles AS tenant_vehicles,
               c.start_date AS tenant_start_date,
               c.end_date AS tenant_end_date
        FROM rooms r
        LEFT JOIN LATERAL (
            SELECT utility_cost
            FROM utility_records
            WHERE room_id = r.id
            ORDER BY recorded_date DESC NULLS LAST, created_at DESC
            LIMIT 1
        ) ur ON true
        LEFT JOIN tenants t ON t.room_id = r.id AND t.is_active = true
        LEFT JOIN contracts c ON c.room_id = r.id AND c.tenant_id = t.id AND c.status <> 'Terminated'
        ORDER BY r.floor, r.id
    `);

    const roomIds = rows.map(row => row.id);
    const histories = await getUtilityHistoryMap(roomIds);
    const maintenance = await getMaintenanceMap(roomIds);

    return rows.map(row => toRoom(row, row.tenant_id ? {
        id: row.tenant_id,
        name: row.tenant_name,
        phone: row.tenant_phone,
        vehicles: row.tenant_vehicles,
        start_date: row.tenant_start_date,
        end_date: row.tenant_end_date
    } : null, histories.get(row.id) || [], maintenance.get(row.id) || []));
}

async function getRoom(id) {
    const rooms = await listRooms();
    const room = rooms.find(item => item.id === id);
    if (!room) throw notFound('Room not found');
    return room;
}

async function updateRoom(id, patch) {
    const allowed = {
        title: 'title',
        floor: 'floor',
        price: 'price',
        size: 'size',
        status: 'status',
        occupants: 'occupants',
        maxOccupants: 'max_occupants',
        deposit: 'deposit',
        paymentDay: 'payment_day',
        fixedUtilities: 'fixed_utilities',
        furniture: 'furniture'
    };

    const entries = Object.entries(patch).filter(([key]) => key in allowed);
    if (!entries.length) return getRoom(id);

    const sets = entries.map(([key], index) => `${allowed[key]} = $${index + 2}`);
    const values = entries.map(([, value]) => Array.isArray(value) ? JSON.stringify(value) : value);

    const result = await query(
        `UPDATE rooms SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING id`,
        [id, ...values]
    );

    if (!result.rowCount) throw notFound('Room not found');
    await emitEvent('room.updated', { roomId: id });
    return getRoom(id);
}

async function listInvoices(filters = {}) {
    const clauses = [];
    const values = [];

    if (filters.roomId) {
        values.push(filters.roomId);
        clauses.push(`room_id = $${values.length}`);
    }
    if (filters.period) {
        values.push(filters.period);
        clauses.push(`period = $${values.length}`);
    }
    if (filters.status) {
        values.push(filters.status);
        clauses.push(`status = $${values.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await query(`SELECT * FROM invoices ${where} ORDER BY created_date DESC NULLS LAST, created_at DESC`, values);
    return rows.map(toInvoice);
}

async function updateInvoiceStatus(id, status) {
    const paymentDate = status === 'Paid' ? todayVietnamDate() : null;
    const result = await query(
        `UPDATE invoices SET status = $2, payment_date = $3, updated_at = now() WHERE id = $1 RETURNING *`,
        [id, status, paymentDate]
    );
    if (!result.rowCount) throw notFound('Invoice not found');
    await emitEvent('invoice.updated', { invoiceId: id, status });
    return toInvoice(result.rows[0]);
}

async function listContracts() {
    const { rows } = await query(`
        SELECT c.*, r.payment_day
        FROM contracts c
        LEFT JOIN rooms r ON r.id = c.room_id
        ORDER BY c.end_date ASC NULLS LAST, c.room_id ASC
    `);
    return rows.map(toContract);
}

async function getSettings() {
    const { rows } = await query('SELECT * FROM settings WHERE id = true');
    const row = rows[0];
    return {
        dienGia: row.electricity_price,
        dienMethod: row.electricity_method,
        nuocGia: row.water_price,
        nuocMethod: row.water_method,
        services: row.services || []
    };
}

async function updateSettings(data) {
    const current = await getSettings();
    const next = { ...current, ...data };

    const result = await query(`
        UPDATE settings
        SET electricity_price = $1,
            electricity_method = $2,
            water_price = $3,
            water_method = $4,
            services = $5,
            updated_at = now()
        WHERE id = true
        RETURNING *
    `, [next.dienGia, next.dienMethod, next.nuocGia, next.nuocMethod, JSON.stringify(next.services || [])]);

    await emitEvent('settings.updated', {});
    const row = result.rows[0];
    return {
        dienGia: row.electricity_price,
        dienMethod: row.electricity_method,
        nuocGia: row.water_price,
        nuocMethod: row.water_method,
        services: row.services || []
    };
}

async function getSnapshot() {
    const [settings, rooms, invoices, contracts] = await Promise.all([
        getSettings(),
        listRooms(),
        listInvoices(),
        listContracts()
    ]);

    return {
        version: 'api_v1',
        settings,
        rooms,
        invoices,
        contracts
    };
}

async function getUtilityHistoryMap(roomIds) {
    if (!roomIds.length) return new Map();
    const { rows } = await query(`
        SELECT room_id, period, utility_cost, recorded_date
        FROM utility_records
        WHERE room_id = ANY($1)
        ORDER BY recorded_date DESC NULLS LAST, created_at DESC
    `, [roomIds]);

    return rows.reduce((map, row) => {
        if (!map.has(row.room_id)) map.set(row.room_id, []);
        map.get(row.room_id).push({
            period: row.period,
            utilityCost: row.utility_cost,
            recordedDate: formatDate(row.recorded_date)
        });
        return map;
    }, new Map());
}

async function getMaintenanceMap(roomIds) {
    if (!roomIds.length) return new Map();
    const { rows } = await query(`
        SELECT room_id, legacy_id, title, log_date, status
        FROM maintenance_logs
        WHERE room_id = ANY($1)
        ORDER BY log_date DESC NULLS LAST, created_at DESC
    `, [roomIds]);

    return rows.reduce((map, row) => {
        if (!map.has(row.room_id)) map.set(row.room_id, []);
        map.get(row.room_id).push({
            id: row.legacy_id,
            title: row.title,
            date: formatDate(row.log_date),
            status: row.status
        });
        return map;
    }, new Map());
}

async function emitEvent(eventType, payload) {
    const result = await query(
        'INSERT INTO app_events (event_type, payload) VALUES ($1, $2) RETURNING id, event_type, payload, created_at',
        [eventType, JSON.stringify(payload)]
    );
    publish(result.rows[0]);
}

module.exports = {
    transaction,
    listRooms,
    getRoom,
    updateRoom,
    listInvoices,
    updateInvoiceStatus,
    listContracts,
    getSettings,
    updateSettings,
    getSnapshot,
    emitEvent
};
