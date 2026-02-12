const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const errorHandler = require('./helper/errorHandler');
const healthRoutes = require('./routes/healthRoutes');
const mechanicRoutes = require('./routes/mechanicRoutes');
const msMechanicRoutes = require('./routes/msMechanicRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');

const app = express();
app.use(cookieParser());

// Simple request logger (for debugging routing/proxy issues)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Middleware
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://mechanicsetu.netlify.app',
    'https://mechanic-setu.vercel.app', // Add your production URL here
    process.env.FRONTEND_URL // Dynamic from .env
].filter(Boolean); // Remove undefined/null values

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());

// ==================== ROUTES ====================

// Use Routes
app.use('/', healthRoutes);

// Auth routes mounted at multiple prefixes to tolerate dev proxy misconfigs
app.use('/api', authRoutes);
app.use('/', authRoutes);        // handles proxies that strip /api prefix

app.use('/api/mechanics', mechanicRoutes);
app.use('/api/ms-mechanics', msMechanicRoutes);
app.use('/api/vehicle', vehicleRoutes);


// Error handler
app.use(errorHandler);

// Export for Vercel
module.exports = app;

// Start server (Vercel sets VERCEL=1, so this won't run on Vercel)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on:`);
        console.log(`   Local:   http://localhost:${PORT}`);
    });
}
