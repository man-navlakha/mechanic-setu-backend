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
        name: "provider_1",
        hostname: "vehicle-rc-verification-advance.p.rapidapi.com",
        path: "/Getrcfulldetails",
        method: "POST",
        buildBody: (reg) => ({ rcnumber: reg })
    },
    {
        name: "provider_2",
        hostname: "rto-vehicle-information-verification-india2.p.rapidapi.com",
        path: "/api/v1/private/rc-v1",
        method: "POST",
        buildBody: (reg) => ({
            reg_no: reg,
            consent: "yes",
            consent_text:
                "I hereby declare my consent agreement for fetching my information"
        })
    },
    {
        name: "provider_3",
        hostname: "vehicle-rc-verification-rto.p.rapidapi.com",
        path: "/rc-full",
        method: "POST",
        buildBody: (reg) => ({ id_number: reg })
    },
    {
        name: "provider_4",
        hostname: "rto-vehicle-details5.p.rapidapi.com",
        path: (reg) => `/address?registration=${reg}`,
        method: "GET"
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
    if (!raw) return null;

    return {
        license_plate: raw.license_plate || raw.registration_no || raw.reg_no || raw.rc_number,
        brand_name: raw.brand_name || raw.maker || raw.make,
        brand_model: raw.brand_model || raw.model,
        owner_name: raw.owner_name || raw.owner,
        fuel_type: raw.fuel_type || raw.fuel,
        class: raw.vehicle_class || raw.class,
        raw_response: raw
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

                const normalized = normalizeResponse(raw);

                if (normalized && normalized.license_plate) {
                    apiResponse = normalized;
                    providerUsed = provider.name;
                    break;
                }

            } catch (err) {
                console.log(`${provider.name} failed`);
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
        const vehicleIdCandidate = req.query.vehicle_id || req.body.vehicle_id || req.params.vehicle_id || req.params.vehicleId;
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

module.exports = {
    getVehicleRCInfo,
    getSavedVehicles,
    getMyVehicles
};
