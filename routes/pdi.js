const express = require('express');
const router = express.Router();
const PDI = require('../models/PDI');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

/*

PDIs Routes

*/
/**
 * @swagger
 * tags:
 *   name: Percorsi
 *   description: Gestione dei Percorsi, delle Tappe e dei punti di interesse
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     PDI:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         nome:
 *           type: string
 *         descrizione:
 *           type: string
 *         posizione:
 *           type: array
 *           items:
 *             type: number
 *         tipoPoi:
 *           type: string
 *           enum: [RASTRELLIERA, OFFICINA, FONTANELLA, PUNTO_RICARICA, MUSEO, MONUMENTO, LUOGO_STORICO_CULTURALE, ALTRO]
 *
 * security:
 *   - bearerAuth: []
 */

/**
 * @swagger
 * /pdi:
 *   get:
 *     tags: [Punti di Interesse]
 *     summary: Ottieni tutti i punti di interesse con filtro opzionale per tipo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipoPoi
 *         schema:
 *           type: string
 *         description: Filtra i punti di interesse per tipologia. Usa i valori separati da virgola per filtrare per più tipi (es. MUSEO,MONUMENTO)
 *         required: false
 *     responses:
 *       200:
 *         description: Lista dei punti di interesse filtrati
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PDI'
 *             example:
 *               - _id: "60d21b4667d0d8992e610c85"
 *                 nome: "Museo del Ciclismo"
 *                 descrizione: "Museo dedicato alla storia del ciclismo"
 *                 posizione: [45.464211, 9.191383]
 *                 tipoPoi: "MUSEO"
 *       400:
 *         description: Errore nella richiesta
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: Errore nella richiesta
 */

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { tipoPoi } = req.query;
        let query = {};

        if (tipoPoi) {
            // Dividi la stringa in un array di tipi
            const tipiArray = tipoPoi.split(',');
            query = { tipoPoi: { $in: tipiArray } };
        }

        const pdis = await PDI.find(query);
        return res.status(200).json(pdis);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /pdi:
 *   post:
 *     summary: Create a new PDI
 *     tags: [Punti di Interesse]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 description: Il nome del PDI
 *               descrizione:
 *                 type: string
 *                 description: La descrizione del PDI
 *               posizione:
 *                 type: integer
 *                 description: La posizione del PDI.
 *               tipoPoi:
 *                 type: string
 *                 description: Il tipo del PDI.
 *             required:
 *               - nome
 *     responses:
 *       201:
 *         description: Il PDI è stato creato con successo.
 *       400:
 *         description: Errore di validazione.
 */

router.post('/', authenticateToken, authorizeRole(["operatore","admin"]), async (req, res) => {
    try {
        const pdi = new PDI(req.body)
        await pdi.save();
        return res.status(201).json(pdi);
    } catch (err) {
        return res.status(400).json({ error: err });
    }

});

/**
 * @swagger
 * /pdi/{id}:
 *   patch:
 *     summary: Modifica un PDI
 *     tags: [Punti di Interesse]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del punto di interesse (deve essere URL-encoded se contiene caratteri speciali, usare encodeURIComponent)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 description: Il nome del PDI
 *               descrizione:
 *                 type: string
 *                 description: La descrizione del PDI
 *               posizione:
 *                 type: integer
 *                 description: La posizione del PDI.
 *               tipoPoi:
 *                 type: string
 *                 description: Il tipo del PDI.
 *             required:
 *               - nome
 *     responses:
 *       200:
 *         description: Il PDI è stato aggiornato con successo.
 *       404:
 *         description: Il PDI non è stato trovato
 *       400:
 *         description: Errore di validazione.
 */

router.patch('/:id', authenticateToken, authorizeRole(["operatore","admin"]), async (req, res) => {
    try {
        const  updates = req.body;
        const options = {new: true}
        const pdi = await PDI.findByIdAndUpdate(req.params.id, updates, options);

        if (!pdi) {
            return res.status(404).json({ message: 'Punto di interesse not found' });
        }

        return res.status(200).json(pdi);
    } catch (err) {
        return res.status(400).json({ error: err });
    }

});

/**
 * @swagger
 * /pdi/{id}:
 *   delete:
 *     summary: Rimuove un punto di interesse
 *     tags: [Punti di Interesse]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del punto di interesse (deve essere URL-encoded se contiene caratteri speciali, usare encodeURIComponent)
 *     responses:
 *       200:
 *         description: Percorso cancellato
 *       500:
 *         description: Errore sul server
 *       404:
 *         description: Il percorso selezionato non è presente
 */

router.delete('/:id', authenticateToken, authorizeRole(["operatore","admin"]), async (req, res) => {
    try {
        const pdi = await PDI.findByIdAndDelete(req.params.id);

        if (!pdi) {
            return res.status(404).json({ message: 'Punto di interesse not found' });
        }

        return res.status(200).json(pdi);
    } catch (err) {
        return res.status(500).json({ error: err });
    }

});

module.exports = router;