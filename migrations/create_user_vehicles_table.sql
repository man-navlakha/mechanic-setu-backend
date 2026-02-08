-- Create user_vehicles table to link users with their searched/saved vehicles
CREATE TABLE IF NOT EXISTS user_vehicles (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    vehicle_id VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- In case we want to store user-specific notes or status for this vehicle
    is_owner BOOLEAN DEFAULT FALSE,
    notification_enabled BOOLEAN DEFAULT TRUE,
    
    -- Foreign keys (assuming users_customuser exists from Django)
    -- We don't strictly enforce FB here in case tables are managed separately, 
    -- but we can add them if we are sure about the schema.
    -- CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users_customuser(id) ON DELETE CASCADE,
    CONSTRAINT fk_vehicle FOREIGN KEY(vehicle_id) REFERENCES vehicle_rc_info(vehicle_id) ON DELETE CASCADE,
    
    -- Each user can save a vehicle only once
    UNIQUE(user_id, vehicle_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_vehicles_user_id ON user_vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_vehicle_id ON user_vehicles(vehicle_id);

-- Add comments
COMMENT ON TABLE user_vehicles IS 'Links users with vehicles they have searched or saved for notifications';
