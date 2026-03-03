-- Add service_id FK to request_js table
-- Run AFTER 20260303_create_services_table.sql

ALTER TABLE request_js
    ADD COLUMN IF NOT EXISTS service_id INTEGER;

-- Add FK constraint (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_request_js_service_id'
          AND table_name = 'request_js'
    ) THEN
        ALTER TABLE request_js
            ADD CONSTRAINT fk_request_js_service_id
            FOREIGN KEY (service_id)
            REFERENCES services(id)
            ON DELETE SET NULL;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_request_js_service_id ON request_js(service_id);
