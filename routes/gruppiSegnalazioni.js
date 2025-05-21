const express = require('express');
const router = express.Router();
const GruppoSegnalazioni = require('../models/GruppoSegnalazioni');
const Segnalazione = require('../models/Segnalazione');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

/**
 * @swagger
 * tags:
 *   - name: GruppiSegnalazioni
 *     description: Endpoint per la gestione dei gruppi di segnalazioni
 * components:
 *   schemas:
 *     GruppoSegnalazioni:
 *       type: object
 *       properties:
 *         nome:
 *           type: string
 *           description: Nome del gruppo di segnalazioni.
 *           example: "Problema Stradale in Via Roma"
 *         posizione:
 *           type: object
 *           description: Posizione del gruppo di segnalazioni.
 *           properties:
 *             latitudine:
 *               type: number
 *               description: La latitudine della posizione.
 *               example: 40.748817
 *             longitudine:
 *               type: number
 *               description: La longitudine della posizione.
 *               example: -73.985428
 *         creatoDa:
 *           type: string
 *           format: ObjectId
 *           description: ID dell'utente che ha creato il gruppo di segnalazioni.
 *           example: "605b2f5b4af5f3cbbf8a2c19"
 *         creatoIl:
 *           type: string
 *           format: date-time
 *           description: Data di creazione del gruppo di segnalazioni.
 *           example: "2025-05-20T08:30:00Z"
 *         ultimaModificaIl:
 *           type: string
 *           format: date-time
 *           description: Data dell'ultima modifica del gruppo di segnalazioni.
 *           example: "2025-05-20T09:00:00Z"
 *         numeroSegnalazioni:
 *           type: integer
 *           description: Numero di segnalazioni all'interno del gruppo.
 *           example: 10
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - BearerAuth: []
 */

//POST crea un nuovo gruppo di segnalazioni e le associa se i loro stati sono compatibili
    //Note: è permesso fare gruppi di segnalazioni solo se hanno tutte lo stesso stato, oppure se i loro stati sono un misto di ATTIVE e DA_VERIFICARE
    //Infatti se le segnalazioni rappresentano lo stesso problema e almeno una di esse è stata verificata ed è ATTIVA
    //allora anche tutte le altre (solo se sono DA_VERIFICARE o ATTIVE a loro volta) potranno fare parte del gruppo ed essere "attivate" (stato: 'ATTIVA')
/**
 * @swagger
 * /gruppiSegnalazioni:
 *   post:
 *     summary: Crea un nuovo gruppo di segnalazioni e associa le segnalazioni selezionate
 *     tags: [GruppiSegnalazioni]
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
 *                 description: Nome del gruppo di segnalazioni (opzionale)
 *                 example: "Problema all'incrocio X"
 *               segnalazioni:
 *                 type: array
 *                 items:
 *                   type: string
 *                   description: ID della segnalazione da associare al gruppo
 *                   example: "60d21b4967d0d8992e610c85"
 *     responses:
 *       201:
 *         description: Gruppo di segnalazioni creato con successo e segnalazioni associate
 *       400:
 *         description: Dati di input non validi o stato delle segnalazioni non valido
 *       401:
 *         description: Utente non autorizzato
 *       500:
 *         description: Errore interno del server
 */
