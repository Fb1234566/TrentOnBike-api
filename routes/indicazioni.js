const express = require('express');
const router = express.Router();
const {Percorso, Tappa} = require('../models/Percorso');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');


/**
 * @swagger
 * /indicazioni/route:
 *   get:
 *     summary: Ottiene indicazioni stradali per percorsi ciclistici tra più tappe
 *     description: Chiama l'API Mapbox per ottenere indicazioni dettagliate per un percorso ciclistico
 *     tags: [Indicazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: coord
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Coordinate in formato "lng,lat" (può essere specificato più volte)
 *         example: coord=-73.985245,40.761808&coord=-73.97121,40.784459
 *         required: true
 *     responses:
 *       200:
 *         description: Indicazioni stradali ottenute con successo
 *       400:
 *         description: Richiesta non valida - Formato coordinate errato
 *       401:
 *         description: Non autorizzato
 *       500:
 *         description: Errore del server
 */
router.get('/route', authenticateToken, async (req, res) => {
    try {
        // Ottieni le coordinate dai parametri di query
        const coords = req.query.coord;

        // Validazione
        if (!coords || !Array.isArray(coords) || coords.length < 2) {
            return res.status(400).json({ error: 'Sono richieste almeno 2 coordinate in formato "lng,lat"' });
        }

        // Valida formato di ogni coordinata
        for (const coord of coords) {
            const parts = coord.split(',');
            if (parts.length !== 2 || isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1]))) {
                return res.status(400).json({ error: 'Formato coordinate non valido. Usa "lng,lat"' });
            }
        }

        // Unisci le coordinate per Mapbox
        const coordinatesString = coords.join(';');

        // Chiamata all'API Mapbox
        const response = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordinatesString}?` +
            `alternatives=true&annotations=distance%2Cduration&continue_straight=true&` +
            `geometries=geojson&language=en&overview=full&steps=true&access_token=${process.env.MAPBOX_TOKEN}`
        );

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Errore nella chiamata all\'API Mapbox:', error);
        res.status(500).json({ error: `Errore nel recupero delle indicazioni stradali: ${error.message}` });
    }
});

module.exports = router;