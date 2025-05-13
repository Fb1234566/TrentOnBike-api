const express = require('express');
const router = express.Router();
const User = require('../models/User');
const StatisticheUtente = require('../models/StatisticheUtente');
const ImpostazioniUtente = require('../models/ImpostazioniUtente');
const authenticateToken = require('../middleware/authenticateToken');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Gestione utenti, statistiche e impostazioni
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     UserResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         email:
 *           type: string
 *         nome:
 *           type: string
 *         cognome:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         impostazioni:
 *           $ref: '#/components/schemas/ImpostazioniUtente'
 *         statistiche:
 *           $ref: '#/components/schemas/StatisticheUtente'
 *     ImpostazioniUtente:
 *        type: object
 *        properties:
 *          _id:
 *            type: string
 *          utente:
 *            type: string
 *          lingua:
 *            type: string
 *            enum: [it, en, de]
 *          tema:
 *            type: string
 *            enum: [CHIARO, SCURO, SISTEMA]
 *          notifichePOIVicini:
 *            type: boolean
 *     StatisticheUtente:
 *        type: object
 *        properties:
 *          _id:
 *            type: string
 *          utente:
 *            type: string
 *          kmTotali:
 *            type: number
 *          calorieTotali:
 *            type: number
 *          co2RisparmiatoTotale:
 *            type: number
 *          velocitaMediaGenerale:
 *            type: number
 *          sessioni:
 *            type: array
 *            items:
 *              $ref: '#/components/schemas/SessioneCiclismo'
 *     SessioneCiclismo:
 *        type: object
 *        properties:
 *          _id:
 *            type: string
 *          dataOraInizio:
 *            type: string
 *            format: date-time
 *          dataOraFine:
 *            type: string
 *            format: date-time
 *          distanzaKm:
 *            type: number
 *          velocitaMedia:
 *            type: number
 *          calorieBruciate:
 *            type: number
 *          co2Risparmiato:
 *            type: number
 *
 * security:
 *   - bearerAuth: []
 */

// GET Utente corrente (basato sul token)
/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Ottieni i dettagli dell'utente autenticato
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dettagli dell'utente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: Utente non trovato
 *       500:
 *         description: Errore del server
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select('-passwordHash') 
            .populate('impostazioni') // Popola le impostazioni dell'utente
            .populate({
                path: 'statistiche', // Popola le statistiche dell'utente
                // populate: {
                //     path: 'sessioni.percorsoEffettuato',
                //     model: 'Percorso'
                // }
            });

        if (!user) {
            return res.status(404).json({ message: 'Utente non trovato.' });
        }
        res.json(user);
    } catch (err) {
        console.error("Errore in GET /users/me:", err);
        res.status(500).json({ message: 'Errore nel recuperare l\'utente.', error: err.message });
    }
});
// PUT Aggiorna profilo utente corrente (nome, cognome)
/**
 * @swagger
 * /users/me:
 *   put:
 *     summary: Aggiorna il profilo dell'utente autenticato (nome, cognome)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               cognome:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profilo utente aggiornato
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autorizzato
 */
router.put('/me', authenticateToken, async (req, res) => {
    const { nome, cognome } = req.body;
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "Utente non trovato" });

        if (nome !== undefined) user.nome = nome;
        if (cognome !== undefined) user.cognome = cognome;

        const updatedUser = await user.save();
        const userToReturn = updatedUser.toObject();
        delete userToReturn.passwordHash;
        res.json(userToReturn);
    } catch (err) {
        res.status(400).json({ message: 'Errore nell\'aggiornamento del profilo.', error: err.message });
    }
});


// GET Impostazioni utente corrente
/**
 * @swagger
 * /users/me/impostazioni:
 *   get:
 *     summary: Ottieni le impostazioni dell'utente autenticato
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Impostazioni utente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImpostazioniUtente'
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: Impostazioni non trovate
 */
router.get('/me/impostazioni', authenticateToken, async (req, res) => {
    try {
        const impostazioni = await ImpostazioniUtente.findOne({ utente: req.user.userId });
        if (!impostazioni) {
            return res.status(404).json({ message: 'Impostazioni non trovate per questo utente.' });
        }
        res.json(impostazioni);
    } catch (err) {
        res.status(500).json({ message: 'Errore nel recuperare le impostazioni.', error: err.message });
    }
});

