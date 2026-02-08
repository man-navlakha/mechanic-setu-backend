const https = require('https');
const { URL } = require('url');
const pool = require('../../db');

/**
 * Generate car image URL using imagin.studio API
 */
const generateCarImageUrl = (make, model, vehicleClass) => {
    if (!make || !model) return null;

    const lowerMake = make.toLowerCase();
    const lowerModel = model.toLowerCase();
    const lowerClass = (vehicleClass || "").toLowerCase();

    // Check for Two-Wheelers (Scooters/Motorcycles)
    if (
        lowerClass.includes('motor cycle') ||
        lowerClass.includes('scooter') ||
        lowerClass.includes('moped') ||
        lowerMake.includes('motorcycle') ||
        lowerMake.includes('scooter') ||
        lowerModel.includes('activa') ||
        lowerModel.includes('access') ||
        lowerModel.includes('jupiter') ||
        lowerModel.includes('pulsar') ||
        lowerModel.includes('splendor') ||
        lowerModel.includes('bullet') ||
        lowerModel.includes('scooty') ||
        lowerMake.includes('royal enfield') ||
        lowerMake.includes('hero motocorp') ||
        lowerMake.includes('tvs motor')
    ) {
        // Return a generic scooter/bike image
        return "https://img.freepik.com/premium-vector/scooter-delivery-transportation-isolated-icon-vector-illustration-design_25030-10115.jpg";
    }

    // Check for Three-Wheelers (Auto Rickshaws)
    if (
        lowerClass.includes('three wheeler') ||
        lowerClass.includes('auto rickshaw') ||
        lowerModel.includes('auto rickshaw') ||
        lowerModel.includes('tuk tuk') ||
        lowerMake.includes('bajaj auto') && lowerModel.includes('re')
    ) {
        // Return a generic auto rickshaw image
        return "https://img.freepik.com/premium-vector/auto-rickshaw-illustration-indian-three-wheeler-vehicle-isolated_25030-61882.jpg";
    }

    // Default to imagin.studio for Cars
    // Clean up make (e.g., "HONDA CARS INDIA LTD" -> "honda")
    const cleanMake = make.split(' ')[0].toLowerCase();

    // Clean up model (e.g., "AMAZE 1.2 S MT" -> "amaze")
    const cleanModel = model.split(' ')[0].toLowerCase();

    const url = new URL("https://cdn.imagin.studio/getimage");
    url.searchParams.append('customer', 'hrjavascript-mastery');
    url.searchParams.append('make', cleanMake);
    url.searchParams.append('modelFamily', cleanModel);
    url.searchParams.append('zoomType', 'fullscreen');

    return url.toString();
};

/**
 * Save vehicle RC info to database
 */
