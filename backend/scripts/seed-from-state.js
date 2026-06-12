require('dotenv').config();

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Client } = require('pg');
const { parseDate } = require('../src/utils/dates');

function loadLegacyState() {
    const storage = new Map();
    const context = {
        window: {},
        console,
        localStorage: {
            getItem: key => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key)
        },
        Intl,
        Date,
        Math,
        JSON,
        setTimeout,
        clearTimeout
    };

    context.window = context;

    const statePath = [
        path.join(__dirname, '..', 'state.js'),
        path.join(__dirname, '..', '..', 'state.js')
    ].find(candidate => fs.existsSync(candidate));

    if (!statePath) {
        throw new Error('Cannot find legacy state.js for seeding');
    }

    const source = fs.readFileSync(statePath, 'utf8');
    vm.runInNewContext(source, context, { filename: statePath });

    return {
        settings: context.window.QuinnState.getSettings(),
        rooms: context.window.QuinnState.getRooms(),
        invoices: context.window.QuinnState.getInvoices(),
        contracts: context.window.QuinnState.getContracts()
    };
}

async function upsertSettings(client, settings) {
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
}

async function upsertRoom(client, room) {
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
}

async function upsertTenantAndContract(client, room) {
    if (!room.tenant) return null;

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

    return tenantId;
}

async function upsertUtilityHistory(client, room) {
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
}

async function upsertMaintenance(client, room) {
    await client.query('DELETE FROM maintenance_logs WHERE room_id = $1', [room.id]);

    for (const item of room.maintenanceLogs || []) {
        await client.query(`
            INSERT INTO maintenance_logs (legacy_id, room_id, title, log_date, status)
            VALUES ($1, $2, $3, $4, $5)
        `, [item.id || null, room.id, item.title, parseDate(item.date), item.status || 'Mới']);
    }
}

async function upsertInvoices(client, invoices) {
    for (const invoice of invoices) {
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
}

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required');
    }

    const state = loadLegacyState();
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        await client.query('BEGIN');
        await upsertSettings(client, state.settings);
        for (const room of state.rooms) {
            await upsertRoom(client, room);
            await upsertTenantAndContract(client, room);
            await upsertUtilityHistory(client, room);
            await upsertMaintenance(client, room);
        }
        await upsertInvoices(client, state.invoices);
        await client.query('COMMIT');
        console.log(`Seeded ${state.rooms.length} rooms and ${state.invoices.length} invoices from state.js`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        await client.end();
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
