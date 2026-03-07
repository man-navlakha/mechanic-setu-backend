const nodemailer = require('nodemailer');

const NODE_ENV = process.env.NODE_ENV || 'development';

const boolFromEnv = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off', ''].includes(normalized)) return false;
  return defaultValue;
};

const hasEnvKey = (key) => Object.prototype.hasOwnProperty.call(process.env, key);

const getOtpFromAddress = () => {
  if (process.env.OTP_EMAIL_FROM) return process.env.OTP_EMAIL_FROM;
  const fallbackUser = process.env.SMTP_GMAIL_USER || process.env.SMTP_USER;
  if (fallbackUser) return `"Mechanic Setu" <${fallbackUser}>`;
  return '"Mechanic Setu" <noreply@mechanicsetu.com>';
};

let smtpTransporter = null;
let smtpTransporterMeta = null;
let smtpTransporterVerified = false;
let smtpVerifyPromise = null;

const buildSmtpTransporter = () => {
  const smtpDebug = boolFromEnv(process.env.SMTP_DEBUG, false);

  // Only Gmail SMTP is supported. Prefer OAuth2 if configured, otherwise use App Password.
  const gmailUser = process.env.SMTP_GMAIL_USER || process.env.SMTP_USER;
  const oauthClientId = process.env.SMTP_GMAIL_OAUTH_CLIENT_ID;
  const oauthClientSecret = process.env.SMTP_GMAIL_OAUTH_CLIENT_SECRET;
  const oauthRefreshToken = process.env.SMTP_GMAIL_OAUTH_REFRESH_TOKEN;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (gmailUser && oauthClientId && oauthClientSecret && oauthRefreshToken) {
    smtpTransporterMeta = { mode: 'gmail-oauth2', user: gmailUser, debug: smtpDebug };
    smtpTransporter = nodemailer.createTransport({
      service: 'gmail',
      logger: smtpDebug,
      debug: smtpDebug,
      auth: {
        type: 'OAuth2',
        user: gmailUser,
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        refreshToken: oauthRefreshToken
      }
    });
    return;
  }

  if (gmailUser && smtpPassword) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    let secure = hasEnvKey('SMTP_SECURE') ? boolFromEnv(process.env.SMTP_SECURE, false) : port === 465;
    // Auto-correct common misconfiguration: port 587 should use STARTTLS (secure=false)
    if (port === 587 && secure) {
      console.warn('[SMTP] Warning: SMTP_SECURE=true with port 587 is incompatible. Forcing secure=false (STARTTLS).');
      secure = false;
    }
    const requireTLS = boolFromEnv(process.env.SMTP_REQUIRE_TLS, !secure && port === 587);

    smtpTransporterMeta = { mode: 'gmail-password', host, port, secure, requireTLS, user: gmailUser, debug: smtpDebug };
    smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      logger: smtpDebug,
      debug: smtpDebug,
      tls: {
        minVersion: 'TLSv1.2'
      },
      auth: {
        user: gmailUser,
        pass: smtpPassword
      }
    });
    return;
  }

  // If we reach here, Gmail SMTP was not configured.
  smtpTransporter = null;
};

buildSmtpTransporter();

if (smtpTransporterMeta) {
  // console.log('[SMTP] configured:', smtpTransporterMeta);
} else {
  // console.log('[SMTP] not configured; OTP will use fallback delivery.');
}

const verifySmtpOnce = async () => {
  if (!smtpTransporter) return false;
  if (smtpTransporterVerified) return true;
  if (smtpVerifyPromise) return smtpVerifyPromise;

  smtpVerifyPromise = (async () => {
    try {
      await smtpTransporter.verify();
      smtpTransporterVerified = true;
      console.log('[SMTP] OTP transporter verified.');
      return true;
    } catch (err) {
      console.error('[SMTP] Transport verify failed:', err?.message || err);
      return false;
    } finally {
      smtpVerifyPromise = null;
    }
  })();

  return smtpVerifyPromise;
};

const sendOtpViaSmtp = async ({ to, subject, text, html }) => {
  if (!smtpTransporter) {
    console.error('[SMTP] transporter not configured. Check SMTP_GMAIL_USER and SMTP_PASSWORD / OAuth settings.');
    return { ok: false, provider: 'smtp', error: 'SMTP transporter not configured' };
  }

  const verified = await verifySmtpOnce();
  if (!verified) {
    console.error('[SMTP] transporter verification failed. Please check credentials and network.');
    return { ok: false, provider: 'smtp', error: 'SMTP verify failed' };
  }

  try {
    const info = await smtpTransporter.sendMail({
      from: getOtpFromAddress(),
      to,
      subject,
      text,
      html
    });
    console.log('[SMTP] email sent:', { to, messageId: info?.messageId });
    return { ok: true, provider: 'smtp', id: info?.messageId };
  } catch (err) {
    console.error('[SMTP] sendMail failed:', err?.message || err, err);
    return { ok: false, provider: 'smtp', error: err?.message || String(err) };
  }
};


const shouldLogOtpFallback = () => {
  if (NODE_ENV !== 'production') return true;
  return boolFromEnv(process.env.OTP_LOG_IN_PROD, false);
};

const deliverOtpEmail = async ({ to, otp, expiresMinutes }) => {
  const subject = 'Your Mechanic Setu OTP';
  const text = `Your one-time password is ${otp}. It expires in ${expiresMinutes} minutes.`;
  const html = `
    <div style="margin:0;padding:0;background-color:#f6f7fb;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f6f7fb;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;box-shadow:0 6px 18px rgba(22,34,51,0.08);">
              <tr>
                <td style="padding:24px 28px 16px 28px;border-bottom:1px solid #eef1f6;">
                  <div style="font-family:Arial, Helvetica, sans-serif;font-size:18px;font-weight:700;color:#0f1a2b;">
                    Mechanic Setu
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 28px 8px 28px;">
                  <div style="font-family:Arial, Helvetica, sans-serif;font-size:16px;color:#1f2a3a;line-height:1.5;">
                    Use the OTP below to sign in. It expires in ${expiresMinutes} minutes.
                  </div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:12px 28px 20px 28px;">
                  <div style="font-family:Arial, Helvetica, sans-serif;font-size:28px;letter-spacing:4px;font-weight:700;color:#0f1a2b;background:#f1f5ff;border:1px solid #d6e2ff;padding:12px 20px;border-radius:10px;display:inline-block;">
                    ${otp}
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 24px 28px;">
                  <div style="font-family:Arial, Helvetica, sans-serif;font-size:13px;color:#6b7280;line-height:1.5;">
                    If you did not request this, you can safely ignore this email.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  try {
    if (!smtpTransporter) {
      console.error('[OTP] SMTP transporter is not configured; cannot deliver OTP via Gmail SMTP.');
      if (shouldLogOtpFallback()) {
        console.log(`[OTP fallback] ${to} -> ${otp}`);
      }
      return { ok: false, provider: 'console', error: 'SMTP not configured' };
    }

    const smtpResult = await sendOtpViaSmtp({ to, subject, text, html });
    if (smtpResult.ok) return smtpResult;
    console.error('[OTP] SMTP send failed:', smtpResult.error);
    if (shouldLogOtpFallback()) {
      console.log(`[OTP fallback] ${to} -> ${otp}`);
    }
    return smtpResult;
  } catch (err) {
    console.error('[OTP] delivery failed:', err?.message || err);
    if (shouldLogOtpFallback()) {
      console.log(`[OTP fallback] ${to} -> ${otp}`);
    }
    return { ok: false, provider: 'console', error: err?.message || String(err) };
  }
};

module.exports = {
  deliverOtpEmail
};
