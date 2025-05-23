const express = require('express');
const router = express.Router();
const User = require('../models/User');
const StatisticheUtente = require('../models/StatisticheUtente');
const ImpostazioniUtente = require('../models/ImpostazioniUtente');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

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
 *         ruolo:
 *           type: string
 *           enum: ['utente', 'operatore', 'admin']
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
// PATCH Aggiorna profilo utente corrente (nome, cognome)
/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Aggiorna parzialmente il profilo dell'utente autenticato (es. nome, cognome)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Campi da aggiornare. Invia solo i campi che vuoi modificare.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: "Mario Aggiornato"
 *               cognome:
 *                 type: string
 *                 example: "Rossi Nuovo"
 *     responses:
 *       200:
 *         description: Profilo utente aggiornato con successo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         description: Dati non validi o errore nell'aggiornamento
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: Utente non trovato
 */
router.patch('/me', authenticateToken, async (req, res) => {
    const updates = req.body; // Oggetto con i campi da aggiornare
    const allowedUpdates = ['nome', 'cognome']; // Definisci quali campi possono essere aggiornati
    const actualUpdates = {};

    // Filtra solo gli aggiornamenti permessi e forniti
    for (const key in updates) {
        if (allowedUpdates.includes(key) && updates[key] !== undefined) {
            actualUpdates[key] = updates[key];
        }
    }

    if (Object.keys(actualUpdates).length === 0) {
        return res.status(400).json({ message: "Nessun dato valido fornito per l'aggiornamento." });
    }

    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "Utente non trovato" });
        }

        // Applica gli aggiornamenti
        Object.keys(actualUpdates).forEach(key => {
            user[key] = actualUpdates[key];
        });

        const updatedUser = await user.save(); // .save() triggera gli hook di Mongoose se presenti
        const userToReturn = updatedUser.toObject();
        delete userToReturn.passwordHash; // Assicurati di non esporre l'hash

        res.json(userToReturn);
    } catch (err) {
        // Controlla errori di validazione Mongoose
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: 'Errore di validazione.', errors: err.errors });
        }
        console.error("Errore aggiornamento profilo con PATCH:", err);
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
 *         description: Impostazioni non trovate per questo utente
 *       500:
 *         description: Errore nel recuperare le impostazioni
 */
router.get('/me/impostazioni', authenticateToken, async (req, res) => {
    try {
        const impostazioni = await ImpostazioniUtente.findOne({ utente: req.user.userId });
        if (!impostazioni) {
            return res.status(404).json({ message: 'Impostazioni non trovate per questo utente.' });
        }
        res.json(impostazioni);
    } catch (err) {
        console.error("Errore GET /users/me/impostazioni:", err);
        res.status(500).json({ message: 'Errore nel recuperare le impostazioni.', error: err.message });
    }
});

// PATCH Aggiorna impostazioni utente corrente
/**
 * @swagger
 * /users/me/impostazioni:
 *   patch:
 *     summary: Aggiorna parzialmente le impostazioni dell'utente autenticato
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Campi da aggiornare. Invia solo i campi che vuoi modificare.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lingua:
 *                 type: string
 *                 enum: [it, en, de]
 *                 example: "en"
 *               tema:
 *                 type: string
 *                 enum: [CHIARO, SCURO, SISTEMA]
 *                 example: "SCURO"
 *               notifichePOIVicini:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Impostazioni aggiornate con successo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImpostazioniUtente'
 *       400:
 *         description: Dati non validi o errore nell'aggiornamento
 *       401:
 *         description: Non autorizzato
 *       404:
 *         description: Impostazioni utente non trovate
 */
