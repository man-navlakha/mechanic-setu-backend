require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mechanicRoutes = require('./routes/mechanic.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/mechanics', mechanicRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Mechanic Setu API is running' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on:`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://172.20.10.2:${PORT}`);
});
