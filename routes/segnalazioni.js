const express = require('express');
const router = express.Router();
const Segnalazione = require('../models/Segnalazione');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

/* I permessi dei vari endpoint seguono i principi di separazione dei ruoli e minimo privilegio:
- utente autenticatom può:  creare segnalazioni, visualizzare quelle che ha già creato
- operatore può:            visualizzare tutte le segnalazioni, segnarle come lette, cambiare il loro stato
- admin può:                visualizzare tutte le segnalazioni
Admin ha il ruolo di supervisionare e configurare il sistema, non svolge le funzioni operative
Admin può crearsi il suo utente con ruolo operatore se vuole gestire le segnalazioni
 */

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

//POST crea una nuove segnalazione (solo per utente)
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
router.post('/', authenticateToken, authorizeRole(['utente']), async (req, res) => {
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

//GET ottiene tutte le segnalazioni create dall'utente autenticato (solo per utente)
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
router.get('/mie', authenticateToken, authorizeRole(['utente']), async (req, res) => {
    try {
        //non restituisce il campo lettaDalComune all'utente (utilizzo select per filtrare i campi)
        const segnalazioni = await Segnalazione.find({ utente: req.user.userId }).select('-lettaDalComune');
        res.json(segnalazioni);
    } catch (error) {
        res.status(500).json({ message: 'Errore durante il recupero delle segnalazioni' });
    }
});

//GET ottiene tutte le segnalazioni (solo per operatore e admin)
/**
 * @swagger
 * /segnalazioni:
 *   get:
 *     summary: Ottieni tutte le segnalazioni (solo per operatore Comune e admin)
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
router.get('/', authenticateToken, authorizeRole(['operatore', 'admin']), async (req, res) => {
    try {
        const tutte = await Segnalazione.find().populate('utente', 'nome email');
        res.json(tutte);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero delle segnalazioni' });
    }
});

//PATCH cambia lo stato di una segnalazione (ATTIVA, RISOLTA, SCARTATA) (solo per operatore)
/**
 * @swagger
 * /segnalazioni/{id}/stato:
 *   patch:
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
router.patch('/:id/stato', authenticateToken, authorizeRole(['operatore']), async (req, res) => {
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

//PATCH segna una segnalazione come "letta dal Comune" (solo per operatore)
/**
 * @swagger
 * /segnalazioni/{id}/lettura:
 *   patch:
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
router.patch('/:id/lettura', authenticateToken, authorizeRole(['operatore']), async (req, res) => {
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

//TODO: aggiungere sistema di filtraggio per le segnalazioni (filtri per tipologia, per stato, per lette/non lette)
//TODO: aggiungere endpoint che forniscono statistiche aggregate (numero segnalazioni attive...)
// valutare quali statistiche calcolare a ogni chiamata in real time e quali tenere salvate du database (da aggiornare a ogni modifica delle segnalazioni)