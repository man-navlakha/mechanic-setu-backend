const https = require('https');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const pool = require('../../db');

// Reuse the same signing key used for access tokens (set in .env)
const SIGNING_KEY = process.env.SIGNING_KEY;

// Derive a coarse vehicle category for UI badges
const detectVehicleCategory = (vehicle = {}) => {
    const lc = (value) => (value || '').toString().toLowerCase();

    // Collect textual hints
    const hints = [
        lc(vehicle.class),
        lc(vehicle.vehicle_type),
        lc(vehicle.brand_model),
        lc(vehicle.permit_type),
        lc(vehicle.raw_response?.vehicle_class_desc),
        lc(vehicle.raw_response?.result?.vehicle_class_desc),
        lc(vehicle.raw_response?.result?.vehicle_catg),
        lc(vehicle.raw_response?.result?.vehicle_type),
        lc(vehicle.raw_response?.result?.body_type)
    ].join(' ');

    // Seats / capacity hints
    const seatHint = parseInt(
        vehicle.seating_capacity
        || vehicle.raw_response?.result?.vehicle_seat_capacity
        || vehicle.raw_response?.result?.seating_capacity,
        10
    );

    if (/auto|rickshaw|autorick|three[-\s]?w/.test(hints)) return 'autorickshaw';
    if (/scooter|m-cycle|motorcycle|bike|2w|two[-\s]?wheeler/.test(hints)) return 'bike';
    if (/bus|coach/.test(hints)) return 'bus';
    if (Number.isFinite(seatHint) && seatHint >= 20) return 'bus';
    if (Number.isFinite(seatHint) && seatHint <= 3) return 'bike';

    // Default bucket for four-wheelers
    return 'car';
};

// Ensure category exists on row and persist back if newly derived
const ensureVehicleCategory = async (row) => {
    const derived = row?.vehicle_category || detectVehicleCategory(row);

    // Persist back if the table has the column and we just derived it
    if (!row?.vehicle_category && derived && row?.vehicle_id) {
        try {
            await pool.query(
                'UPDATE vehicle_rc_info SET vehicle_category = $1 WHERE vehicle_id = $2',
                [derived, row.vehicle_id]
            );
        } catch (err) {
            console.warn('Failed to backfill vehicle_category:', err.message);
        }
    }

    return derived;
};

const attachVehicleCategory = async (rows) => {
    return Promise.all(
        rows.map(async (row) => ({
            ...row,
            vehicle_category: await ensureVehicleCategory(row)
        }))
    );
};

/**
 * Attempt to read the authenticated user ID from the access cookie.
 * This is intentionally non-fatal: if the token is missing/invalid we
 * simply return null and continue serving the public endpoint.
 */
const getUserIdFromCookie = (req) => {
    if (!SIGNING_KEY) return null;

    const token = req.cookies?.access;
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, SIGNING_KEY, { algorithms: ['HS256'] });
        return decoded?.user_id || null;
    } catch (err) {
        console.warn('getUserIdFromCookie: unable to decode access token', err.message);
        return null;
    }
};

/**
 * Link the requested vehicle to the current user for history.
 * Uses ON CONFLICT to keep the operation idempotent.
 */
