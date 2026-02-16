const https = require('https');
const { URL } = require('url');
const pool = require('../../db');

/* ============================================================
   IMAGE GENERATOR (Same as your original)
============================================================ */
const generateCarImageUrl = (make, model, vehicleClass) => {
    if (!make || !model) return null;

    const lowerClass = (vehicleClass || "").toLowerCase();

    if (lowerClass.includes('motor') || lowerClass.includes('scooter')) {
        return "https://img.freepik.com/premium-vector/scooter-delivery-transportation-isolated-icon-vector-illustration-design_25030-10115.jpg";
    }

    if (lowerClass.includes('three') || lowerClass.includes('rickshaw')) {
        return "https://img.freepik.com/premium-vector/auto-rickshaw-illustration-indian-three-wheeler-vehicle-isolated_25030-61882.jpg";
    }

    const cleanMake = make.split(' ')[0].toLowerCase();
    const cleanModel = model.split(' ')[0].toLowerCase();

    const url = new URL("https://cdn.imagin.studio/getimage");
    url.searchParams.append('customer', 'hrjavascript-mastery');
    url.searchParams.append('make', cleanMake);
    url.searchParams.append('modelFamily', cleanModel);
    url.searchParams.append('zoomType', 'fullscreen');

    return url.toString();
};

/* ============================================================
   SAVE VEHICLE TO DB (Same UPSERT logic)
============================================================ */
const saveVehicleRCInfo = async (vehicleData) => {
    const vehicleImage =
        vehicleData.vehicle_image ||
        generateCarImageUrl(vehicleData.brand_name, vehicleData.brand_model, vehicleData.class);

    const query = `
        INSERT INTO vehicle_rc_info (
            vehicle_id, license_plate, brand_name, brand_model,
            owner_name, fuel_type, class,
            vehicle_image, raw_response, last_synced_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        ON CONFLICT (vehicle_id)
        DO UPDATE SET
            license_plate = EXCLUDED.license_plate,
            brand_name = EXCLUDED.brand_name,
            brand_model = EXCLUDED.brand_model,
            owner_name = EXCLUDED.owner_name,
            fuel_type = EXCLUDED.fuel_type,
            class = EXCLUDED.class,
            vehicle_image = EXCLUDED.vehicle_image,
            raw_response = EXCLUDED.raw_response,
            last_synced_at = NOW()
        RETURNING *;
    `;

    const values = [
        vehicleData.license_plate,
        vehicleData.license_plate,
        vehicleData.brand_name,
        vehicleData.brand_model,
        vehicleData.owner_name,
        vehicleData.fuel_type,
        vehicleData.class,
        vehicleImage,
        JSON.stringify(vehicleData)
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
};

/* ============================================================
   PROVIDER CONFIGURATION (4 APIs)
============================================================ */
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

const rcProviders = [
    {
        name: "rto_provider",
        hostname: "rto-vehicle-information-verification-india2.p.rapidapi.com",
        path: "/api/v1/private/rc-v1",
        method: "POST",
        buildBody: (reg) => ({
            reg_no: reg,
            consent: "yes",
            consent_text: "I hear by declare my consent agreement for fetching my information via Foxtail Kyc API"
        })
    }
];

/* ============================================================
   GENERIC PROVIDER REQUEST
============================================================ */
const makeProviderRequest = (provider, vehicleNumber) => {
    return new Promise((resolve, reject) => {
        const options = {
            method: provider.method,
            hostname: provider.hostname,
            port: null,
            path: typeof provider.path === "function"
                ? provider.path(vehicleNumber)
                : provider.path,
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': provider.hostname,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            const chunks = [];

            res.on('data', (chunk) => chunks.push(chunk));

            res.on('end', () => {
                try {
                    const body = Buffer.concat(chunks).toString();
                    resolve(JSON.parse(body));
                } catch (err) {
                    resolve(null);
                }
            });

            res.on('error', reject);
        });

        req.on('error', reject);

        if (provider.method === "POST" && provider.buildBody) {
            req.write(JSON.stringify(provider.buildBody(vehicleNumber)));
        }

        req.end();
    });
};