router.post('/', authenticateToken, authorizeRole(['operatore']), async (req, res) => {
    const { nome, segnalazioni } = req.body;

    if (!segnalazioni || segnalazioni.length === 0) {
        return res.status(400).json({ message: 'Devono essere forniti almeno una segnalazione' });
    }

    try {
        // Recupera le segnalazioni fornite
        const segnalazioniFound = await Segnalazione.find({ '_id': { $in: segnalazioni } });

        // controlla che tutte segnalazioni fornite siano presenti ed esistenti nel database
        if (segnalazioniFound.length !== segnalazioni.length) {
            return res.status(400).json({ message: 'Almeno una segnalazione non esiste' });
        }

        // Crea un set contenente tutti gli stati delle segnalazioni fornite
        const stati = [...new Set(segnalazioniFound.map(s => s.stato))];

        // Crea una variabile che indica se lo stato delle segnalazioni è da cambiare (caso segnalazioni DA_VERIFICARE miste ad ATTIVE e stato da cambiare ad ATTIVA)
        let cambiaStato = false;

        if (stati.length > 1) {
            // Se ci sono stati diversi, controlla che siano tutti DA_VERIFICARE o ATTIVE
            if (!stati.every(stato => ['DA_VERIFICARE', 'ATTIVA'].includes(stato))) {
                return res.status(400).json({ message: 'Le segnalazioni devono essere tutte nello stesso stato, oppure un misto tra DA_VERIFICARE e ATTIVE' });
            }
            cambiaStato = true;
        }

        // Calcola la posizione media
        const posizioni = segnalazioniFound.map(s => s.posizione);
        const latitudine = posizioni.reduce((acc, pos) => acc + pos.lat, 0) / posizioni.length;
        const longitudine = posizioni.reduce((acc, pos) => acc + pos.lon, 0) / posizioni.length;

        const posizioneMedia = {
            type: 'Point',
            coordinates: [longitudine, latitudine]
        };

        // Controllo nome ed eventuale generazione automatica
        let nomeGruppo;
        if (nome) {
            const gruppoEsistente = await GruppoSegnalazioni.findOne({nome: nome});
            if (gruppoEsistente) {
                //Se esiste già ritorna errore
                return res.status(400).json({message: 'Esiste già un gruppo con questo nome'});
            }else{
                //Se il nome è valido diventa il nome del nuovo gruppo
                nomeGruppo = nome;
            }
        }else{
            // Se il nome non è fornito, è generalo automaticamente (categoria_coordinate_dataSegnalazione_dataAttuale)
            const primaSegnalazione = segnalazioniFound[0];
            nomeGruppo = `${primaSegnalazione.categoria}_${longitudine.toFixed(4)}_${latitudine.toFixed(4)}_${new Date(primaSegnalazione.creataIl).toISOString().slice(0, 10)}_${Date.now()}`;
        }

        // Crea il gruppo
        const nuovoGruppo = new GruppoSegnalazioni({
            nome: nomeGruppo,
            posizione: posizioneMedia,
            creatoDa: req.user._id,
            numeroSegnalazioni: segnalazioni.length
        });

        // Salva il nuovo gruppo
        await nuovoGruppo.save();

        // Collega le segnalazioni fornite al gruppo (aggiorna il campo gruppoSegnalazioni)
        const updateFields = {
            gruppoSegnalazioni: nuovoGruppo._id,
            ultimaModificaIl: new Date()
        };
        // caso in cui bisogna anche cambiare lo stato delle segnalazioni (unico possibile: da DA_VERIFICARE ad ATTIVE)
        if (cambiaStato) {
            updateFields.stato = 'ATTIVA';
        }
        await Segnalazione.updateMany(
            { _id: { $in: segnalazioni } },
            { $set: updateFields }
        );

        res.status(201).json({ message: 'Gruppo di segnalazioni creato con successo', gruppo: nuovoGruppo });
    } catch (error) {
            console.error('Errore durante la creazione del gruppo di segnalazioni:', error);
            res.status(500).json({ message: 'Errore durante la creazione del gruppo', error: error.message });
        }
    });

// GET restituisce tutti i gruppi di segnalazioni (senza le segnalazioni associate) (solo operatore e admin) - disponibili filtri, ordinamento e limitazione
/**
 * @swagger
 * /gruppiSegnalazioni:
 *   get:
 *     summary: Restituisce l'elenco dei gruppi di segnalazioni con possibilità di filtro, ordinamento e limitazione
 *     tags: [GruppiSegnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: daData
 *         in: query
 *         description: Data di inizio per il filtro del range di creazione (formato ISO)
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: aData
 *         in: query
 *         description: Data di fine per il filtro del range di creazione (formato ISO)
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: numero
 *         in: query
 *         description: Filtra per gruppi con esattamente questo numero di segnalazioni
 *         required: false
 *         schema:
 *           type: integer
 *       - name: minNumero
 *         in: query
 *         description: Filtra per gruppi con almeno questo numero di segnalazioni
 *         required: false
 *         schema:
 *           type: integer
 *       - name: maxNumero
 *         in: query
 *         description: Filtra per gruppi con al massimo questo numero di segnalazioni
 *         required: false
 *         schema:
 *           type: integer
 *       - name: via
 *         in: query
 *         description: Filtra per gruppi che si trovano in una determinata via esatta
 *         required: false
 *         schema:
 *           type: string
 *       - name: lat
 *         in: query
 *         description: Latitudine per il filtro geospaziale
 *         required: false
 *         schema:
 *           type: number
 *       - name: lng
 *         in: query
 *         description: Longitudine per il filtro geospaziale
 *         required: false
 *         schema:
 *           type: number
 *       - name: raggio
 *         in: query
 *         description: Raggio in metri entro cui cercare gruppi dalla posizione indicata (default 1000 metri)
 *         required: false
 *         schema:
 *           type: integer
 *       - name: ordine
 *         in: query
 *         description: Campo su cui ordinare i risultati (es. creatoIl, ultimaModificaIl, numeroSegnalazioni, ecc.)
 *         required: false
 *         schema:
 *           type: string
 *       - name: direction
 *         in: query
 *         description: Direzione dell'ordinamento (ascendente o discendente)
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - name: limit
 *         in: query
 *         description: Numero massimo di gruppi da restituire
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista dei gruppi di segnalazioni
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GruppoSegnalazioni'
 *       400:
 *         description: Parametri non validi
 *       401:
 *         description: Utente non autorizzato
 *       500:
 *         description: Errore interno del server
 */