const linkVehicleToUser = async (userId, vehicleId) => {
    if (!userId || !vehicleId) return;

    try {
        await pool.query(
            `
            INSERT INTO user_vehicles (user_id, vehicle_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, vehicle_id) DO NOTHING
            `,
            [userId, vehicleId]
        );
    } catch (error) {
        console.error('Error linking vehicle to user history:', error);
    }
};

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
    const vehicleCategory = vehicleData.vehicle_category || detectVehicleCategory(vehicleData);

    const query = `
        INSERT INTO vehicle_rc_info (
            vehicle_id, license_plate, brand_name, brand_model,
            owner_name, fuel_type, class, vehicle_category,
            vehicle_image, raw_response, last_synced_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (vehicle_id)
        DO UPDATE SET
            license_plate = EXCLUDED.license_plate,
            brand_name = EXCLUDED.brand_name,
            brand_model = EXCLUDED.brand_model,
            owner_name = EXCLUDED.owner_name,
            fuel_type = EXCLUDED.fuel_type,
            class = EXCLUDED.class,
            vehicle_category = COALESCE(EXCLUDED.vehicle_category, vehicle_rc_info.vehicle_category),
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
        vehicleCategory,
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
        const userId = getUserIdFromCookie(req);

        /* -----------------------------
           STEP 1: CHECK DATABASE
        ------------------------------*/
        const dbResult = await pool.query(
            'SELECT * FROM vehicle_rc_info WHERE vehicle_id = $1',
            [normalizedVehicleNumber]
        );

        if (dbResult.rows.length > 0) {
            await linkVehicleToUser(userId, normalizedVehicleNumber);
            const category = await ensureVehicleCategory(dbResult.rows[0]);
            return res.status(200).json({
                success: true,
                data: { ...dbResult.rows[0], vehicle_category: category },
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
        await linkVehicleToUser(userId, normalizedVehicleNumber);

        const vehicleCategory = savedData?.vehicle_category || detectVehicleCategory(apiResponse);

        return res.status(200).json({
            success: true,
            data: {
                ...apiResponse,
                vehicle_category: vehicleCategory
            },
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

        const dataWithCategory = await attachVehicleCategory(result.rows);

        res.status(200).json({
            success: true,
            total: parseInt(countResult.rows[0].count),
            page_size: parseInt(limit),
            offset: parseInt(offset),
            data: dataWithCategory
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

        const row = result.rows[0];
        const formatted = {
            ...buildVehicleDetailsResponse(row),
            vehicle_category: await ensureVehicleCategory(row)
        };

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

const updateSavedVehicle = async (req, res) => {
    try {
        const vehicleIdCandidate = req.params.vehicleId;
        const normalizedVehicleId = vehicleIdCandidate?.trim().toUpperCase();

        if (!normalizedVehicleId) {
            return res.status(400).json({
                success: false,
                error: 'Vehicle ID is required.'
            });
        }

        const updates = req.body || {};

        const allowedFields = [
            'license_plate',
            'chassis_number',
            'engine_number',
            'brand_name',
            'brand_model',
            'fuel_type',
            'color',
            'cubic_capacity',
            'cylinders',
            'seating_capacity',
            'vehicle_age',
            'vehicle_category',
            'class',
            'norms',
            'owner_name',
            'father_name',
            'owner_count',
            'present_address',
            'permanent_address',
            'registration_date',
            'rc_status',
            'source',
            'is_financed',
            'financer',
            'noc_details',
            'insurance_company',
            'insurance_policy',
            'insurance_expiry',
            'tax_paid_upto',
            'tax_upto',
            'permit_type',
            'permit_number',
            'permit_issue_date',
            'permit_valid_from',
            'permit_valid_upto',
            'national_permit_number',
            'national_permit_issued_by',
            'national_permit_upto',
            'pucc_number',
            'pucc_upto',
            'vehicle_image'
        ];

        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                const columnName = key === 'class' ? '"class"' : key;
                setClauses.push(`${columnName} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
        }

        if (setClauses.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update.'
            });
        }

        values.push(normalizedVehicleId);

        const result = await pool.query(
            `
            UPDATE vehicle_rc_info
            SET ${setClauses.join(', ')}
            WHERE vehicle_id = $${paramIndex}
            RETURNING *
            `,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vehicle not found.'
            });
        }

        const row = result.rows[0];
        const formatted = {
            ...buildVehicleDetailsResponse(row),
            vehicle_category: await ensureVehicleCategory(row)
        };

        return res.status(200).json({
            success: true,
            message: `Vehicle ${normalizedVehicleId} updated successfully.`,
            data: formatted
        });
    } catch (error) {
        console.error('Error updating vehicle:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update vehicle.'
        });
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

        const dataWithCategory = await attachVehicleCategory(result.rows);

        res.status(200).json({
            success: true,
            count: result.rowCount,
            data: dataWithCategory
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
    updateSavedVehicle,
    deleteSavedVehicle,
    getUserVehicles
};
