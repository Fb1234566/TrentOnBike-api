const express = require('express');
const router = express.Router();
const { Percorso, Tappa } = require('../models/Percorso');
const PDI = require('../models/PDI');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

/*

Percorsi Routes

*/
/**
 * @swagger
 * tags:
 *   name: Punti di Interesse
 *   description: Gestione dei Punti Di Interesse
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Percorso:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         nome:
 *           type: string
 *         descrizione:
 *           type: string
 *         lunghezza:
 *           type: string
 *         difficolta:
 *           type: string
 *           format: date-time
 *         tappe:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Tappa'
 *         tipo:
 *           type: string
 *           enum: [TURISTICO, SUGGERITO_COMUNE, UTENTE]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     Tappa:
 *        type: object
 *        properties:
 *          _id:
 *            type: string
 *          ordine:
 *            type: integer
 *          descrizione:
 *            type: string
 *          posizione:
 *            type: array
 *            items:
 *              type: number
 *          puntoDiInteresse:
 *            type: boolean
 *          createdAt:
 *            type: string
 *            format: date-time
 *          updatedAt:
 *            type: string
 *            format: date-time
 *
 * security:
 *   - bearerAuth: []
 */

/**
 * @swagger
 * /percorsi/:
 *  get:
 *      tags: [Percorsi]
 *      description: Ottiene tutti i percorsi
 *      responses:
 *         200:
 *           description: Lista dei percorsi
 */
router.get('/', authenticateToken, async (req, res) => {
    const users = await Percorso.find();
    res.json(users);
});

/**
 * @swagger
 * /percorsi/:
 *   post:
 *     summary: Crea un nuovo percorso
 *     tags: [Percorsi]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - descrizione
 *             properties:
 *               nome:
 *                 type: string
 *                 example: Castello Buon Consiglio
 *               descrizione:
 *                 type: string
 *                 example: Il percorso termina al castello del buon consiglio
 *     responses:
 *       201:
 *         description: Percorso creato
 *       400:
 *         description: Errore di validazione
 */