router.get('/', authenticateToken, authorizeRole(['operatore', 'admin']), async (req, res) => {
    try {
        let query = {};

        // Filtro per data di creazione (range)
        if (req.query.daData || req.query.aData) {
            const daData = req.query.daData ? new Date(req.query.daData) : null;
            const aData = req.query.aData ? new Date(req.query.aData) : null;

            if (daData || aData) {
                query.creatoIl = {};
                if (daData) query.creatoIl.$gte = daData;
                if (aData) query.creatoIl.$lte = aData;
            }
        }

        // Filtro per numero di segnalazioni
        if (req.query.numero) {
            const numero = parseInt(req.query.numero);
            if (isNaN(numero)) return res.status(400).json({ message: 'Parametro numero non valido' });
            query.numeroSegnalazioni = numero;
        } else {
            const min = req.query.minNumero ? parseInt(req.query.minNumero) : null;
            const max = req.query.maxNumero ? parseInt(req.query.maxNumero) : null;

            if ((req.query.minNumero !== undefined && isNaN(min)) || (req.query.maxNumero !== undefined && isNaN(max))) {
                return res.status(400).json({ message: 'Parametro minNumero o maxNumero non valido' });
            }

            if (min !== null || max !== null) {
                query.numeroSegnalazioni = {};
                if (min !== null) query.numeroSegnalazioni.$gte = min;
                if (max !== null) query.numeroSegnalazioni.$lte = max;
            }
        }

        // Filtro per posizione
        if (req.query.via) {
            query['posizione.via'] = req.query.via;
        } else if (req.query.lat && req.query.lng) {
            const lat = parseFloat(req.query.lat);
            const lng = parseFloat(req.query.lng);
            const raggio = parseInt(req.query.raggio) || 1000;

            if (isNaN(lat) || isNaN(lng)) {
                return res.status(400).json({ message: 'Latitudine o longitudine non valide' });
            }

            query.posizione = {
                $geoWithin: {
                    $centerSphere: [[lng, lat], raggio / 6378137] // raggio terrestre in metri
                }
            };
        }

        // Ordinamento
        let sort = {};
        if (req.query.ordine) {
            sort[req.query.ordine] = req.query.direction === 'asc' ? 1 : -1;
        } else {
            // Default: ultima modifica più recente
            sort['ultimaModificaIl'] = -1;
        }

        // Limitazione
        let limit = parseInt(req.query.limit);
        if (isNaN(limit) || limit < 1) {
            return res.status(400).json({ message: 'Parametro limit non valido' });
        }

        // Query finale
        const gruppi = await GruppoSegnalazioni
            .find(query)
            .sort(sort)
            .limit(limit);

        res.status(200).json(gruppi);
    } catch (error) {
        console.error('Errore nel recupero dei gruppi di segnalazioni:', error);
        res.status(500).json({ message: 'Errore interno durante il recupero dei gruppi', error: error.message });
    }
});

// GET restituisce i dettagli di un gruppo di segnalazioni (senza includere le segnalazioni associate) (per operatore e admin)
/**
 * @swagger
 * /gruppiSegnalazioni/{id}:
 *   get:
 *     summary: Restituisce i dettagli di un gruppo di segnalazioni (senza le segnalazioni associate)
 *     tags: [GruppiSegnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID del gruppo di segnalazioni da recuperare
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dati del gruppo di segnalazioni
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GruppoSegnalazioni'
 *       401:
 *         description: Utente non autorizzato
 *       404:
 *         description: Gruppo non trovato
 *       500:
 *         description: Errore interno del server
 */
