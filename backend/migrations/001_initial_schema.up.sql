CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settings (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    electricity_price integer NOT NULL DEFAULT 0,
    electricity_method text NOT NULL DEFAULT '',
    water_price integer NOT NULL DEFAULT 0,
    water_method text NOT NULL DEFAULT '',
    services jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
    id text PRIMARY KEY,
    title text NOT NULL,
    floor integer NOT NULL,
    price integer NOT NULL DEFAULT 0,
    size integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'rented', 'repair')),
    occupants integer NOT NULL DEFAULT 0,
    max_occupants integer NOT NULL DEFAULT 1,
    deposit integer NOT NULL DEFAULT 0,
    payment_day text NOT NULL DEFAULT '',
    fixed_utilities integer,
    furniture jsonb NOT NULL DEFAULT '[]'::jsonb,
    extra jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id text REFERENCES rooms(id) ON DELETE SET NULL,
    name text NOT NULL,
    phone text NOT NULL DEFAULT '',
    vehicles integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    extra jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contracts (
    id text PRIMARY KEY,
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
    tenant_name text NOT NULL,
    start_date date,
    end_date date,
    deposit integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expiring', 'Expired', 'Terminated')),
    extra jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
    id text PRIMARY KEY,
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
    tenant_name text NOT NULL,
    period text NOT NULL,
    created_date date,
    room_price integer NOT NULL DEFAULT 0,
    utility_cost integer NOT NULL DEFAULT 0,
    services_cost integer NOT NULL DEFAULT 0,
    total integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Paid', 'Overdue', 'Cancelled')),
    payment_date date,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS utility_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    invoice_id text REFERENCES invoices(id) ON DELETE SET NULL,
    period text NOT NULL,
    utility_cost integer NOT NULL DEFAULT 0,
    recorded_date date,
    extra jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (room_id, period)
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id integer,
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    title text NOT NULL,
    log_date date,
    status text NOT NULL DEFAULT 'Mới',
    extra jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    display_name text NOT NULL,
    role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'viewer')),
    password_hash text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    before_data jsonb,
    after_data jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_events (
    id bigserial PRIMARY KEY,
    event_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_tenants_room_active ON tenants(room_id, is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_room ON contracts(room_id);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_invoices_room_period ON invoices(room_id, period);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_utility_records_room_period ON utility_records(room_id, period);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_room ON maintenance_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON app_events(created_at);

INSERT INTO settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;
