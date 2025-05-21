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


/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Effettua il logout dell'utente (principalmente client-side)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: [] 
 *     responses:
 *       200:
 *         description: Logout signalato. Il client deve eliminare il token.
 *       401:
 *         description: Non autorizzato
 */
router.post('/logout', (req, res) => {
    // Per un logout stateless con JWT, la responsabilità principale è del client
    // che deve distruggere/eliminare il token memorizzato.
    res.status(200).json({ message: 'Logout effettuato con successo. Il client deve eliminare il token.' });
});



/**
 * @swagger
 * /auth/request-password-reset:
 *   post:
 *     summary: Invia una richiesta per resettare la password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Se l'utente esiste, un'email di reset (simulata) è stata inviata.
 *       404:
 *         description: Utente non trovato con questa email.
 *       500:
 *         description: Errore del server.
 */
router.post('/request-password-reset', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email è obbligatoria.' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Utente non trovato con questa email.' });
        }

        // Genera un token di reset
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex'); // Salva l'hash del token
        user.resetPasswordExpires = Date.now() + 3600000; // Token valido per 1 ora

        await user.save();

        // Simula l'invio dell'email con il link di reset
        const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/reset-password/${resetToken}`;
        console.log('----------------------------------------------------------------------');
        console.log('SIMULAZIONE INVIO EMAIL PER RESET PASSWORD');
        console.log(`Per resettare la password per ${user.email}, visita questo link:`);
        console.log(resetUrl);
        console.log('Il token di reset (da includere nell\'URL sopra) è:', resetToken);
        console.log('Questo token scadrà tra 1 ora.');
        console.log('----------------------------------------------------------------------');

        res.status(200).json({ message: 'Se l\'utente esiste, un link per il reset della password è stato inviato (controlla la console del server per la simulazione).' });

    } catch (err) {
        console.error("Errore richiesta reset password:", err);
        res.status(500).json({ message: 'Errore durante la richiesta di reset password.', error: err.message });
    }
});


/**
 * @swagger
 * /auth/reset-password/{token}:
 *   post:
 *     summary: Resetta la password usando un token di reset
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Il token di reset password ricevuto via email (simulata).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6 # Aggiungi validazioni se necessario
 *     responses:
 *       200:
 *         description: Password resettata con successo.
 *       400:
 *         description: Token non valido, scaduto, o password mancante/non valida.
 *       500:
 *         description: Errore del server.
 */
router.post('/reset-password/:token', async (req, res) => {
    const { password } = req.body;
    const resetTokenFromParams = req.params.token;

    if (!password) {
        return res.status(400).json({ message: 'La nuova password è obbligatoria.' });
    }
    if (!resetTokenFromParams) {
        return res.status(400).json({ message: 'Token di reset mancante.' });
    }

    try {
        // Hasha il token ricevuto dai parametri per confrontarlo con quello nel DB
        const hashedToken = crypto.createHash('sha256').update(resetTokenFromParams).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() } // Controlla che il token non sia scaduto
        });

        if (!user) {
            return res.status(400).json({ message: 'Token di reset password non valido o scaduto.' });
        }

        // Imposta la nuova password (l'hook pre-save la hasherà)
        user.passwordHash = password;
        user.resetPasswordToken = undefined; // Invalida il token
        user.resetPasswordExpires = undefined; // Invalida la scadenza

        await user.save();
        res.status(200).json({ message: 'Password resettata con successo. Ora puoi effettuare il login con la nuova password.' });

    } catch (err) {
        console.error("Errore reset password:", err);
        res.status(500).json({ message: 'Errore durante il reset della password.', error: err.message });
    }
});


module.exports = router;