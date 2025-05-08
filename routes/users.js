const express = require('express');
const router = express.Router();
const User = require('../models/User');

/*

Users Routes

*/

/**
 * @swagger
 * /users/:
 *   get:
 *     summary: Ottieni tutti gli utenti
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Lista degli utenti
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 */
router.get('/', async (req, res) => {
    const users = await User.find();
    res.json(users);
});


/**
 * @swagger
 * /users/:
 *   post:
 *     summary: Crea un nuovo utente
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 example: Alice
 *               email:
 *                 type: string
 *                 example: alice@example.com
 *     responses:
 *       201:
 *         description: Utente creato
 *       400:
 *         description: Errore di validazione
 */
router.post('/', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;