const saveVehicleRCInfo = async (vehicleData) => {
    // Generate image URL if not provided in the data
    const vehicleImage = vehicleData.vehicle_image || generateCarImageUrl(vehicleData.brand_name, vehicleData.brand_model, vehicleData.class);

    const query = `
        INSERT INTO vehicle_rc_info (
            vehicle_id, license_plate, chassis_number, engine_number,
            brand_name, brand_model, fuel_type, color, cubic_capacity,
            cylinders, seating_capacity, vehicle_age, class, norms,
            owner_name, father_name, owner_count, present_address, permanent_address,
            registration_date, rc_status, source,
            is_financed, financer, noc_details,
            insurance_company, insurance_policy, insurance_expiry,
            tax_paid_upto, tax_upto, permit_type, permit_number,
            permit_issue_date, permit_valid_from, permit_valid_upto,
            national_permit_number, national_permit_issued_by, national_permit_upto,
            pucc_number, pucc_upto, vehicle_image, raw_response, last_synced_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, NOW()
        )
        ON CONFLICT (vehicle_id) 
        DO UPDATE SET
            license_plate = EXCLUDED.license_plate,
            chassis_number = EXCLUDED.chassis_number,
            engine_number = EXCLUDED.engine_number,
            brand_name = EXCLUDED.brand_name,
            brand_model = EXCLUDED.brand_model,
            fuel_type = EXCLUDED.fuel_type,
            color = EXCLUDED.color,
            cubic_capacity = EXCLUDED.cubic_capacity,
            cylinders = EXCLUDED.cylinders,
            seating_capacity = EXCLUDED.seating_capacity,
            vehicle_age = EXCLUDED.vehicle_age,
            class = EXCLUDED.class,
            norms = EXCLUDED.norms,
            owner_name = EXCLUDED.owner_name,
            father_name = EXCLUDED.father_name,
            owner_count = EXCLUDED.owner_count,
            present_address = EXCLUDED.present_address,
            permanent_address = EXCLUDED.permanent_address,
            registration_date = EXCLUDED.registration_date,
            rc_status = EXCLUDED.rc_status,
            source = EXCLUDED.source,
            is_financed = EXCLUDED.is_financed,
            financer = EXCLUDED.financer,
            noc_details = EXCLUDED.noc_details,
            insurance_company = EXCLUDED.insurance_company,
            insurance_policy = EXCLUDED.insurance_policy,
            insurance_expiry = EXCLUDED.insurance_expiry,
            tax_paid_upto = EXCLUDED.tax_paid_upto,
            tax_upto = EXCLUDED.tax_upto,
            permit_type = EXCLUDED.permit_type,
            permit_number = EXCLUDED.permit_number,
            permit_issue_date = EXCLUDED.permit_issue_date,
            permit_valid_from = EXCLUDED.permit_valid_from,
            permit_valid_upto = EXCLUDED.permit_valid_upto,
            national_permit_number = EXCLUDED.national_permit_number,
            national_permit_issued_by = EXCLUDED.national_permit_issued_by,
            national_permit_upto = EXCLUDED.national_permit_upto,
            pucc_number = EXCLUDED.pucc_number,
            pucc_upto = EXCLUDED.pucc_upto,
            vehicle_image = EXCLUDED.vehicle_image,
            raw_response = EXCLUDED.raw_response,
            last_synced_at = NOW()
        RETURNING *;
    `;

    const values = [
        vehicleData.vehicleId || vehicleData.license_plate,
        vehicleData.license_plate,
        vehicleData.chassis_number,
        vehicleData.engine_number,
        vehicleData.brand_name,
        vehicleData.brand_model,
        vehicleData.fuel_type,
        vehicleData.color,
        vehicleData.cubic_capacity,
        vehicleData.cylinders,
        vehicleData.seating_capacity,
        vehicleData.vehicle_age,
        vehicleData.class,
        vehicleData.norms,
        vehicleData.owner_name,
        vehicleData.father_name,
        vehicleData.owner_count,
        vehicleData.present_address,
        vehicleData.permanent_address,
        vehicleData.registration_date,
        vehicleData.rc_status,
        vehicleData.source,
        vehicleData.is_financed,
        vehicleData.financer,
        vehicleData.noc_details,
        vehicleData.insurance_company,
        vehicleData.insurance_policy,
        vehicleData.insurance_expiry,
        vehicleData.tax_paid_upto,
        vehicleData.tax_upto,
        vehicleData.permit_type,
        vehicleData.permit_number,
        vehicleData.permit_issue_date,
        vehicleData.permit_valid_from,
        vehicleData.permit_valid_upto,
        vehicleData.national_permit_number,
        vehicleData.national_permit_issued_by,
        vehicleData.national_permit_upto,
        vehicleData.pucc_number,
        vehicleData.pucc_upto,
        vehicleImage,
        JSON.stringify({ ...vehicleData, vehicle_image: vehicleImage })
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
};

/**
 * Helper function to make RapidAPI request with specific API key
 */
const makeRapidAPIRequest = (vehicle_number, apiKey) => {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            hostname: 'vehicle-rc-information-v2.p.rapidapi.com',
            port: null,
            path: '/',
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': 'vehicle-rc-information-v2.p.rapidapi.com',
                'Content-Type': 'application/json'
            }
        };

        const apiReq = https.request(options, function (apiRes) {
            const chunks = [];

            apiRes.on('data', function (chunk) {
                chunks.push(chunk);
            });

            apiRes.on('end', function () {
                const body = Buffer.concat(chunks);
                const data = body.toString();

                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    resolve({ raw: data });
                }
            });

            apiRes.on('error', function (error) {
                reject(error);
            });
        });

        apiReq.on('error', function (error) {
            reject(error);
        });

        apiReq.write(JSON.stringify({
            vehicle_number: vehicle_number.toUpperCase()
        }));

        apiReq.end();
    });
};

/**
 * Check if response indicates quota exceeded
 */
const isQuotaExceeded = (response) => {
    return response &&
        response.message &&
        (response.message.includes('exceeded the DAILY quota') ||
            response.message.includes('exceeded') ||
            response.message.includes('quota'));
};

/**
 * Link a vehicle to a user in the user_vehicles table
 */
const linkVehicleToUser = async (userId, vehicleId, isOwner = false) => {
    try {
        const query = `
            INSERT INTO user_vehicles (user_id, vehicle_id, is_owner)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, vehicle_id) 
            DO UPDATE SET 
                is_owner = EXCLUDED.is_owner,
                created_at = NOW()
            RETURNING *;
        `;
        const result = await pool.query(query, [userId, vehicleId, isOwner]);
        return result.rows[0];
    } catch (error) {
        console.error('Error linking vehicle to user:', error.message);
        return null;
    }
};