// PUT Aggiorna impostazioni utente corrente
/**
 * @swagger
 * /users/me/impostazioni:
 *   put:
 *     summary: Aggiorna le impostazioni dell'utente autenticato
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lingua:
 *                 type: string
 *                 enum: [it, en, de]
 *               tema:
 *                 type: string
 *                 enum: [CHIARO, SCURO, SISTEMA]
 *               notifichePOIVicini:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Impostazioni aggiornate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImpostazioniUtente'
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autorizzato
 */
router.put('/me/impostazioni', authenticateToken, async (req, res) => {
    const { lingua, tema, notifichePOIVicini } = req.body;
    try {
        const impostazioni = await ImpostazioniUtente.findOneAndUpdate(
            { utente: req.user.userId },
            { $set: { lingua, tema, notifichePOIVicini } },
            { new: true, runValidators: true, upsert: false } // upsert: false per non creare se non esiste
        );
        if (!impostazioni) return res.status(404).json({ message: "Impostazioni utente non trovate."});
        res.json(impostazioni);
    } catch (err) {
        res.status(400).json({ message: 'Errore nell\'aggiornamento delle impostazioni.', error: err.message });
    }
});


// GET Statistiche utente corrente
/**
 * @swagger
 * /users/me/statistiche:
 *   get:
 *     summary: Ottieni le statistiche dell'utente autenticato
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiche utente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatisticheUtente'
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: Statistiche non trovate
 */
router.get('/me/statistiche', authenticateToken, async (req, res) => {
    try {
        const statistiche = await StatisticheUtente.findOne({ utente: req.user.userId })
            .populate('sessioni.percorsoEffettuato'); // Popola se necessario
        if (!statistiche) {
            return res.status(404).json({ message: 'Statistiche non trovate per questo utente.' });
        }
        res.json(statistiche);
    } catch (err) {
        res.status(500).json({ message: 'Errore nel recuperare le statistiche.', error: err.message });
    }
});

// POST Aggiungi una sessione di ciclismo alle statistiche dell'utente corrente
/**
 * @swagger
 * /users/me/statistiche/sessioni:
 *   post:
 *     summary: Aggiunge una nuova sessione di ciclismo alle statistiche dell'utente
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SessioneCiclismo' # Omettere _id e dataOraInizio (può essere default)
 *     responses:
 *       201:
 *         description: Sessione aggiunta e statistiche aggiornate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatisticheUtente'
 *       400:
 *         description: Dati della sessione non validi
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: Statistiche utente non trovate
 */
router.post('/me/statistiche/sessioni', authenticateToken, async (req, res) => {
    const sessioneData = req.body; // Es. { dataOraFine, distanzaKm, ... }
    try {
        const statistiche = await StatisticheUtente.findOne({ utente: req.user.userId });
        if (!statistiche) {
            return res.status(404).json({ message: 'Statistiche non trovate per questo utente.' });
        }

        statistiche.sessioni.push(sessioneData); // Aggiunge la nuova sessione
        statistiche.aggiornaStatisticheGenerali(); // Richiama il metodo per ricalcolare i totali

        await statistiche.save();
        res.status(201).json(statistiche);
    } catch (err) {
        res.status(400).json({ message: 'Errore nell\'aggiungere la sessione.', error: err.message });
    }
});

// La rotta GET /users/ che avevi può rimanere se vuoi una lista pubblica di utenti (senza dati sensibili)
// Oppure la rendi una rotta admin protetta
/**
 * @swagger
 * /users/:
 *   get:
 *     summary: Ottieni tutti gli utenti (solo per admin, esempio)
 *     tags: [Users]
 *     security:
 *      - bearerAuth: [] # Aggiungere un controllo di ruolo qui
 *     responses:
 *       200:
 *         description: Lista degli utenti (dati limitati)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   nome:
 *                     type: string
 *                   email:
 *                     type: string
 */
router.get('/', authenticateToken, async (req, res) => { // Proteggi e magari aggiungi ruolo admin
    // Esempio: controllo ruolo (semplificato)
    // const adminUser = await User.findById(req.user.userId);
    // if (adminUser.tipoUtente !== 'admin') return res.status(403).json({message: "Accesso negato"});

    const users = await User.find().select('_id nome email'); // Seleziona solo alcuni campi
    res.json(users);
});


// La tua rotta POST /users/ originale ora è gestita da /auth/register

module.exports = router;