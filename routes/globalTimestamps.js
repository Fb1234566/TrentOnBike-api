const express = require('express');
const router = express.Router();
const { getGlobalTimestamp, VALID_KEYS } = require('../models/GlobalTimestamp');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

/**
 * @swagger
 * tags:
 *   name: Global Timestamps
 *   description: Endpoint per gestire i timestamp globali, come "lastReportsUpdate".
 *
 * components:
 *   schemas:
 *     GlobalTimestamp:
 *       type: object
 *       properties:
 *         key:
 *           type: string
 *           enum:
 *             - lastReportsUpdate
 *           example: lastReportsUpdate
 *           description: Nome del timestamp globale
 *         value:
 *           type: string
 *           format: date-time
 *           description: Valore del timestamp globale
 *           example: "2023-10-31T15:24:00.000Z"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Descrizione errore.
 *         error:
 *           type: string
 *           nullable: true
 *
 * securitySchemes:
 *   bearerAuth:
 *     type: http
 *     scheme: bearer
 *     bearerFormat: JWT
 */

// GET ottiene una variabile timestamp globale data la chiave (in VALID_KEYS) (per operatore e admin)
/**
 * @swagger
 * /globalTimestamps/{key}:
 *   get:
 *     summary: Ottieni il valore di un timestamp globale
 *     tags: [Global Timestamps]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         description: Chiave del timestamp globale da recuperare
 *         schema:
 *           type: string
 *           enum:
 *             - lastReportsUpdate
 *     responses:
 *       200:
 *         description: Timestamp recuperato con successo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GlobalTimestamp'
 *       400:
 *         description: La chiave fornita non è valida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Il timestamp globale non è stato trovato
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Errore interno del server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:key', authenticateToken, authorizeRole(['operatore', 'admin']),  async (req, res) => {
    const { key } = req.params;

    try {
        // Verifica che la chiave sia valida
        if (!Object.values(VALID_KEYS).includes(key)) {
            return res.status(400).json({
                message: `Chiave '${key}' non è valida.`,
                error: `Le chiavi valide sono: ${Object.values(VALID_KEYS).join(', ')}`
            });
        }

        // Recupera il valore del timestamp globale
        const value = await getGlobalTimestamp(key);

        if (!value) {
            return res.status(404).json({
                message: `Chiave '${key}' non trovata.`,
                error: null
            });
        }

        return res.status(200).json({ key, value });
    } catch (error) {
        console.error('Errore nel recupero del timestamp globale:', error.message);
        return res.status(500).json({
            message: 'Errore interno del server.',
            error: error.message
        });
    }
});

module.exports = router;