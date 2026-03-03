-- Create services table to store available mechanic service types
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2),

    -- Array of vehicle types this service applies to: 'bike', 'car', 'truck', 'all'
    vehicle_types TEXT[] DEFAULT '{}',

    -- Emoji or icon identifier for frontend display
    icon VARCHAR(50),

    -- Maximum radius (km) a mechanic can travel for this service
    max_radius INTEGER DEFAULT 20,

    -- Human-readable time estimate e.g. "20-30 min"
    estimated_time VARCHAR(50),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for vehicle_type filtering using array containment
CREATE INDEX IF NOT EXISTS idx_services_vehicle_types ON services USING GIN(vehicle_types);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_services_updated_at ON services;
CREATE TRIGGER trigger_update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_services_updated_at();

-- Seed initial services (idempotent)
INSERT INTO services (name, description, base_price, vehicle_types, icon, max_radius, estimated_time)
VALUES
    (
        'Puncture Repair',
        'On-the-spot tyre puncture fix. Mechanic visits your location with repair kit.',
        150.00,
        ARRAY['bike', 'car', 'truck'],
        '🔧',
        15,
        '20-30 min'
    ),
    (
        'Battery Jump-start',
        'Dead battery? Get a jump-start to get back on the road immediately.',
        200.00,
        ARRAY['bike', 'car'],
        '🔋',
        20,
        '15-20 min'
    ),
    (
        'Towing Service',
        'Vehicle towed safely to nearest garage or your preferred location.',
        800.00,
        ARRAY['car', 'truck'],
        '🚛',
        30,
        '30-60 min'
    ),
    (
        'Brake Repair',
        'Brake pad inspection, adjustment, or replacement at your location.',
        400.00,
        ARRAY['bike', 'car'],
        '🛑',
        15,
        '45-60 min'
    ),
    (
        'Engine Oil Change',
        'Quick engine oil drain and refill with fresh oil at your doorstep.',
        500.00,
        ARRAY['bike', 'car'],
        '🛢️',
        10,
        '30-45 min'
    ),
    (
        'AC Repair',
        'Car AC diagnosis and repair — gas refill, compressor check, filter clean.',
        600.00,
        ARRAY['car'],
        '❄️',
        10,
        '60-90 min'
    ),
    (
        'Key Unlock',
        'Locked out of your vehicle? Professional locksmith unlocks without damage.',
        300.00,
        ARRAY['car', 'truck'],
        '🔑',
        20,
        '15-30 min'
    ),
    (
        'General Service',
        'Comprehensive vehicle checkup including fluids, brakes, filters, and electrics.',
        300.00,
        ARRAY['bike', 'car', 'truck'],
        '🔩',
        10,
        '60-120 min'
    )
ON CONFLICT DO NOTHING;

COMMENT ON TABLE services IS 'Catalog of mechanic services available on the platform';
COMMENT ON COLUMN services.vehicle_types IS 'Array of applicable vehicle types: bike, car, truck, all';
COMMENT ON COLUMN services.max_radius IS 'Maximum distance in km mechanic will travel for this service';
COMMENT ON COLUMN services.base_price IS 'Approximate starting price in INR';
