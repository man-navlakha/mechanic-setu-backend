const ALLOWED_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const ensureCsrfToken = (req, res, next) => {
  if (ALLOWED_SAFE_METHODS.has(req.method)) {
    return next();
  }

  const csrfCookie = req.cookies?.csrftoken;
  const csrfHeader = req.headers['x-csrftoken'];

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({
      error: 'CSRF token missing or invalid. Please refresh and try again.'
    });
  }

  next();
};

module.exports = { ensureCsrfToken };
