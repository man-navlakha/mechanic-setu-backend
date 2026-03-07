const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const errorHandler = require('./helper/errorHandler');
const healthRoutes = require('./routes/healthRoutes');
const mechanicRoutes = require('./routes/mechanicRoutes');
const msMechanicRoutes = require('./routes/msMechanicRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const jobRoutes = require('./routes/jobRoutes');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const adminServiceRequestRoutes = require('./routes/adminServiceRequestRoutes');
const adminStatsRoutes = require('./routes/adminStatsRoutes');
const adminVehicleRoutes = require('./routes/adminVehicleRoutes');

const app = express();
app.use(cookieParser());

// ⚠️ JSON Parser MUST come before any middleware that accesses req.body
app.use(express.json({ limit: '50mb' })); // Support large JSON payloads

// // Debug: Check Email Environment Variables on Startup
// console.log('--- 📧 Email Config Debug ---');
// console.log('SMTP_GMAIL_USER or SMTP_USER:', process.env.SMTP_GMAIL_USER || process.env.SMTP_USER ? 'SET' : 'NOT SET');
// console.log('SMTP configured check: see [api/helper/otpEmail.js] for details (transporter meta is logged on startup)');
// console.log('-----------------------------');

// Simple request logger (for debugging routing/proxy issues)
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// Debug: Log Request Body (to see if email is passed correctly)
app.use((req, _res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Debug: Display current request being processed
app.use((req, _res, next) => {
    let service = 'Unknown';

    if (req.originalUrl.includes('/api/vehicle')) {
        service = 'Vehicle Service';
    } else if (req.originalUrl.includes('/api/mechanics')) {
        service = 'Mechanic Service';
    } else if (req.originalUrl.includes('/api/auth')) {
        service = 'Authentication Service';
    } else if (req.originalUrl.includes('/api/job')) {
        service = 'Job Service';
    } else if (req.originalUrl.includes('/api/service')) {
        service = 'Service Management';
    } else if (req.originalUrl.includes('/api/admin')) {
        service = 'Admin Service';
    }

    console.log(`Processing request: ${req.method} ${req.originalUrl} | Service: ${service}`);
    console.log(`Request Origin: ${req.headers.origin || 'Unknown Origin'}`);
    console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    next();
});

// Middleware
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
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

// ==================== ROUTES ====================

// Use Routes
app.use('/', healthRoutes);

// Auth routes mounted at multiple prefixes to tolerate dev proxy misconfigs
app.use('/api', authRoutes);
app.use('/', authRoutes);        // handles proxies that strip /api prefix
app.use('/api', profileRoutes);
app.use('/', profileRoutes);

app.use('/api/mechanics', mechanicRoutes);
app.use('/api/ms-mechanics', msMechanicRoutes);
app.use('/api', adminVehicleRoutes);
app.use('/', adminVehicleRoutes); // handles proxies that strip /api prefix
app.use('/api/vehicle', vehicleRoutes);
app.use('/api', jobRoutes);
app.use('/api', serviceRoutes);
app.use('/api', adminUserRoutes);
app.use('/api', adminServiceRequestRoutes);
app.use('/api', adminStatsRoutes);


// Error handler
app.use(errorHandler);

// Export for Vercel
module.exports = app;

// Start server (Vercel sets VERCEL=1, so this won't run on Vercel)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    const os = require('os');
    
    app.listen(PORT, '0.0.0.0', () => {
        const networkInterfaces = os.networkInterfaces();
        const localIPv4 = Object.values(networkInterfaces)
            .flat()
            .find(addr => addr.family === 'IPv4' && !addr.internal)?.address || 'N/A';
        
        console.log(`\n🚀 Server running on:`);
        console.log(`   Local:    http://localhost:${PORT}`);
        console.log(`   Network:  http://${localIPv4}:${PORT}`);
        console.log(`\n✅ Ready for development!\n`);
    });
}
