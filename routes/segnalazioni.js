const express = require('express');
const router = express.Router();
const Segnalazione = require('../models/Segnalazione');
const authenticateToken = require('../middleware/authenticateToken');

/**
 * @swagger
 * tags:
 *   name: Segnalazioni
 *   description: Gestione delle segnalazioni da parte degli utenti e del comune
 *
 * components:
 *   schemas:
 *     Posizione:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [Point]
 *           default: Point
 *         coordinates:
 *           type: array
 *           items:
 *             type: number
 *           description: Coordinate [longitudine, latitudine]
 *
 *     Segnalazione:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         utente:
 *           type: string
 *         categoria:
 *           type: string
 *         descrizione:
 *           type: string
 *         posizione:
 *           $ref: '#/components/schemas/Posizione'
 *         stato:
 *           type: string
 *           enum: [ATTIVA, RISOLTA, SCARTATA]
 *         lettaDalComune:
 *           type: boolean
 *         creataIl:
 *           type: string
 *           format: date-time
 *         ultimaModificataIl:
 *           type: string
 *           format: date-time
 *
 * securitySchemes:
 *   bearerAuth:
 *     type: http
 *     scheme: bearer
 *     bearerFormat: JWT
 */

/**
 * @swagger
 * /segnalazioni:
 *   post:
 *     summary: Crea una nuova segnalazione
 *     tags: [Segnalazioni]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoria, descrizione, posizione]
 *             properties:
 *               categoria:
 *                 type: string
 *               descrizione:
 *                 type: string
 *               posizione:
 *                 $ref: '#/components/schemas/Posizione'
 *     responses:
 *       201:
 *         description: Segnalazione creata con successo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Segnalazione'
 *       400:
 *         description: Dati mancanti o non validi
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { categoria, descrizione, posizione } = req.body;

        if (!categoria || !descrizione || !posizione?.coordinates) {
            return res.status(400).json({ message: 'Dati mancanti o incompleti.' });
        }

        const nuovaSegnalazione = new Segnalazione({
            utente: req.user.userId,
            categoria,
            descrizione,
            posizione
        });

        await nuovaSegnalazione.save();
        res.status(201).json(nuovaSegnalazione);
    } catch (error) {
        res.status(500).json({ message: 'Errore durante la creazione della segnalazione', error: error.message });
    }
});

/**
 * @swagger
 * /segnalazioni/mie:
 *   get:
 *     summary: Ottieni tutte le segnalazioni dell'utente autenticato
 *     tags: [Segnalazioni]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista delle segnalazioni dell'utente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Segnalazione'
 */
router.get('/mie', authenticateToken, async (req, res) => {
    try {
        //non restituisce il campo lettaDalComune all'utente (utilizzo select per filtrare i campi)
        const segnalazioni = await Segnalazione.find({ utente: req.user.userId }).select('-lettaDalComune');
        res.json(segnalazioni);
    } catch (error) {
        res.status(500).json({ message: 'Errore durante il recupero delle segnalazioni' });
    }
});

/**
 * @swagger
 * /segnalazioni:
 *   get:
 *     summary: Ottieni tutte le segnalazioni (solo per Comune)
 *     tags: [Segnalazioni]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista di tutte le segnalazioni
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Segnalazione'
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const tutte = await Segnalazione.find().populate('utente', 'nome email');
        res.json(tutte);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero delle segnalazioni' });
    }
});

/**
 * @swagger
 * /segnalazioni/{id}/stato:
 *   put:
 *     summary: Aggiorna lo stato di una segnalazione
 *     tags: [Segnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stato]
 *             properties:
 *               stato:
 *                 type: string
 *                 enum: [ATTIVA, LETTA, RISOLTA, SCARTATA]
 *     responses:
 *       200:
 *         description: Stato aggiornato con successo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Segnalazione'
 *       400:
 *         description: Stato non valido
 *       404:
 *         description: Segnalazione non trovata
 */
router.put('/:id/stato', authenticateToken, async (req, res) => {
    const { stato } = req.body;
    const statiValidi = ['ATTIVA', 'RISOLTA', 'SCARTATA'];

    if (!statiValidi.includes(stato)) {
        return res.status(400).json({ message: 'Stato non valido' });
    }

    try {
        const aggiornata = await Segnalazione.findByIdAndUpdate(
            req.params.id,
            {
                stato,
                ultimaModificataIl: Date.now()
            },
            { new: true }
        );

        if (!aggiornata) {
            return res.status(404).json({ message: 'Segnalazione non trovata' });
        }

        res.json(aggiornata);
    } catch (error) {
        res.status(500).json({ message: 'Errore durante l\'aggiornamento della segnalazione' });
    }
});

/**
 * @swagger
 * /segnalazioni/{id}/lettura:
 *   put:
 *     summary: Segna una segnalazione come letta dal Comune
 *     tags: [Segnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Segnalazione marcata come letta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Segnalazione'
 *       404:
 *         description: Segnalazione non trovata
 */
router.put('/:id/lettura', authenticateToken, async (req, res) => {
    try {
        const segnalazione = await Segnalazione.findById(req.params.id);
        if (!segnalazione) {
            return res.status(404).json({ message: 'Segnalazione non trovata' });
        }

        segnalazione.lettaDalComune = true;

        await segnalazione.save();
        res.json({ message: 'Segnalazione marcata come letta', segnalazione });
    } catch (err) {
        res.status(500).json({ message: 'Errore nel marcare come letta', error: err.message });
    }
});

module.exports = router;

//TODO: aggiungere controllo ruoli per operazioni di PUT e GET segnalazioni/tutte (ristrette a admin e Comune)
//TODO: aggiungere sistema di filtraggio per le segnalazioni (filtri per tipologia, per stato, per lette/non lette)
//TODO: aggiungere endpoint che forniscono statistiche aggregate (numero segnalazioni attive...)
// valutare quali statistiche calcolarle a ogni chiamata in real time e quali tenere salvate du database (da aggiornare a ogni modifica delle segnalazioni)