/* ============================================================
   NORMALIZE DIFFERENT API RESPONSES
============================================================ */
const normalizeResponse = (raw) => {
    // The actual vehicle data is nested in the 'result' object.
    const data = raw?.result;

    if (!data) return null;

    return {
        license_plate: data.license_plate || data.registration_no || data.reg_no || data.rc_number,
        brand_name: data.brand_name || data.maker || data.make,
        brand_model: data.brand_model || data.model,
        owner_name: data.owner_name || data.owner,
        fuel_type: data.fuel_type || data.fuel_descr,
        class: data.vehicle_class_desc || data.class,
        raw_response: raw // Keep the full original response
    };
};

const calculateAgeFromRegistrationDate = (registrationDate) => {
    if (!registrationDate) return null;

    const parsedTimestamp = Date.parse(registrationDate);
    if (Number.isNaN(parsedTimestamp)) return null;

    const registeredAt = new Date(parsedTimestamp);
    const now = new Date();
    let years = now.getFullYear() - registeredAt.getFullYear();
    const monthDiff = now.getMonth() - registeredAt.getMonth();
    const dayDiff = now.getDate() - registeredAt.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        years--;
    }

    return years >= 0 ? years.toString() : null;
};

const buildVehicleDetailsResponse = (vehicle) => {
    if (!vehicle) return null;

    const computedAge = calculateAgeFromRegistrationDate(vehicle.registration_date);

    return {
        id: vehicle.id ? vehicle.id.toString() : null,
        vehicle_id: vehicle.vehicle_id,
        license_plate: vehicle.license_plate,
        brand_name: vehicle.brand_name,
        brand_model: vehicle.brand_model,
        fuel_type: vehicle.fuel_type,
        color: vehicle.color,
        seating_capacity: vehicle.seating_capacity,
        vehicle_age: vehicle.vehicle_age || computedAge,
        owner_name: vehicle.owner_name,
        father_name: vehicle.father_name,
        owner_count: vehicle.owner_count,
        present_address: vehicle.present_address,
        permanent_address: vehicle.permanent_address,
        registration_date: vehicle.registration_date,
        rc_status: vehicle.rc_status,
        is_financed: vehicle.is_financed,
        financer: vehicle.financer,
        noc_details: vehicle.noc_details,
        insurance_company: vehicle.insurance_company,
        insurance_policy: vehicle.insurance_policy,
        insurance_expiry: vehicle.insurance_expiry,
        pucc_number: vehicle.pucc_number,
        engine_number: vehicle.engine_number,
        vehicle_image: vehicle.vehicle_image,
        chassis_number: vehicle.chassis_number,
        cubic_capacity: vehicle.cubic_capacity
    };
};

/* ============================================================
   MAIN CONTROLLER
============================================================ */
const getVehicleRCInfo = async (req, res) => {
    try {
        const { vehicle_number } = req.body;

        if (!vehicle_number) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle number is required'
            });
        }

        const normalizedVehicleNumber = vehicle_number.toUpperCase();

        /* -----------------------------
           STEP 1: CHECK DATABASE
        ------------------------------*/
        const dbResult = await pool.query(
            'SELECT * FROM vehicle_rc_info WHERE vehicle_id = $1',
            [normalizedVehicleNumber]
        );

        if (dbResult.rows.length > 0) {
            return res.status(200).json({
                success: true,
                data: dbResult.rows[0],
                source: 'database'
            });
        }

        /* -----------------------------
           STEP 2: TRY PROVIDERS
        ------------------------------*/
        let apiResponse = null;
        let providerUsed = null;

        for (const provider of rcProviders) {
            try {
                console.log(`Trying ${provider.name}...`);
                const raw = await makeProviderRequest(provider, normalizedVehicleNumber);

                // Log the raw response from the provider
                console.log(`Response from ${provider.name}:`, JSON.stringify(raw, null, 2));

                const normalized = normalizeResponse(raw);

                if (normalized && normalized.license_plate) {
                    apiResponse = normalized;
                    providerUsed = provider.name;
                    console.log(`Successfully found vehicle with ${provider.name}.`);
                    break;
                } else {
                    console.log(`No valid license plate in response from ${provider.name}.`);
                }

            } catch (err) {
                // Log the error from the provider
                console.error(`Error with ${provider.name}:`, err);
            }
        }

        if (!apiResponse) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found in any provider'
            });
        }

        /* -----------------------------
           STEP 3: SAVE TO DB
        ------------------------------*/
        const savedData = await saveVehicleRCInfo(apiResponse);

        return res.status(200).json({
            success: true,
            data: apiResponse,
            provider_used: providerUsed,
            saved_to_db: !!savedData,
            vehicle_image: apiResponse.vehicle_image
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch vehicle information'
        });
    }
};

