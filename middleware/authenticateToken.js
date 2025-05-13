const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) {
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
        if (err) {
            return res.sendStatus(403); // Forbidden (token non valido o scaduto)
        }
        req.user = userPayload; // Aggiunge il payload del token (es. { userId: '...' }) alla request
        next();
    });
}

module.exports = authenticateToken;