router.post('/', authenticateToken, authorizeRole(['operatore', 'admin']), async(req, res) => {
    try {
        const percorso = new Percorso(req.body);
        percorso.created_by = req.user.userId;
        await percorso.save();
        res.status(201).json(percorso);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /percorsi/{id}:
 *   get:
 *     summary: Ottiene i dettagli di un percorso
 *     tags: [Percorsi]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del percorso (deve essere URL-encoded se contiene caratteri speciali, usare encodeURIComponent)
 *     responses:
 *       200:
 *         description: Percorso ottenuto con successo
 *       500:
 *         description: Errore del server
 *       404:
 *         description: Il percorso selezionato non è presente
 */

router.get('/:id', authenticateToken, async (req, res) => {
    try{
        const percorso = await Percorso.findById(req.params.id)
            .populate('createdBy')
            .populate({
                path: 'tappe',
                populate: {
                    path: 'puntoDiInteresse'
                }
            });

/*            .populate({
            path: 'tappe'
        })*/
        if (!percorso) {
            return res.status(404).json({ error: 'Percorso not found' });
        }
        return res.status(200).json(percorso);
    }catch(err){
        return res.status(400).json({ error: err.message });
    }
})

/**
 * @swagger
 * /percorsi/{id}:
 *   patch:
 *     summary: Aggiorna le proprietà di un percorso
 *     tags: [Percorsi]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del percorso (deve essere URL-encoded se contiene caratteri speciali, usare encodeURIComponent)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: "Muse"
 *               descrizione:
 *                 type: string
 *                 example: "Il percorso termina al Muse"
 *     responses:
 *       201:
 *         description: Percorso creato
 *       400:
 *         description: Errore di validazione
 *       404:
 *         description: Il percorso selezionato non è presente
 */

router.patch("/:id", authenticateToken, authorizeRole(['operatore', 'admin']), async(req, res) => {
    try {
        const updates = req.body;
        const options = { new: true }; // return the updated document
        const percorso = await Percorso.findByIdAndUpdate(req.params.id, updates, options);

        if (!percorso) {
            return res.status(404).json({ error: 'Percorso not found' });
        }

        return res.status(200).json(percorso);
    } catch (err) {
        return res.status(400).json({error: err.message});
    }
})

/**
 * @swagger
 * /percorsi/{id}/tappa:
 *   post:
 *     summary: Aggiunge una tappa a un percorso
 *     tags: [Percorsi]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del percorso (deve essere URL-encoded se contiene caratteri speciali, usare encodeURIComponent)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ordine:
 *                 type: integer
 *                 example: 0
 *               descrizione:
 *                 type: string
 *                 example: "Muse"
 *               posizione:
 *                  type: array
 *                  items:
 *                      type: number
 *                      format: float
 *                  example: [1234.1234, 1234.1234]
 *     responses:
 *       201:
 *         description: Tappa aggiunta
 *       400:
 *         description: Errore di validazione
 *       404:
 *         description: Il percorso selezionato non è presente
 */
router.post("/:id/tappa", authenticateToken, authorizeRole(['operatore', 'admin']), async(req, res) => {
    try{
        const tappa = new Tappa(req.body);
        const percorso = await Percorso.findById(req.params.id);
        if (!percorso) {
            return res.status(404).json({ error: 'Percorso not found' });
        }

        if (tappa.posizione.length !== 2) {
            return res.status(400).json({ error: 'Posizione deve essere un array di due numeri (lng, lat)' });
        }

        // Verifica che il punto di interesse esista
        const pdi = await PDI.findById(req.body.puntoDiInteresse);
        if (!pdi) {
            return res.status(400).json({ error: 'Punto di interesse non trovato' });
        }

        await tappa.save();
        await percorso.addTappa(tappa);
        return res.status(201).json(percorso);
    } catch(err){
        return res.status(400).json({ error: err.message });
    }
});

/**
 * @swagger
 * /percorsi/{id}:
 *   delete:
 *     summary: Rimuove un percorso
 *     tags: [Percorsi]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del percorso (deve essere URL-encoded se contiene caratteri speciali, usare encodeURIComponent)
 *     responses:
 *       200:
 *         description: Percorso cancellato
 *       500:
 *         description: Errore sul server
 *       404:
 *         description: Il percorso selezionato non è presente
 */
router.delete("/:id", authenticateToken, authorizeRole(['operatore', 'admin']), async(req, res) => {
    try{
        const percorso = await Percorso.findByIdAndDelete(req.params.id)
         if (!percorso) {
             return res.status(404).json({ error: 'Percorso not found' });
         }
         return res.status(200).json(percorso);
    }catch(err){
        return res.status(500).json({ error: err.message });
    }
})

/**
 * @swagger
 * /percorsi/{percorsoId}/tappe/{tappaId}:
 *   delete:
 *     summary: Rimuove una tappa
 *     tags: [Percorsi]
 *     parameters:
 *       - in: path
 *         name: percorsoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del percorso (deve essere URL-encoded se contiene caratteri speciali, usare encodeURIComponent)
 *       - in: path
 *         name: tappaId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID della tappa (deve essere URL-encoded se contiene caratteri speciali, usare encodeURIComponent)
 *     responses:
 *       200:
 *         description: Percorso cancellato
 *       500:
 *         description: Errore sul server
 *       404:
 *         description: Il percorso selezionato non è presente
 */
router.delete("/:percorsoId/tappe/:tappaId", authenticateToken, authorizeRole(['operatore', 'admin']), async(req, res) => {
    try{
        const percorso = await Percorso.findById(req.params.percorsoId)
        if (!percorso) {
            return res.status(404).json({ error: 'Percorso not found' });
        }

        // Trova l'indice della tappa
        const tappaIndex = percorso.tappe.findIndex(
            tappa => tappa._id.toString() === req.params.tappaId
        );

        if (tappaIndex === -1) {
            return res.status(404).json({ message: 'Tappa not found in this percorso' });
        }

        percorso.tappe.splice(tappaIndex, 1)

        await percorso.save();

        return res.status(200).json(percorso);
    }catch(err){
        return res.status(500).json({ error: err.message });
    }
})

/**
 * @swagger
 * /percorsi/{percorsoId}/tappe/{tappaId}:
 *   patch:
 *     summary: Aggiorna le proprietà di un percorso
 *     tags: [Percorsi]
 *     parameters:
 *       - in: path
 *         name: percorsoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del percorso (deve essere URL-encoded se contiene caratteri speciali, usare encodeURIComponent)
 *       - in: path
 *         name: tappaId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID della tappa (deve essere URL-encoded se contiene caratteri speciali, usare encodeURIComponent)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 example: "Il percorso termina al Muse"
 *     responses:
 *       201:
 *         description: Percorso creato
 *       400:
 *         description: Errore di validazione
 *       404:
 *         description: Il percorso selezionato non è presente
 */

router.patch("/:percorsoId/tappe/:tappaId", authenticateToken, authorizeRole(['operatore', 'admin']), async(req, res) => {
    try {
        const updates = req.body;
        const options = { new: true, runValidators: true }; // return the updated document
        const percorso = await Percorso.findOne({
            _id: req.params.percorsoId,
            tappe: req.params.tappaId
        });

        if (!percorso) {
            return res.status(404).json({ error: 'Percorso not found or does not contain this tappa' });
        }

        const updatedTappa = await Tappa.findByIdAndUpdate(
            req.params.tappaId,
            updates,
            options
        );

        const t = await Tappa.findById(req.params.tappaId)
        console.log(t)

        if (!updatedTappa) {
            return res.status(404).json({ message: 'Tappa not found' });
        }

        res.status(200).json({
            updatedTappa
        });

        return res.json(percorso);
    } catch (err) {
        return res.status(400).json({error: err.message});
    }
})


module.exports = router;