/**
 * Get vehicle information by registration number
 * @route POST /api/vehicle/rc-info
 * @body { vehicle_number: string }
 */
const getVehicleRCInfo = async (req, res) => {
    try {
        const { vehicle_number } = req.body;

        // Validate input
        if (!vehicle_number) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle number is required'
            });
        }

        const normalizedVehicleNumber = vehicle_number.toUpperCase();

        // Validate vehicle number format (basic validation)
        const vehicleNumberRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
        if (!vehicleNumberRegex.test(normalizedVehicleNumber)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid vehicle number format. Expected format: GJ27AA3978'
            });
        }

        // --- STEP 1: CHECK DATABASE FIRST (Save your limited API quota!) ---
        console.log(`🔍 Checking database for vehicle: ${normalizedVehicleNumber}`);
        try {
            const dbResult = await pool.query(
                'SELECT * FROM vehicle_rc_info WHERE vehicle_id = $1',
                [normalizedVehicleNumber]
            );

            if (dbResult.rows.length > 0) {
                console.log(`✅ Cache Hit: Found ${normalizedVehicleNumber} in database.`);
                const dbData = dbResult.rows[0];

                // If image is missing in DB, generate it on the fly
                if (!dbData.vehicle_image && dbData.brand_name && dbData.brand_model) {
                    dbData.vehicle_image = generateCarImageUrl(dbData.brand_name, dbData.brand_model, dbData.class);
                }

                // If we have raw_response stored, use it, otherwise use the row data
                let responseData = dbData.raw_response;

                // If it's a string (though it should be JSONB), parse it
                if (typeof responseData === 'string') {
                    try { responseData = JSON.parse(responseData); } catch (e) { }
                }

                // If no raw_response, use the flat dbData
                if (!responseData) {
                    responseData = { ...dbData };
                }

                // Ensure vehicle_image is in the response sent to frontend
                if (typeof responseData === 'object') {
                    responseData.vehicle_image = dbData.vehicle_image || responseData.vehicle_image;
                }

                // Link vehicle to user if authenticated
                if (req.user && req.user.id) {
                    await linkVehicleToUser(req.user.id, normalizedVehicleNumber);
                }

                return res.status(200).json({
                    success: true,
                    data: responseData,
                    source: 'database',
                    db_id: dbData.id,
                    last_synced_at: dbData.last_synced_at,
                    vehicle_image: responseData.vehicle_image
                });
            }
        } catch (dbCheckError) {
            console.error('❌ Error checking database, proceeding to API:', dbCheckError.message);
            // Continue to API if DB check fails for some reason
        }

        // --- STEP 2: NOT IN DATABASE, TRY API KEY ROTATION ---
        console.log(`🌐 Cache Miss: Calling API for ${normalizedVehicleNumber}`);
        let apiResponse;
        let usedBackupKey = false;
        let activeKeyName = 'primary';

        // Chain of API keys to try
        const keysToTry = [
            { name: 'primary', key: process.env.RAPIDAPI_KEY },
            { name: 'backup', key: process.env.RAPIDAPI_KEY_BACKUP },
            { name: 'backup_1', key: process.env.RAPIDAPI_KEY_BACKUP_1 }
        ].filter(k => k.key); // Only try keys that are defined

        for (const keyConfig of keysToTry) {
            console.log(`🔑 Trying ${keyConfig.name} API key...`);
            try {
                apiResponse = await makeRapidAPIRequest(normalizedVehicleNumber, keyConfig.key);

                // If not quota exceeded, we found a working key
                if (!isQuotaExceeded(apiResponse)) {
                    activeKeyName = keyConfig.name;
                    usedBackupKey = keyConfig.name !== 'primary';
                    if (usedBackupKey) {
                        console.log(`✅ Successfully retrieved data using ${keyConfig.name} API key`);
                    }
                    break;
                } else {
                    console.log(`⚠️  ${keyConfig.name} API key quota exceeded.`);
                }
            } catch (err) {
                console.error(`❌ ${keyConfig.name} API key failed:`, err.message);
                // Continue to next key if available
            }
        }

        // If after trying all keys we still have a quota issue or no response
        if (!apiResponse || isQuotaExceeded(apiResponse)) {
            return res.status(503).json({
                success: false,
                error: 'All API keys have exceeded quota or failed',
                message: apiResponse ? apiResponse.message : 'No response from API service'
            });
        }

        // --- STEP 3: SAVE TO DATABASE ---
        // Add image URL to apiResponse if available
        if (!apiResponse.vehicle_image && apiResponse.brand_name && apiResponse.brand_model) {
            apiResponse.vehicle_image = generateCarImageUrl(apiResponse.brand_name, apiResponse.brand_model, apiResponse.class);
        }

        let savedData = null;
        try {
            savedData = await saveVehicleRCInfo(apiResponse);
            console.log(`✅ Vehicle data saved to database: ${normalizedVehicleNumber}`);

            // Link vehicle to user if authenticated
            if (req.user && req.user.id) {
                await linkVehicleToUser(req.user.id, normalizedVehicleNumber);
            }
        } catch (dbError) {
            console.error('❌ Error saving to database:', dbError.message);
            // Continue even if database save fails
        }

        // Return the response with database info
        res.status(200).json({
            success: true,
            data: apiResponse,
            source: 'api',
            saved_to_db: savedData !== null,
            db_id: savedData?.id,
            used_backup_key: usedBackupKey,
            vehicle_image: apiResponse.vehicle_image
        });

    } catch (error) {
        console.error('Error fetching vehicle RC info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch vehicle information',
            message: error.message
        });
    }
};

