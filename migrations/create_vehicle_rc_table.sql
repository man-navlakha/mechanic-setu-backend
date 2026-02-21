-- Create vehicle_rc_info table to store vehicle registration certificate information
CREATE TABLE IF NOT EXISTS vehicle_rc_info (
    id BIGSERIAL PRIMARY KEY,
    
    -- Vehicle Identification
    vehicle_id VARCHAR(20) UNIQUE NOT NULL,
    license_plate VARCHAR(20) NOT NULL,
    chassis_number VARCHAR(50),
    engine_number VARCHAR(50),
    
    -- Vehicle Details
    brand_name VARCHAR(255),
    brand_model VARCHAR(255),
    fuel_type VARCHAR(50),
    color VARCHAR(50),
    cubic_capacity VARCHAR(20),
    cylinders INTEGER,
    seating_capacity VARCHAR(10),
    vehicle_age VARCHAR(50),
    vehicle_category VARCHAR(50),
    class VARCHAR(100),
    norms VARCHAR(50),
    
    -- Owner Information
    owner_name VARCHAR(255),
    father_name VARCHAR(255),
    owner_count VARCHAR(10),
    present_address TEXT,
    permanent_address TEXT,
    
    -- Registration & Status
    registration_date VARCHAR(50),
    rc_status VARCHAR(50),
    source VARCHAR(100),
    
    -- Finance Details
    is_financed VARCHAR(10),
    financer VARCHAR(255),
    noc_details VARCHAR(255),
    
    -- Insurance Details
    insurance_company VARCHAR(255),
    insurance_policy VARCHAR(100),
    insurance_expiry VARCHAR(50),
    
    -- Tax & Permits
    tax_paid_upto VARCHAR(50),
    tax_upto VARCHAR(50),
    permit_type VARCHAR(100),
    permit_number VARCHAR(100),
    permit_issue_date VARCHAR(50),
    permit_valid_from VARCHAR(50),
    permit_valid_upto VARCHAR(50),
    national_permit_number VARCHAR(100),
    national_permit_issued_by VARCHAR(255),
    national_permit_upto VARCHAR(50),
    
    -- Pollution & Other
    pucc_number VARCHAR(100),
    pucc_upto VARCHAR(50),
    
    -- API Metadata
    raw_response JSONB,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on vehicle_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicle_rc_vehicle_id ON vehicle_rc_info(vehicle_id);

-- Create index on license_plate
CREATE INDEX IF NOT EXISTS idx_vehicle_rc_license_plate ON vehicle_rc_info(license_plate);

-- Create index on owner_name
CREATE INDEX IF NOT EXISTS idx_vehicle_rc_owner_name ON vehicle_rc_info(owner_name);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_vehicle_rc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_vehicle_rc_updated_at ON vehicle_rc_info;
CREATE TRIGGER trigger_update_vehicle_rc_updated_at
    BEFORE UPDATE ON vehicle_rc_info
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicle_rc_updated_at();

-- Add comments
COMMENT ON TABLE vehicle_rc_info IS 'Stores vehicle registration certificate information fetched from RapidAPI';
COMMENT ON COLUMN vehicle_rc_info.vehicle_id IS 'Unique vehicle registration number (e.g., GJ27AA3978)';
COMMENT ON COLUMN vehicle_rc_info.raw_response IS 'Complete JSON response from the API for reference';
