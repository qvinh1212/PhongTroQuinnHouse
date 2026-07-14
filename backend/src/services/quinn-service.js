const { query, transaction } = require('../db/pool');
const { notFound } = require('../utils/api-error');
const { formatDate, todayVietnamDate, parseDate } = require('../utils/dates');
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

async function syncState(stateData) {
    await transaction(async (client) => {
        // 1. Upsert Settings
        const settings = stateData.settings || {};
        await client.query(`
            INSERT INTO settings (id, electricity_price, electricity_method, water_price, water_method, services)
            VALUES (true, $1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE
            SET electricity_price = EXCLUDED.electricity_price,
                electricity_method = EXCLUDED.electricity_method,
                water_price = EXCLUDED.water_price,
                water_method = EXCLUDED.water_method,
                services = EXCLUDED.services,
                updated_at = now()
        `, [settings.dienGia, settings.dienMethod, settings.nuocGia, settings.nuocMethod, JSON.stringify(settings.services || [])]);

        // Keep track of active tenant IDs to clean up old active ones
        const activeTenantIds = [];

        // 2. Upsert Rooms & Tenants & Contracts & Utility Records & Maintenance Logs
        for (const room of stateData.rooms || []) {
            // Upsert Room
            await client.query(`
                INSERT INTO rooms (id, title, floor, price, size, status, occupants, max_occupants, deposit, payment_day, fixed_utilities, furniture)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (id) DO UPDATE
                SET title = EXCLUDED.title,
                    floor = EXCLUDED.floor,
                    price = EXCLUDED.price,
                    size = EXCLUDED.size,
                    status = EXCLUDED.status,
                    occupants = EXCLUDED.occupants,
                    max_occupants = EXCLUDED.max_occupants,
                    deposit = EXCLUDED.deposit,
                    payment_day = EXCLUDED.payment_day,
                    fixed_utilities = EXCLUDED.fixed_utilities,
                    furniture = EXCLUDED.furniture,
                    updated_at = now()
            `, [
                room.id,
                room.title,
                Number(room.floor || 0),
                Number(room.price || 0),
                Number(room.size || 0),
                room.status,
                Number(room.occupants || 0),
                Number(room.maxOccupants || 1),
                Number(room.deposit || 0),
                room.paymentDay || '',
                room.fixedUtilities ?? null,
                JSON.stringify(room.furniture || [])
            ]);

            // Upsert Tenant and Contract
            if (room.tenant) {
                const existing = await client.query(
                    'SELECT id FROM tenants WHERE room_id = $1 AND name = $2 AND is_active = true LIMIT 1',
                    [room.id, room.tenant.name]
                );

                let tenantId = existing.rows[0]?.id;
                if (tenantId) {
                    await client.query(`
                        UPDATE tenants
                        SET phone = $2, vehicles = $3, updated_at = now()
                        WHERE id = $1
                    `, [tenantId, room.tenant.phone || '', Number(room.tenant.vehicles || 0)]);
                } else {
                    const tenantResult = await client.query(`
                        INSERT INTO tenants (room_id, name, phone, vehicles, is_active)
                        VALUES ($1, $2, $3, $4, true)
                        RETURNING id
                    `, [room.id, room.tenant.name, room.tenant.phone || '', Number(room.tenant.vehicles || 0)]);
                    tenantId = tenantResult.rows[0].id;
                }

                activeTenantIds.push(tenantId);

                const contractId = `CON-${room.id}`;
                await client.query(`
                    INSERT INTO contracts (id, room_id, tenant_id, tenant_name, start_date, end_date, deposit, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
                    ON CONFLICT (id) DO UPDATE
                    SET tenant_id = EXCLUDED.tenant_id,
                        tenant_name = EXCLUDED.tenant_name,
                        start_date = EXCLUDED.start_date,
                        end_date = EXCLUDED.end_date,
                        deposit = EXCLUDED.deposit,
                        updated_at = now()
                `, [
                    contractId,
                    room.id,
                    tenantId,
                    room.tenant.name,
                    parseDate(room.tenant.startDate),
                    parseDate(room.tenant.endDate),
                    Number(room.deposit || 0)
                ]);
            } else {
                // If room has no tenant, mark any active tenants for this room as inactive
                await client.query(
                    'UPDATE tenants SET is_active = false, updated_at = now() WHERE room_id = $1 AND is_active = true',
                    [room.id]
                );
                // Mark active contracts for this room as Terminated
                await client.query(
                    "UPDATE contracts SET status = 'Terminated', updated_at = now() WHERE room_id = $1 AND status <> 'Terminated'",
                    [room.id]
                );
            }

            // Upsert Utility History
            for (const item of room.utilityHistory || []) {
                await client.query(`
                    INSERT INTO utility_records (room_id, period, utility_cost, recorded_date)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (room_id, period) DO UPDATE
                    SET utility_cost = EXCLUDED.utility_cost,
                        recorded_date = EXCLUDED.recorded_date,
                        updated_at = now()
                `, [room.id, item.period, Number(item.utilityCost || 0), parseDate(item.recordedDate)]);
            }

            // Upsert Maintenance Logs
            // Remove existing maintenance logs that are not in the list anymore
            const existingLogs = await client.query('SELECT legacy_id FROM maintenance_logs WHERE room_id = $1', [room.id]);
            const existingLegacyIds = existingLogs.rows.map(row => row.legacy_id).filter(id => id !== null);
            const currentLegacyIds = (room.maintenanceLogs || []).map(log => log.id).filter(id => id);

            const logsToDelete = existingLegacyIds.filter(id => !currentLegacyIds.includes(id));
            if (logsToDelete.length > 0) {
                await client.query('DELETE FROM maintenance_logs WHERE room_id = $1 AND legacy_id = ANY($2)', [room.id, logsToDelete]);
            }

            for (const item of room.maintenanceLogs || []) {
                const existingLog = await client.query(
                    'SELECT id FROM maintenance_logs WHERE room_id = $1 AND legacy_id = $2 LIMIT 1',
                    [room.id, item.id]
                );
                if (existingLog.rows[0]) {
                    await client.query(`
                        UPDATE maintenance_logs
                        SET title = $3, log_date = $4, status = $5, updated_at = now()
                        WHERE id = $1
                    `, [existingLog.rows[0].id, room.id, item.title, parseDate(item.date), item.status || 'Mới']);
                } else {
                    await client.query(`
                        INSERT INTO maintenance_logs (legacy_id, room_id, title, log_date, status)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [item.id || null, room.id, item.title, parseDate(item.date), item.status || 'Mới']);
                }
            }
        }

        // Deactivate tenants that are no longer active globally (not in activeTenantIds)
        if (activeTenantIds.length > 0) {
            await client.query(
                'UPDATE tenants SET is_active = false, updated_at = now() WHERE NOT (id = ANY($1)) AND is_active = true',
                [activeTenantIds]
            );
        } else {
            await client.query(
                'UPDATE tenants SET is_active = false, updated_at = now() WHERE is_active = true'
            );
        }

        // 3. Upsert Invoices
        // Delete invoices that are no longer in the list
        const currentInvoiceIds = (stateData.invoices || []).map(i => i.id);
        if (currentInvoiceIds.length > 0) {
            await client.query('DELETE FROM invoices WHERE id NOT IN (' + currentInvoiceIds.map((_, i) => `$${i + 1}`).join(', ') + ')', currentInvoiceIds);
        } else {
            await client.query('DELETE FROM invoices');
        }

        for (const invoice of stateData.invoices || []) {
            await client.query(`
                INSERT INTO invoices (id, room_id, tenant_name, period, created_date, room_price, utility_cost, services_cost, total, status, payment_date, details)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (id) DO UPDATE
                SET tenant_name = EXCLUDED.tenant_name,
                    period = EXCLUDED.period,
                    created_date = EXCLUDED.created_date,
                    room_price = EXCLUDED.room_price,
                    utility_cost = EXCLUDED.utility_cost,
                    services_cost = EXCLUDED.services_cost,
                    total = EXCLUDED.total,
                    status = EXCLUDED.status,
                    payment_date = EXCLUDED.payment_date,
                    details = EXCLUDED.details,
                    updated_at = now()
            `, [
                invoice.id,
                invoice.roomId,
                invoice.tenantName,
                invoice.period,
                parseDate(invoice.createdDate),
                Number(invoice.roomPrice || 0),
                Number(invoice.utilityCost || 0),
                Number(invoice.servicesCost || 0),
                Number(invoice.total || 0),
                invoice.status,
                parseDate(invoice.paymentDate),
                JSON.stringify(invoice.details || {})
            ]);
        }
    });

    await emitEvent('state.updated', {});
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
    emitEvent,
    syncState
};
