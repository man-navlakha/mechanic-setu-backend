exports.getHome = (req, res) => {
    res.json({
        status: 'ok',
        message: 'Mechanic Setu API is running',
        version: '1.0.0',
        endpoints: {
            health: 'GET /',
            mechanics: {
                all: 'GET /api/mechanics',
                nearby: 'GET /api/mechanics/nearby?latitude=XX&longitude=XX&radius=10',
                byId: 'GET /api/mechanics/:id'
            },
            ms_mechanics: {
                all: 'GET /api/ms-mechanics',
                nearby: 'GET /api/ms-mechanics/nearby?latitude=XX&longitude=XX&radius=10',
                byId: 'GET /api/ms-mechanics/:id',
                create: 'POST /api/ms-mechanics',
                update: 'PATCH /api/ms-mechanics/:id',
                delete: 'DELETE /api/ms-mechanics/:id',
                updateLocation: 'PUT /api/ms-mechanics/:id/location',
                updateStatus: 'PUT /api/ms-mechanics/:id/status'
            }
        }
    });
};

exports.getHealth = (req, res) => {
    res.json({ status: 'ok', message: 'Mechanic Setu API is running' });
};