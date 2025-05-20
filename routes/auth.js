const express = require('express');
const router = express.Router();
const User = require('../models/User');
const StatisticheUtente = require('../models/StatisticheUtente');
const ImpostazioniUtente = require('../models/ImpostazioniUtente');
const jwt = require('jsonwebtoken');

require('dotenv').config(); 

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticazione e registrazione utenti
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registra un nuovo utente
 *     tags: [Auth]
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
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *               nome:
 *                 type: string
 *                 example: Mario
 *               cognome:
 *                 type: string
 *                 example: Rossi
 *     responses:
 *       201:
 *         description: Utente registrato con successo. Restituisce utente e token.
 *       400:
 *         description: Errore di validazione o utente già esistente
 *       500:
 *         description: Errore del server
 */
router.post('/register', async (req, res) => {
    const { email, password, nome, cognome } = req.body;

    if (!email || !password || !nome) {
        return res.status(400).json({ message: 'Email, password e nome sono obbligatori.' });
    }

    try {
        let existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Utente già registrato con questa email.' });
        }

        const newUser = new User({
            email,
            passwordHash: password, // La passwordHash verrà hashata nel pre-save hook
            nome,
            cognome,
            ruolo: 'utente' //forza il ruolo di ogni nuovo registrato a utente. Solo admin può promuovere a 'operatore' tramite endpoint dedicato
        });

        const savedUser = await newUser.save();

        const nuoveStatistiche = new StatisticheUtente({ utente: savedUser._id });
        const savedStatistiche = await nuoveStatistiche.save();

        const nuoveImpostazioni = new ImpostazioniUtente({ utente: savedUser._id });
        const savedImpostazioni = await nuoveImpostazioni.save();

        savedUser.statistiche = savedStatistiche._id;
        savedUser.impostazioni = savedImpostazioni._id;
        await savedUser.save();

        // Genera token JWT
        const payload = { userId: savedUser._id, ruolo: savedUser.ruolo};   //modificato: genera token anche a partire dal ruolo dell'utente
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Rimuovi passwordHash dalla risposta
        const userToReturn = savedUser.toObject();
        delete userToReturn.passwordHash;

        res.status(201).json({ user: userToReturn, token, message: 'Utente registrato con successo' });

    } catch (err) {
        console.error("Errore registrazione:", err);
        if (err.name === 'ValidationError') {
             return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Errore durante la registrazione dell\'utente.', error: err.message });
    }
});


/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Effettua il login di un utente
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login effettuato con successo. Restituisce utente e token.
 *       400:
 *         description: Email o password mancanti
 *       401:
 *         description: Credenziali non valide
 *       500:
 *         description: Errore del server
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email e password sono obbligatorie.' });
    }

    try {
        const user = await User.findOne({ email }).populate('impostazioni').populate('statistiche');
        if (!user) {
            return res.status(401).json({ message: 'Credenziali non valide.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenziali non valide.' });
        }

        // Genera token JWT
        const payload = { userId: user._id, ruolo: user.ruolo};   //modificato: genera token anche a partire dal ruolo dell'utente
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        const userToReturn = user.toObject();
        delete userToReturn.passwordHash;

        res.status(200).json({ user: userToReturn, token, message: 'Login effettuato con successo' });

    } catch (err) {
        console.error("Errore login:", err);
        res.status(500).json({ message: 'Errore durante il login.', error: err.message });
    }
});

// TODO: Implementare /auth/logout (può essere client-side o con blacklist di token)
// TODO: Implementare /auth/reset-password e /auth/request-password-reset

module.exports = router;