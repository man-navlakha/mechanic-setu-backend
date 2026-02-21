-- Add vehicle_category column to vehicle_rc_info and request_js if missing
ALTER TABLE IF EXISTS vehicle_rc_info
    ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(50);

ALTER TABLE IF EXISTS request_js
    ADD COLUMN IF NOT EXISTS vehicle_category VARCHAR(50);
