const express = require('express');
const router = express.Router();
const PDI = require('../models/PDI');

/*

PDIs Routes

*/

/**
 * @swagger
 * /pdi/:
 *   get:
 *     tags: [Punti di Interesse]
 *     summary: Get all the pdi
 *     responses:
 *       200:
 *         description: Lista dei punti di interesse
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
 *                   descrizione:
 *                     type: string
 *                   posizione:
 *                     type: array
 *                     items:
 *                       type: number
 *                   tipoPoi:
 *                     type: string
 */

router.get('/', async (req, res) => {
    const pdis = await PDI.find();
    return res.status(200).json(pdis);
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

router.post('/', async (req, res) => {
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

router.patch('/:id', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
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