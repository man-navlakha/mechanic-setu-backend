const pool = require('../../db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const { deliverOtpEmail } = require('../helper/otpEmail');

const SIGNING_KEY = process.env.SIGNING_KEY;
const ACCESS_TOKEN_LIFETIME = process.env.ACCESS_TOKEN_LIFETIME || '15m';
const REFRESH_TOKEN_LIFETIME = process.env.REFRESH_TOKEN_LIFETIME || '7d';
const OTP_EXPIRATION_MINUTES = parseInt(process.env.OTP_EXPIRATION_MINUTES || '5', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const REFRESH_TOKENS_TABLE = 'auth_refresh_tokens';

// For cross-site cookies (e.g., frontend at 5173, backend at 3000),
// SameSite must be 'None' and the cookie must be 'Secure'.
// Modern browsers often treat localhost as a secure context, allowing this.
const isProduction = NODE_ENV === 'production';

// Default to true in production. In dev, we also set to true to enable cross-site cookies.
const secureCookie = process.env.COOKIE_SECURE !== undefined
  ? (process.env.COOKIE_SECURE === 'true')
  : true; // Set to true for both production and local cross-site development

// 'None' is required for cross-origin contexts. 'Lax' is too restrictive.
const sameSitePolicy = process.env.COOKIE_SAMESITE || 'None';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CSRF_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const COOKIE_PATH = '/';
const OTP_TABLE = 'auth_otp_sessions';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^\+?\d{7,15}$/;

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const authCookieOptions = {
  httpOnly: false,
  secure: secureCookie,
  sameSite: sameSitePolicy,
  path: COOKIE_PATH
};

const csrfCookieOptions = {
  httpOnly: false,
  secure: secureCookie,
  sameSite: sameSitePolicy,
  path: COOKIE_PATH,
  maxAge: CSRF_MAX_AGE
};

const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000)).padStart(6, '0');

const generateRandomPassword = () => crypto.randomBytes(16).toString('hex');

const isProfileComplete = (user) => Boolean(user?.mobile_number);

const mapUserForClient = (user) => ({
  id: user.id,
  email: user.email,
  first_name: user.first_name || '',
  last_name: user.last_name || '',
  mobile_number: user.mobile_number || ''
});

const parseJwtExpiryToDate = (jwtSecondsSinceEpoch) => new Date(jwtSecondsSinceEpoch * 1000);

const buildTokens = (user, options = {}) => {
  if (!SIGNING_KEY) {
    throw new Error('SIGNING_KEY is not configured');
  }
  if (!user.id) {
    console.error("❌ Token generation failed: User object missing ID", user);
    throw new Error('User ID is required to build tokens');
  }

  const refreshJti = options.refreshJti || uuidv4();

  const sharedPayload = {
    user_id: user.id,
    email: user.email,
    id: user.id,      // Fallback for some configurations
  };

  const accessToken = jwt.sign(
    { ...sharedPayload, token_type: 'access', jti: uuidv4()},
    SIGNING_KEY,
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_LIFETIME
    }
  );

  const refreshToken = jwt.sign(
    { ...sharedPayload, token_type: 'refresh', jti: refreshJti },
    SIGNING_KEY,
    {
      algorithm: 'HS256',
      expiresIn: REFRESH_TOKEN_LIFETIME
    }
  );

  return { accessToken, refreshToken, refreshJti };
};

const persistRefreshToken = async ({ userId, refreshToken, refreshJti }) => {
  const decoded = jwt.decode(refreshToken);
  const expiresAt = decoded?.exp ? parseJwtExpiryToDate(decoded.exp) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tokenHash = hashValue(refreshToken);

  const isMissingRefreshTable = (error) => error?.code === '42P01'
    && typeof error?.message === 'string'
    && error.message.includes(`relation \"${REFRESH_TOKENS_TABLE}\" does not exist`);

  await pool.query(
    `
      INSERT INTO ${REFRESH_TOKENS_TABLE} (user_id, jti, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (jti) DO NOTHING
    `,
    [userId, refreshJti, tokenHash, expiresAt]
  ).catch((error) => {
    if (isMissingRefreshTable(error)) {
      const err = new Error(`Missing table ${REFRESH_TOKENS_TABLE}. Run migrations to enable refresh token rotation/blacklisting.`);
      err.code = 'MISSING_REFRESH_TABLE';
      throw err;
    }
    throw error;
  });

  return { expiresAt };
};

