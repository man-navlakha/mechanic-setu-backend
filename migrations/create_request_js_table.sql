-- Create request_js table to store customer service/breakdown requests
CREATE TABLE IF NOT EXISTS request_js (
    id BIGSERIAL PRIMARY KEY,

    -- Foreign keys (kept nullable so guests can submit requests)
    user_id BIGINT,
    mechanic_id BIGINT,
    vehicle_rc_id BIGINT,

    -- Vehicle & service context
    vehicle_id VARCHAR(20),
    vehicle_type VARCHAR(50),
    service_type VARCHAR(100),
    problem TEXT,
    additional_details TEXT,

    -- Location
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    -- Scheduling preferences
    preferred_date DATE,
    preferred_time TIME,
    preferred_day VARCHAR(20),

    status VARCHAR(32) DEFAULT 'PENDING',

    -- Raw request payload for auditing/debugging
    raw_payload JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add FK to vehicle_rc_info if that table exists (keeps migration idempotent)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'vehicle_rc_info'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_request_js_vehicle_rc_id'
              AND table_name = 'request_js'
        ) THEN
            ALTER TABLE request_js
            ADD CONSTRAINT fk_request_js_vehicle_rc_id
            FOREIGN KEY (vehicle_rc_id)
            REFERENCES vehicle_rc_info(id)
            ON DELETE SET NULL;
        END IF;
    END IF;
END$$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_request_js_user ON request_js(user_id);
CREATE INDEX IF NOT EXISTS idx_request_js_mechanic ON request_js(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_request_js_vehicle_id ON request_js(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_request_js_status ON request_js(status);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION update_request_js_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_request_js_updated_at ON request_js;
CREATE TRIGGER trigger_update_request_js_updated_at
    BEFORE UPDATE ON request_js
    FOR EACH ROW
    EXECUTE FUNCTION update_request_js_updated_at();

COMMENT ON TABLE request_js IS 'Stores customer service/breakdown requests originating from web/app forms';
COMMENT ON COLUMN request_js.raw_payload IS 'Original request payload as received by the API';