/**
 * Get all saved vehicles from database
 * @route GET /api/vehicle/saved
 */
const getSavedVehicles = async (req, res) => {
    try {
        const { limit = 50, offset = 0, search } = req.query;

        let query = 'SELECT * FROM vehicle_rc_info';
        const params = [];

        if (search) {
            query += ' WHERE vehicle_id ILIKE $1 OR owner_name ILIKE $1 OR license_plate ILIKE $1';
            params.push(`%${search}%`);
        }

        query += ` ORDER BY last_synced_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);

        // Ensure all vehicles have an image URL
        const vehiclesWithImages = result.rows.map(vehicle => {
            if (!vehicle.vehicle_image && vehicle.brand_name && vehicle.brand_model) {
                vehicle.vehicle_image = generateCarImageUrl(vehicle.brand_name, vehicle.brand_model, vehicle.class);
            }
            return vehicle;
        });

        res.status(200).json({
            success: true,
            data: vehiclesWithImages,
            count: vehiclesWithImages.length
        });
    } catch (error) {
        console.error('Error fetching saved vehicles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch saved vehicles',
            message: error.message
        });
    }
};

/**
 * Get vehicle by ID from database
 * @route GET /api/vehicle/saved/:vehicleId
 */
const getSavedVehicleById = async (req, res) => {
    try {
        const { vehicleId } = req.params;

        const result = await pool.query(
            'SELECT * FROM vehicle_rc_info WHERE vehicle_id = $1',
            [vehicleId.toUpperCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found in database'
            });
        }

        const vehicle = result.rows[0];
        if (!vehicle.vehicle_image && vehicle.brand_name && vehicle.brand_model) {
            vehicle.vehicle_image = generateCarImageUrl(vehicle.brand_name, vehicle.brand_model, vehicle.class);
        }

        res.status(200).json({
            success: true,
            data: vehicle
        });
    } catch (error) {
        console.error('Error fetching vehicle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch vehicle',
            message: error.message
        });
    }
};

/**
 * Delete vehicle from database
 * @route DELETE /api/vehicle/saved/:vehicleId
 */
const deleteSavedVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.params;

        const result = await pool.query(
            'DELETE FROM vehicle_rc_info WHERE vehicle_id = $1 RETURNING *',
            [vehicleId.toUpperCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found in database'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Vehicle deleted successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete vehicle',
            message: error.message
        });
    }
};

/**
 * Get vehicles linked to the current authenticated user
 * @route GET /api/vehicle/my-vehicles
 */
const getMyVehicles = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const userId = req.user.id;
        const { limit = 50, offset = 0 } = req.query;

        const query = `
            SELECT v.*, uv.is_owner, uv.notification_enabled, uv.created_at as saved_at
            FROM vehicle_rc_info v
            JOIN user_vehicles uv ON v.vehicle_id = uv.vehicle_id
            WHERE uv.user_id = $1
            ORDER BY uv.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [userId, parseInt(limit), parseInt(offset)]);

        // Process data
        const vehicles = result.rows.map(vehicle => {
            if (!vehicle.vehicle_image && vehicle.brand_name && vehicle.brand_model) {
                vehicle.vehicle_image = generateCarImageUrl(vehicle.brand_name, vehicle.brand_model, vehicle.class);
            }

            // Add insurance status helper
            const today = new Date();
            const expiry = vehicle.insurance_expiry ? new Date(vehicle.insurance_expiry) : null;
            vehicle.is_insurance_expired = expiry ? expiry < today : null;

            return vehicle;
        });

        res.status(200).json({
            success: true,
            data: vehicles,
            count: vehicles.length
        });
    } catch (error) {
        console.error('Error fetching user vehicles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch your vehicles',
            message: error.message
        });
    }
};

module.exports = {
    getVehicleRCInfo,
    getSavedVehicles,
    getSavedVehicleById,
    deleteSavedVehicle,
    getMyVehicles
};
