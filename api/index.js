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
const authRoutes = require('./auth');

const app = express();
app.use(cookieParser());

// Middleware
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://mechanic-setu.vercel.app' // Add your production URL here
];

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
app.use('/api/auth', authRoutes);
app.use('/api/mechanics', mechanicRoutes);
app.use('/api/ms-mechanics', msMechanicRoutes);
app.use('/api/vehicle', vehicleRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

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
