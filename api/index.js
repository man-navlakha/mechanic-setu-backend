const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const errorHandler = require('../middleware/errorHandler');

const healthRoutes = require('../routes/healthRoutes');
const mechanicRoutes = require('../routes/mechanicRoutes');
const msMechanicRoutes = require('../routes/msMechanicRoutes');

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ==================== ROUTES ====================

// Use Routes
app.use('/', healthRoutes);
app.use('/api/mechanics', mechanicRoutes);
app.use('/api/ms-mechanics', msMechanicRoutes);

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