router.patch('/me/impostazioni', authenticateToken, async (req, res) => {
    const updates = req.body;
    const allowedUpdates = ['lingua', 'tema', 'notifichePOIVicini'];
    const updateQuery = {};

    // Costruisci l'oggetto per $set solo con i campi permessi e forniti
    for (const key in updates) {
        if (allowedUpdates.includes(key) && updates[key] !== undefined) {
            updateQuery[key] = updates[key];
        }
    }

    if (Object.keys(updateQuery).length === 0) {
        return res.status(400).json({ message: "Nessun dato valido fornito per l'aggiornamento." });
    }

    try {
        const impostazioni = await ImpostazioniUtente.findOneAndUpdate(
            { utente: req.user.userId },
            { $set: updateQuery }, // Usa l'oggetto updateQuery costruito
            { new: true, runValidators: true, upsert: false }
        );

        if (!impostazioni) {
            return res.status(404).json({ message: "Impostazioni utente non trovate." });
        }
        res.json(impostazioni);
    } catch (err) {
        // Controlla errori di validazione Mongoose (es. enum non valido)
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: 'Errore di validazione.', errors: err.errors });
        }
        console.error("Errore aggiornamento impostazioni con PATCH:", err);
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
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    //Aggiunto controllo ruolo 'admin' tramite authorizeRole

    // Esempio: controllo ruolo (semplificato)
    // const adminUser = await User.findById(req.user.userId);
    // if (adminUser.ruolo !== 'admin') return res.status(403).json({message: "Accesso negato"});

    const users = await User.find().select('_id nome email'); // Seleziona solo alcuni campi
    res.json(users);
});

//PATCH promuove il ruolo di un utente a 'operator' (solo per admin)
/**
 * @swagger
 * /users/{id}/promuovi:
 *   patch:
 *     summary: Promuove un utente esistente al ruolo di 'operatore'
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dell'utente da promuovere
 *     responses:
 *       200:
 *         description: Utente promosso correttamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       401:
 *         description: Non autorizzato
 *       403:
 *         description: Accesso negato
 *       404:
 *         description: Utente non trovato
 */
router.patch('/:id/promuovi', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'Utente non trovato' });

        user.ruolo = 'operatore';
        await user.save();

        const userResponse = user.toObject();
        delete userResponse.passwordHash;

        res.json(userResponse);
    } catch (err) {
        res.status(500).json({ message: 'Errore durante la promozione utente', error: err.message });
    }
});

//POST registra nuovo utente con ruolo 'operatore' (solo per admin)
/**
 * @swagger
 * /users/register-operator:
 *   post:
 *     summary: Registra un nuovo operatore (solo admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - nome
 *               - cognome
 *             properties:
 *               email:
 *                 type: string
 *                 example: operatore@comune.it
 *               password:
 *                 type: string
 *                 example: sicura123
 *               nome:
 *                 type: string
 *                 example: Mario
 *               cognome:
 *                 type: string
 *                 example: Rossi
 *     responses:
 *       201:
 *         description: Operatore registrato con successo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         description: Dati non validi
 *       403:
 *         description: Accesso negato (non admin)
 *       500:
 *         description: Errore del server
 */
router.post('/register-operator', authenticateToken, authorizeRole(['admin']), async (req, res) => {
        const { email, password, nome, cognome } = req.body;

        if (!email || !password || !nome) {
            return res.status(400).json({ message: 'Email, password e nome sono obbligatori.' });
        }

        try {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'Email già in uso.' });
            }

            const newUser = new User({
                email,
                passwordHash: password,
                nome,
                cognome,
                ruolo: 'operatore',
            });

            await newUser.save();

            const userResponse = newUser.toObject();
            delete userResponse.passwordHash;

            res.status(201).json(userResponse);
        } catch (err) {
            console.error('Errore nella registrazione operatore:', err);
            if (err.name === 'ValidationError') {
                return res.status(400).json({ message: err.message });
            }
            res.status(500).json({ message: 'Errore nel registrare l’operatore.', error: err.message });
        }
    }
);



// La tua rotta POST /users/ originale ora è gestita da /auth/register

module.exports = router;