const setAuthCookies = (res, tokens) => {
  // Debug log to help trace cookie issues in logs
  if (process.env.DEBUG_COOKIES === 'true') {
    console.log('🍪 Setting Auth Cookies:', { secure: secureCookie, sameSite: sameSitePolicy, domain: authCookieOptions.domain || 'current' });
  }

  res.cookie('access', tokens.accessToken, {
    ...authCookieOptions,
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  res.cookie('refresh', tokens.refreshToken, {
    ...authCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  const csrfToken = crypto.randomBytes(24).toString('hex');
  res.cookie('csrftoken', csrfToken, csrfCookieOptions);
};

const clearAuthCookies = (res) => {
  res.cookie('access', '', { ...authCookieOptions, maxAge: 0 });
  res.cookie('refresh', '', { ...authCookieOptions, maxAge: 0 });
  res.cookie('csrftoken', '', { ...csrfCookieOptions, maxAge: 0 });
};

const sendOtpEmail = async (email, otp) => {
  try {
    const result = await deliverOtpEmail({ to: email, otp, expiresMinutes: OTP_EXPIRATION_MINUTES });
    if (!result || !result.ok) {
      console.error('Failed to deliver OTP email:', result);
      return result || { ok: false, provider: 'console', error: 'Unknown delivery error' };
    }

    console.log('OTP email delivered:', { to: email, provider: result.provider, id: result.id || result.messageId || null });
    return result;
  } catch (err) {
    console.error('Failed to deliver OTP email:', err);
    return { ok: false, provider: 'console', error: err?.message || String(err) };
  }
};

const createOtpSession = async (userId) => {
  const sessionKey = uuidv4();
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

  await pool.query(
    `
      INSERT INTO ${OTP_TABLE} (session_key, user_id, otp_hash, expires_at, status, last_sent_at)
      VALUES ($1, $2, $3, $4, 'PENDING', NOW())
    `,
    [sessionKey, userId, hashValue(otp), expiresAt]
  );

  return { sessionKey, otp };
};

const getOtpSession = async (sessionKey, userId) => {
  const result = await pool.query(
    `
      SELECT *
      FROM ${OTP_TABLE}
      WHERE session_key = $1
        AND user_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [sessionKey, userId]
  );

  return result.rows[0] || null;
};

const incrementOtpAttempts = async (sessionId, status = 'FAILED') => {
  await pool.query(
    `
      UPDATE ${OTP_TABLE}
      SET attempts = attempts + 1,
          status = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [sessionId, status]
  );
};

const markOtpVerified = async (sessionId) => {
  await pool.query(
    `
      UPDATE ${OTP_TABLE}
      SET attempts = attempts + 1,
          status = 'VERIFIED',
          updated_at = NOW()
      WHERE id = $1
    `,
    [sessionId]
  );
};

const findUserByEmail = async (email) => {
  const result = await pool.query(
    `
      SELECT *
      FROM users_customuser
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
};

const findUserById = async (id) => {
  const result = await pool.query(
    `
      SELECT *
      FROM users_customuser
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
};

const findUserByGoogleId = async (googleId) => {
  if (!googleId) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT *
      FROM users_customuser
      WHERE google_id = $1
      LIMIT 1
    `,
    [googleId]
  );

  return result.rows[0] || null;
};

const createUser = async (email, firstName = '', lastName = '', googleId = null, profilePic = null) => {
  const columns = [
    'email',
    'first_name',
    'last_name',
    'password',
    'is_active',
    'is_staff',
    'is_superuser',
    'date_joined'
  ];
  const values = [
    email,
    firstName || '',
    lastName || '',
    generateRandomPassword(),
    true,
    false,
    false,
    new Date()
  ];

  if (googleId) {
    columns.push('google_id');
    values.push(googleId);
  }

  if (profilePic) {
    columns.push('profile_pic');
    values.push(profilePic);
  }

  const placeholders = columns.map((_, index) => `$${index + 1}`);

  const result = await pool.query(
    `
      INSERT INTO users_customuser (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `,
    values
  );

  return result.rows[0];
};

const attachGoogleId = async (userId, googleId) => {
  if (!googleId) {
    return;
  }

  await pool.query(
    `
      UPDATE users_customuser
      SET google_id = $1
      WHERE id = $2
        AND (google_id IS NULL OR google_id = '')
    `,
    [googleId, userId]
  );
};

const isValidUUID = (value) => {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value.trim());
};

const loginSignUp = async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = await findUserByEmail(normalizedEmail);
    let userCreated = false;

    if (!user) {
      user = await createUser(normalizedEmail);
      userCreated = true;
    }

    const otpSession = await createOtpSession(user.id);
    const delivery = await sendOtpEmail(user.email, otpSession.otp);

    const status = isProfileComplete(user) ? 'Existing User' : 'New User';

    const payload = {
      key: otpSession.sessionKey,
      id: user.id,
      status,
      created: userCreated,
      delivery
    };

    if (!delivery || !delivery.ok) {
      // Email delivery failed — surface this to the client
      return res.status(502).json(payload);
    }

    res.json(payload);
  } catch (error) {
    console.error('Login_SignUp Error:', error);
    res.status(500).json({ error: 'Unable to start OTP authentication.' });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { id } = req.body;
    if (!req.body.key || !id) {
      return res.status(400).json({ error: 'Both key and id are required.' });
    }

    const user = await findUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found for the provided id.' });
    }

    const otpSession = await createOtpSession(user.id);
    const delivery = await sendOtpEmail(user.email, otpSession.otp);

    const payload = { key: otpSession.sessionKey, id: user.id, delivery };
    if (!delivery || !delivery.ok) return res.status(502).json(payload);
    res.json(payload);
  } catch (error) {
    console.error('resendOtp Error:', error);
    res.status(500).json({ error: 'Failed to resend OTP. Please try again.' });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { key, id, otp } = req.body || {};

    if (!key || !id || !otp) {
      return res.status(400).json({ error: 'key, id, and otp are required.' });
    }

    if (!isValidUUID(key)) {
      return res.status(400).json({ error: 'Invalid key format.' });
    }

    const user = await findUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const session = await getOtpSession(key, user.id);
    if (!session) {
      return res.status(404).json({ error: 'OTP session not found.' });
    }

    if (session.status === 'VERIFIED') {
      return res.status(400).json({ error: 'OTP session already verified.' });
    }

    if (new Date(session.expires_at) < new Date()) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    const otpHash = hashValue(otp);
    if (otpHash !== session.otp_hash) {
      await incrementOtpAttempts(session.id);
      return res.status(401).json({ error: 'OTP is incorrect. Please try again.' });
    }

    await markOtpVerified(session.id);
    await pool.query('UPDATE users_customuser SET last_login = NOW() WHERE id = $1', [user.id]);

    const tokens = buildTokens(user);
    try {
      await persistRefreshToken({ userId: user.id, refreshToken: tokens.refreshToken, refreshJti: tokens.refreshJti });
    } catch (error) {
      if (error?.code === 'MISSING_REFRESH_TABLE') {
        return res.status(503).json({ error: error.message });
      }
      throw error;
    }
    setAuthCookies(res, tokens);

    res.json({
      status: isProfileComplete(user) ? 'Existing User' : 'New User',
      user: mapUserForClient(user)
    });
  } catch (error) {
    console.error('verifyOtp error:', error);
    res.status(500).json({ error: 'Unable to verify OTP.' });
  }
};

const googleLogin = async (req, res) => {
  if (!googleClient) {
    return res.status(503).json({ error: 'Google login is not configured.' });
  }

  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Google ID token is required.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase?.();

    if (!email) {
      return res.status(400).json({ error: 'Google profile must include an email.' });
    }

    let user = await findUserByGoogleId(payload.sub);
    let newUser = false;

    if (!user) {
      user = await findUserByEmail(email);
    }

    if (!user) {
      user = await createUser(email, payload?.given_name, payload?.family_name, payload.sub, payload?.picture);
      newUser = true;
    } else {
      await attachGoogleId(user.id, payload.sub);
    }

    const status = newUser || !isProfileComplete(user) ? 'New User' : 'Existing User';

    const tokens = buildTokens(user);
    try {
      await persistRefreshToken({ userId: user.id, refreshToken: tokens.refreshToken, refreshJti: tokens.refreshJti });
    } catch (error) {
      if (error?.code === 'MISSING_REFRESH_TABLE') {
        return res.status(503).json({ error: error.message });
      }
      throw error;
    }
    setAuthCookies(res, tokens);
    await pool.query('UPDATE users_customuser SET last_login = NOW() WHERE id = $1', [user.id]);

    res.json({
      status,
      user: mapUserForClient(user),
      provider: 'Google'
    });
  } catch (error) {
    console.error('googleLogin error:', error);
    res.status(401).json({ error: 'Unable to verify Google login. Please try again.' });
  }
};

const setUsersDetail = async (req, res) => {
  try {
    const { first_name, last_name, mobile_number } = req.body;
    const user = await findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'Authenticated user not found.' });
    }

    const sanitizedMobile = typeof mobile_number === 'string'
      ? mobile_number.replace(/[^+0-9]/g, '').trim()
      : '';

    if (!user.mobile_number && !sanitizedMobile) {
      return res.status(400).json({ error: 'Mobile number is required.' });
    }

    if (sanitizedMobile && !MOBILE_REGEX.test(sanitizedMobile)) {
      return res.status(400).json({ error: 'Mobile number must be digits and optionally start with +.' });
    }

    const updates = [];
    const params = [];

    if (typeof first_name === 'string') {
      updates.push(`first_name = $${updates.length + 1}`);
      params.push(first_name.trim());
    }

    if (typeof last_name === 'string') {
      updates.push(`last_name = $${updates.length + 1}`);
      params.push(last_name.trim());
    }

    if (sanitizedMobile) {
      updates.push(`mobile_number = $${updates.length + 1}`);
      params.push(sanitizedMobile);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'Provide at least one field to update.' });
    }

    params.push(req.user.id);

    const result = await pool.query(
      `
        UPDATE users_customuser
        SET ${updates.join(', ')}
        WHERE id = $${params.length}
        RETURNING *
      `,
      params
    );

    res.json({
      message: 'Profile saved successfully.',
      profile: mapUserForClient(result.rows[0])
    });
  } catch (error) {
    console.error('setUsersDetail error:', error);
    res.status(500).json({ error: 'Unable to update profile.' });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    res.json(mapUserForClient(user));
  } catch (error) {
    console.error('getUserProfile error:', error);
    res.status(500).json({ error: 'Unable to load profile.' });
  }
};

const logout = (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true });
};

const me = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(mapUserForClient(user));
  } catch (error) {
    console.error('me error:', error);
    res.status(500).json({ error: 'Unable to retrieve user.' });
  }
};

const refreshTokens = async (req, res) => {
  if (!SIGNING_KEY) {
    return res.status(503).json({ error: 'Server signing key is missing.' });
  }

  try {
    const rawRefreshToken = req.cookies?.refresh || req.body?.refresh;

    if (!rawRefreshToken) {
      return res.status(401).json({ error: 'Refresh token is required.' });
    }

    const decoded = jwt.verify(rawRefreshToken, SIGNING_KEY, { algorithms: ['HS256'] });

    if (decoded.token_type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type.' });
    }

    const user = await findUserById(decoded.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const presentedJti = decoded.jti;
    if (!presentedJti) {
      return res.status(401).json({ error: 'Refresh token is missing jti.' });
    }

    const presentedHash = hashValue(rawRefreshToken);
    const existing = await pool.query(
      `
        SELECT id, revoked_at, expires_at
        FROM ${REFRESH_TOKENS_TABLE}
        WHERE user_id = $1 AND jti = $2 AND token_hash = $3
        LIMIT 1
      `,
      [user.id, presentedJti, presentedHash]
    );

    if (!existing.rows.length) {
      return res.status(401).json({ error: 'Refresh token is not recognized.' });
    }

    const tokenRow = existing.rows[0];
    if (tokenRow.revoked_at) {
      return res.status(401).json({ error: 'Refresh token has been revoked.' });
    }

    const tokens = buildTokens(user);

    // ROTATE_REFRESH_TOKENS=True, BLACKLIST_AFTER_ROTATION=True
    await pool.query(
      `
        UPDATE ${REFRESH_TOKENS_TABLE}
        SET revoked_at = NOW(), replaced_by = $1, last_used_at = NOW()
        WHERE user_id = $2 AND jti = $3 AND revoked_at IS NULL
      `,
      [tokens.refreshJti, user.id, presentedJti]
    );

    await persistRefreshToken({ userId: user.id, refreshToken: tokens.refreshToken, refreshJti: tokens.refreshJti });
    setAuthCookies(res, tokens);

    res.json({
      success: true,
      access: tokens.accessToken,
      refresh: tokens.refreshToken
    });
  } catch (error) {
    console.error('refreshTokens error:', error);
    res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
};

// Not recommended: exposes HttpOnly cookie token to JS.
// Prefer using cookies + `credentials: 'include'` and calling /core/me instead.
const getAccessToken = (req, res) => {
  const token = req.cookies?.access;
  if (!token) {
    return res.status(401).json({ error: 'Access token cookie is missing.' });
  }

  res.json({ access: token });
};

module.exports = {
  loginSignUp,
  verifyOtp,
  resendOtp,
  googleLogin,
  setUsersDetail,
  getUserProfile,
  logout,
  me,
  refreshTokens,
  getAccessToken
};
