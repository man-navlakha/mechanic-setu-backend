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
const generateCarImageUrl = (_make, model) => {
    if (!model) return null;

    // Use brand_model in a slug form (lowercase, spaces => underscores) to build the local asset URL
    const brandModelSlug = model
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[\\/]+/g, '_') // change slashes to underscores
        .replace(/\s+/g, '_');   // spaces to underscores

    return `https://img-server-theta.vercel.app/api/vehicle/${brandModelSlug}`;
};

/* ============================================================
   SAVE VEHICLE TO DB (Extended to save all fields)
============================================================ */
const saveVehicleRCInfo = async (vehicleData) => {
    const vehicleImage =
        vehicleData.vehicle_image ||
        generateCarImageUrl(vehicleData.brand_name, vehicleData.brand_model, vehicleData.class);
    const vehicleCategory = vehicleData.vehicle_category || detectVehicleCategory(vehicleData);

    const query = `
        INSERT INTO vehicle_rc_info (
            vehicle_id, license_plate, chassis_number, engine_number,
            brand_name, brand_model, fuel_type, color,
            cubic_capacity, cylinders, seating_capacity, vehicle_age,
            class, norms, owner_name, father_name, owner_count,
            present_address, permanent_address, registration_date,
            rc_status, source, is_financed, financer, noc_details,
            insurance_company, insurance_policy, insurance_expiry,
            tax_paid_upto, tax_upto, permit_type, permit_number,
            permit_issue_date, permit_valid_from, permit_valid_upto,
            national_permit_number, national_permit_issued_by, national_permit_upto,
            pucc_number, pucc_upto, vehicle_category, vehicle_image, raw_response, last_synced_at
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
            $41, $42, $43, NOW()
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
            vehicle_category = COALESCE(EXCLUDED.vehicle_category, vehicle_rc_info.vehicle_category),
            vehicle_image = EXCLUDED.vehicle_image,
            raw_response = EXCLUDED.raw_response,
            last_synced_at = NOW()
        RETURNING *;
    `;

    const values = [
        vehicleData.vehicle_id || vehicleData.license_plate,
        vehicleData.license_plate,
        vehicleData.chassis_number || null,
        vehicleData.engine_number || null,
        vehicleData.brand_name || '',
        vehicleData.brand_model || '',
        vehicleData.fuel_type || null,
        vehicleData.color || null,
        vehicleData.cubic_capacity || null,
        vehicleData.cylinders || null,
        vehicleData.seating_capacity || null,
        vehicleData.vehicle_age || null,
        vehicleData.class || '',
        vehicleData.norms || null,
        vehicleData.owner_name || null,
        vehicleData.father_name || null,
        vehicleData.owner_count || null,
        vehicleData.present_address || null,
        vehicleData.permanent_address || null,
        vehicleData.registration_date || null,
        vehicleData.rc_status || null,
        vehicleData.source || null,
        vehicleData.is_financed || null,
        vehicleData.financer || null,
        vehicleData.noc_details || null,
        vehicleData.insurance_company || null,
        vehicleData.insurance_policy || null,
        vehicleData.insurance_expiry || null,
        vehicleData.tax_paid_upto || null,
        vehicleData.tax_upto || null,
        vehicleData.permit_type || null,
        vehicleData.permit_number || null,
        vehicleData.permit_issue_date || null,
        vehicleData.permit_valid_from || null,
        vehicleData.permit_valid_upto || null,
        vehicleData.national_permit_number || null,
        vehicleData.national_permit_issued_by || null,
        vehicleData.national_permit_upto || null,
        vehicleData.pucc_number || null,
        vehicleData.pucc_upto || null,
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

    // Helper to pick the first non-null/undefined value
    const coalesce = (...values) => {
        for (const val of values) {
            if (val !== undefined && val !== null) return val;
        }
        return null;
    };

    // raw_response is stored as JSONB; provider payload may be nested
    const raw = vehicle.raw_response || {};
    const rawResult =
        raw.result ||
        raw.raw_response?.result ||
        raw.raw_response?.data ||
        raw.data ||
        null;

    const computedAge = calculateAgeFromRegistrationDate(vehicle.registration_date);

    return {
        id: vehicle.id ? vehicle.id.toString() : null,
        vehicle_id: vehicle.vehicle_id,
        license_plate: vehicle.license_plate,
        chassis_number: coalesce(vehicle.chassis_number, rawResult?.chassis_no, rawResult?.chasis_no),
        engine_number: coalesce(vehicle.engine_number, rawResult?.engine_no, rawResult?.engine_number),
        brand_name: coalesce(
            vehicle.brand_name,
            rawResult?.brand_name,
            rawResult?.maker,
            rawResult?.make,
            rawResult?.vehicle_manufacturer_name
        ),
        brand_model: coalesce(vehicle.brand_model, rawResult?.brand_model, rawResult?.model, rawResult?.model_name),
        fuel_type: coalesce(vehicle.fuel_type, rawResult?.fuel_type, rawResult?.fuel_descr),
        color: coalesce(vehicle.color, rawResult?.color),
        cubic_capacity: coalesce(vehicle.cubic_capacity, rawResult?.cubic_cap, rawResult?.cubic_capacity),
        cylinders: coalesce(vehicle.cylinders, rawResult?.cylinders_no, rawResult?.cylinders),
        seating_capacity: coalesce(
            vehicle.seating_capacity,
            rawResult?.vehicle_seat_capacity,
            rawResult?.seating_capacity
        ),
        vehicle_age: vehicle.vehicle_age || computedAge,
        class: coalesce(vehicle.class, rawResult?.vehicle_class_desc, rawResult?.class, rawResult?.body_type),
        norms: coalesce(vehicle.norms, rawResult?.norms_descr, rawResult?.emission_norms),
        owner_name: coalesce(vehicle.owner_name, rawResult?.owner_name),
        father_name: coalesce(vehicle.father_name, rawResult?.owner_father_name),
        owner_count: coalesce(vehicle.owner_count, rawResult?.owner_count, rawResult?.owner_no),
        present_address: coalesce(
            vehicle.present_address,
            rawResult?.current_full_address,
            rawResult?.current_address_line1
        ),
        permanent_address: coalesce(
            vehicle.permanent_address,
            rawResult?.permanent_full_address,
            rawResult?.permanent_address_line1
        ),
        registration_date: coalesce(vehicle.registration_date, rawResult?.reg_date, rawResult?.registration_date),
        rc_status: coalesce(vehicle.rc_status, rawResult?.status, rawResult?.rc_status),
        source: vehicle.source || rawResult?.source || null,
        is_financed: coalesce(vehicle.is_financed, rawResult?.is_financed, rawResult?.financer_details ? 'true' : null),
        financer: coalesce(vehicle.financer, rawResult?.financer, rawResult?.financer_details?.name),
        noc_details: coalesce(vehicle.noc_details, rawResult?.noc_details),
        insurance_company: coalesce(
            vehicle.insurance_company,
            rawResult?.vehicle_insurance_details?.insurance_company_name,
            rawResult?.insurance_company
        ),
        insurance_policy: coalesce(
            vehicle.insurance_policy,
            rawResult?.vehicle_insurance_details?.policy_no,
            rawResult?.policy_no
        ),
        insurance_expiry: coalesce(
            vehicle.insurance_expiry,
            rawResult?.vehicle_insurance_details?.insurance_upto,
            rawResult?.insurance_upto
        ),
        tax_paid_upto: coalesce(vehicle.tax_paid_upto, rawResult?.tax_paid_upto),
        tax_upto: coalesce(vehicle.tax_upto, rawResult?.tax_upto),
        permit_type: coalesce(vehicle.permit_type, rawResult?.permit_details?.permit_type, rawResult?.permit_type),
        permit_number: coalesce(vehicle.permit_number, rawResult?.permit_details?.permit_no, rawResult?.permit_number),
        permit_issue_date: coalesce(
            vehicle.permit_issue_date,
            rawResult?.permit_details?.issue_date,
            rawResult?.permit_issue_date
        ),
        permit_valid_from: coalesce(
            vehicle.permit_valid_from,
            rawResult?.permit_details?.valid_from,
            rawResult?.permit_valid_from
        ),
        permit_valid_upto: coalesce(
            vehicle.permit_valid_upto,
            rawResult?.permit_details?.valid_upto,
            rawResult?.permit_valid_upto
        ),
        national_permit_number: coalesce(
            vehicle.national_permit_number,
            rawResult?.permit_details?.national_permit_number,
            rawResult?.national_permit_number
        ),
        national_permit_issued_by: coalesce(
            vehicle.national_permit_issued_by,
            rawResult?.permit_details?.national_permit_issued_by,
            rawResult?.national_permit_issued_by
        ),
        national_permit_upto: coalesce(
            vehicle.national_permit_upto,
            rawResult?.permit_details?.national_permit_upto,
            rawResult?.national_permit_upto
        ),
        pucc_number: coalesce(vehicle.pucc_number, rawResult?.vehicle_pucc_details?.pucc_no, rawResult?.pucc_no),
        pucc_upto: coalesce(vehicle.pucc_upto, rawResult?.vehicle_pucc_details?.pucc_upto, rawResult?.pucc_upto),
        vehicle_image: vehicle.vehicle_image,
        vehicle_category: vehicle.vehicle_category,
        raw_response: vehicle.raw_response,
        created_at: vehicle.created_at,
        updated_at: vehicle.updated_at,
        last_synced_at: vehicle.last_synced_at
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

        // Safety net: in case migrations were not applied, ensure the vehicle_category column exists
        // so updates with vehicle_category don't fail in production.
        if (updates.vehicle_category) {
            try {
                await pool.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns
                            WHERE table_name = 'vehicle_rc_info' AND column_name = 'vehicle_category'
                        ) THEN
                            ALTER TABLE vehicle_rc_info ADD COLUMN vehicle_category VARCHAR(50);
                        END IF;
                    END$$;
                `);
            } catch (e) {
                console.warn('ensure vehicle_category column failed:', e.message);
            }
        }

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

/* ============================================================
   MANUAL VEHICLE ADD - Accept complete API response JSON
============================================================ */
const addVehicleManually = async (req, res) => {
    try {
        const vehicleData = req.body;

        // Validation - vehicle_id or vehicle_number is required
        const vehicleId = vehicleData.vehicle_id || vehicleData.license_plate || vehicleData.vehicle_number;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'vehicle_id, license_plate, or vehicle_number is required'
            });
        }

        if (!vehicleData.license_plate) {
            return res.status(400).json({
                success: false,
                error: 'license_plate is required'
            });
        }

        const normalizedVehicleId = vehicleId.toUpperCase();
        const userId = getUserIdFromCookie(req);

        // Prepare data for saving - extract top-level fields
        const dataToSave = {
            license_plate: vehicleData.license_plate,
            brand_name: vehicleData.brand_name || '',
            brand_model: vehicleData.brand_model || '',
            owner_name: vehicleData.owner_name || '',
            fuel_type: vehicleData.fuel_type || '',
            class: vehicleData.class || '',
            color: vehicleData.color || '',
            vehicle_image: vehicleData.vehicle_image || generateCarImageUrl(vehicleData.brand_name, vehicleData.brand_model, vehicleData.class),
            vehicle_category: vehicleData.vehicle_category || null,  // Will be detected automatically if null
            // Store the entire incoming object as raw_response
            raw_response: vehicleData.raw_response ? vehicleData.raw_response : {
                provider: 'manual_entry',
                manual_entry: true,
                added_at: new Date().toISOString(),
                ...vehicleData
            }
        };

        // Save vehicle to database using the same function as /rc-info
        const savedVehicle = await saveVehicleRCInfo({
            ...dataToSave,
            license_plate: normalizedVehicleId  // Use vehicle_id as the key
        });

        // Link vehicle to user if authenticated
        await linkVehicleToUser(userId, normalizedVehicleId);

        // Get vehicle category
        const category = await ensureVehicleCategory(savedVehicle);
        const responseData = { ...savedVehicle, vehicle_category: category };

        return res.status(201).json({
            success: true,
            data: responseData,
            source: 'manual_entry'
        });
    } catch (error) {
        console.error('Error adding vehicle manually:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to add vehicle manually'
        });
    }
};

/* ============================================================
   GENERATE VEHICLE IMAGE URL
============================================================ */
const generateVehicleImage = async (req, res) => {
    try {
        const { model, brand_model } = req.query;

        // Use brand_model or model parameter
        const vehicleModel = brand_model || model;

        if (!vehicleModel) {
            return res.status(400).json({
                success: false,
                error: 'model or brand_model query parameter is required'
            });
        }

        // Generate the image URL using the same logic
        const imageUrl = generateCarImageUrl(null, vehicleModel);

        return res.status(200).json({
            success: true,
            model: vehicleModel,
            vehicle_image: imageUrl,
            url_slug: vehicleModel
                .toString()
                .trim()
                .toLowerCase()
                .replace(/[\\/]+/g, '_')
                .replace(/\s+/g, '_')
        });
    } catch (error) {
        console.error('Error generating vehicle image:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate vehicle image URL'
        });
    }
};

/* ============================================================
   ADD VEHICLE FROM MYMOTOR API RESPONSE
============================================================ */
const addVehicleFromMyMotor = async (req, res) => {
    try {
        const myMotorData = req.body;

        // Validate required data structure
        if (!myMotorData.data || !myMotorData.data.key_information) {
            return res.status(400).json({
                success: false,
                error: 'Invalid MyMotor response format. Expected data.key_information'
            });
        }

        const keyInfo = myMotorData.data.key_information || {};
        const vehicleDetails = myMotorData.data.vehicle_details || {};
        const insuranceDetails = myMotorData.data.insurance_details || {};
        const pucDetails = myMotorData.data.puc_details || {};

        // Extract vehicle ID from rc_reg_no
        const vehicleId = keyInfo.rc_reg_no;
        
        if (!vehicleId) {
            return res.status(400).json({
                success: false,
                error: 'rc_reg_no is required in key_information'
            });
        }

        const normalizedVehicleId = vehicleId.toUpperCase();
        const userId = getUserIdFromCookie(req);

        // Map MyMotor response to vehicle data structure
        const vehicleData = {
            vehicle_id: normalizedVehicleId,
            license_plate: normalizedVehicleId,
            chassis_number: vehicleDetails.rc_chassis_number || null,
            engine_number: vehicleDetails.rc_engine_number || null,
            brand_name: vehicleDetails.manufacturer || '',
            brand_model: vehicleDetails.model_name || '',
            fuel_type: vehicleDetails.fuel_type || null,
            color: vehicleDetails.color || null,
            cubic_capacity: vehicleDetails.vehicle_cubic_capacity ? parseFloat(vehicleDetails.vehicle_cubic_capacity) : null,
            cylinders: vehicleDetails.vehicle_number_of_cylinders || null,
            seating_capacity: vehicleDetails.vehicle_seating_capacity || null,
            vehicle_age: null,
            class: vehicleDetails.vehicle_class || '',
            norms: pucDetails.emission_norm || null,
            owner_name: keyInfo.owner_name || null,
            father_name: keyInfo.father_name || null,
            owner_count: null,
            present_address: keyInfo.user_present_address || null,
            permanent_address: keyInfo.user_permanent_address || null,
            registration_date: keyInfo.registration_date || null,
            rc_status: keyInfo.rc_status || null,
            source: 'mymotor',
            is_financed: keyInfo.vehicle_financed ? true : false,
            financer: keyInfo.financer || null,
            noc_details: keyInfo.rc_noc_details || null,
            insurance_company: insuranceDetails.insurance_company || null,
            insurance_policy: insuranceDetails.policy_number || null,
            insurance_expiry: insuranceDetails.insurance_valid_upto || null,
            tax_paid_upto: null,
            tax_upto: vehicleDetails.rc_tax_upto || null,
            permit_type: vehicleDetails.rc_permit_type || null,
            permit_number: vehicleDetails.rc_permit_number || null,
            permit_issue_date: vehicleDetails.rc_permit_issued_date || null,
            permit_valid_from: vehicleDetails.rc_permit_start_date || null,
            permit_valid_upto: vehicleDetails.rc_permit_expiry_date || null,
            national_permit_number: vehicleDetails.national_permit_number || null,
            national_permit_issued_by: vehicleDetails.national_permit_issued_by || null,
            national_permit_upto: vehicleDetails.national_permit_expiry_date || null,
            pucc_number: pucDetails.rc_pucc_no || null,
            pucc_upto: pucDetails.expiry_date || null,
            vehicle_image: null, // Will be generated
            raw_response: myMotorData // Store entire response
        };

        // Generate image URL
        vehicleData.vehicle_image = generateCarImageUrl(vehicleData.brand_name, vehicleData.brand_model, vehicleData.class);

        // Save vehicle to database
        const savedVehicle = await saveVehicleRCInfo(vehicleData);
        
        // Link vehicle to user if authenticated
        await linkVehicleToUser(userId, normalizedVehicleId);

        // Get vehicle category
        const category = await ensureVehicleCategory(savedVehicle);
        const responseData = { ...savedVehicle, vehicle_category: category };

        return res.status(201).json({
            success: true,
            data: responseData,
            source: 'mymotor'
        });
    } catch (error) {
        console.error('Error adding vehicle from MyMotor:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to add vehicle from MyMotor'
        });
    }
};

module.exports = {
    getVehicleRCInfo,
    getSavedVehicles,
    getMyVehicles,
    updateSavedVehicle,
    deleteSavedVehicle,
    getUserVehicles,
    addVehicleManually,
    generateVehicleImage,
    addVehicleFromMyMotor
};