router.get('/:id', authenticateToken, authorizeRole(['operatore', 'admin']), async (req, res) => {
    const gruppoId = req.params.id;

    try {
        const gruppo = await GruppoSegnalazioni.findById(gruppoId);
        if (!gruppo) {
            return res.status(404).json({ message: 'Gruppo non trovato' });
        }

        res.status(200).json(gruppo);
    } catch (error) {
        console.error('Errore durante il recupero del gruppo:', error);
        res.status(500).json({ message: 'Errore durante il recupero del gruppo', error: error.message });
    }
});

// PATCH modifica il nome di un gruppo di segnalazioni
/**
 * @swagger
 * /gruppiSegnalazioni/{id}/nome:
 *   patch:
 *     summary: Modifica il nome di un gruppo di segnalazioni
 *     tags: [GruppiSegnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID del gruppo di segnalazioni da modificare
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 description: Nuovo nome del gruppo di segnalazioni
 *                 example: "Problema Incrocio Y"
 *     responses:
 *       200:
 *         description: Nome del gruppo modificato con successo
 *       400:
 *         description: Nome già presente o dati non validi
 *       404:
 *         description: GruppoSegnalazioni non trovato
 *       500:
 *         description: Errore interno del server
 */
router.patch('/:id/nome', authenticateToken, authorizeRole(['operatore']), async (req, res) => {
    const { nome } = req.body;
    const gruppoId = req.params.id;

    try {
        // Trova il gruppo di segnalazioni
        const gruppo = await GruppoSegnalazioni.findById(gruppoId);
        if (!gruppo) {
            return res.status(404).json({ message: 'GruppoSegnalazioni non trovato' });
        }

        // Controllo unicità nome ed eventuale generazione automatica
        let nomeGruppo;
        if (nome) {
            const gruppoEsistente = await GruppoSegnalazioni.findOne({ nome: nome, _id: { $ne: gruppoId } });
            if (gruppoEsistente) {
                return res.status(400).json({ message: 'Esiste già un gruppo con questo nome' });
            }
            //Se il nome è valido diventa il nome del gruppo
            nomeGruppo = nome;
        }else{
            // Nome non fornito, generazione automatica a partire da una delle segnalazioni del gruppo
            const segnalazione = await Segnalazione.findOne({ gruppoSegnalazioni: gruppoId });
            if (!segnalazione) {
                return res.status(400).json({ message: 'Impossibile generare un nome: il gruppo non contiene segnalazioni' });
            }
            nomeGruppo = `${segnalazione.categoria}_${gruppo.posizione.coordinates[0].toFixed(4)}_${gruppo.posizione.coordinates[1].toFixed(4)}_${new Date(gruppo.creatoIl).toISOString().slice(0, 10)}_${Date.now()}`;
        }

        // Modifica il nome del gruppo e aggiorna la data di modifica
        gruppo.nome = nomeGruppo;
        gruppo.ultimaModificaIl = new Date();

        await gruppo.save();

        res.status(200).json({ message: 'Nome del gruppo modificato con successo', gruppo });
    } catch (error) {
        console.error('Errore durante la modifica del nome del gruppo di segnalazioni:', error);
        res.status(500).json({ message: 'Errore durante la modifica del nome del gruppo', error: error.message });
    }
});

//DELETE elimina un gruppo di segnalazioni e scollega le segnalazioni associate
/**
 * @swagger
 * /gruppiSegnalazioni/{id}:
 *   delete:
 *     summary: Elimina un gruppo di segnalazioni e scollega le segnalazioni associate
 *     tags: [GruppiSegnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID del gruppo da eliminare
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gruppo eliminato e segnalazioni scollegate correttamente
 *       404:
 *         description: Gruppo non trovato
 *       500:
 *         description: Errore interno del server
 */
router.delete('/:id', authenticateToken, authorizeRole(['operatore']), async (req, res) => {
    const gruppoId = req.params.id;

    try {
        // Trova il gruppo da eliminare
        const gruppo = await GruppoSegnalazioni.findById(gruppoId);
        if (!gruppo) {
            return res.status(404).json({ message: 'Gruppo non trovato' });
        }

        // Scollega il gruppo dalle segnalazioni associate (setta il campo gruppoSegnalazioni a null)
        await Segnalazione.updateMany(
            { gruppoSegnalazioni: gruppoId },
            { $set: { gruppoSegnalazioni: null } }
        );

        // Elimina il gruppo
        await GruppoSegnalazioni.findByIdAndDelete(gruppoId);

        res.status(200).json({ message: 'Gruppo eliminato e segnalazioni scollegate correttamente' });
    } catch (error) {
        res.status(500).json({ message: 'Errore durante l\'eliminazione del gruppo', error: error.message });
    }
});

module.exports = router;