/* ============================================================
   GET ALL SAVED VEHICLES
============================================================ */
const getSavedVehicles = async (req, res) => {
    try {
        const { limit = 50, offset = 0, search } = req.query;

        let query = 'SELECT * FROM vehicle_rc_info';
        let countQuery = 'SELECT COUNT(*) FROM vehicle_rc_info';
        const params = [];
        let paramIndex = 1;

        if (search) {
            const searchClause = ` WHERE license_plate ILIKE $${paramIndex} OR owner_name ILIKE $${paramIndex} OR brand_name ILIKE $${paramIndex}`;
            query += searchClause;
            countQuery += searchClause;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY last_synced_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        
        // Combine params for the main query (search param + limit + offset)
        const queryParams = [...params, parseInt(limit), parseInt(offset)];

        const result = await pool.query(query, queryParams);
        const countResult = await pool.query(countQuery, params);

        res.status(200).json({
            success: true,
            total: parseInt(countResult.rows[0].count),
            page_size: parseInt(limit),
            offset: parseInt(offset),
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching saved vehicles:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch saved vehicles' });
    }
};

const getMyVehicles = async (req, res) => {
    try {
        // Safely access vehicle_id from query, body, or params
        const vehicleIdCandidate = req.query.vehicle_id || (req.body || {}).vehicle_id || req.params.vehicle_id || req.params.vehicleId;
        const normalizedVehicleId = vehicleIdCandidate?.trim().toUpperCase();

        if (!normalizedVehicleId) {
            return res.status(400).json({
                success: false,
                error: 'vehicle_id is required'
            });
        }

        const result = await pool.query(
            'SELECT * FROM vehicle_rc_info WHERE vehicle_id = $1 ORDER BY last_synced_at DESC LIMIT 1',
            [normalizedVehicleId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found'
            });
        }

        const formatted = buildVehicleDetailsResponse(result.rows[0]);

        return res.status(200).json({
            success: true,
            data: formatted
        });
    } catch (error) {
        console.error('Error fetching vehicle details:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch vehicle details'
        });
    }
};

const deleteSavedVehicle = async (req, res) => {
    try {
        const vehicleIdCandidate = req.params.vehicleId;
        const normalizedVehicleId = vehicleIdCandidate?.trim().toUpperCase();

        if (!normalizedVehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required.'
            });
        }

        const result = await pool.query(
            'DELETE FROM vehicle_rc_info WHERE vehicle_id = $1',
            [normalizedVehicleId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found or already deleted.'
            });
        }

        res.status(200).json({
            success: true,
            message: `Vehicle ${normalizedVehicleId} deleted successfully.`
        });
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({ success: false, error: 'Failed to delete vehicle.' });
    }
};

const getUserVehicles = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated.'
            });
        }

        const query = `
            SELECT
                uv.vehicle_id,
                uv.is_owner,
                uv.notification_enabled,
                vri.*
            FROM user_vehicles uv
            JOIN vehicle_rc_info vri ON uv.vehicle_id = vri.vehicle_id
            WHERE uv.user_id = $1
            ORDER BY uv.created_at DESC;
        `;

        const result = await pool.query(query, [userId]);

        res.status(200).json({
            success: true,
            count: result.rowCount,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching user vehicles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user vehicles.'
        });
    }
};

module.exports = {
    getVehicleRCInfo,
    getSavedVehicles,
    getMyVehicles,
    deleteSavedVehicle,
    getUserVehicles
};
