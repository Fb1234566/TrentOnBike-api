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
 *         via:
 *           type: string
 *           description: Nome della via in cui si trova la segnalazione
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
 *           enum: [OSTACOLO, ILLUMINAZIONE_INSUFFICIENTE, PISTA_DANNEGGIATA, SEGNALAZIONE_STRADALE_MANCANTE, ALTRO]
 *         descrizione:
 *           type: string
 *         posizione:
 *           $ref: '#/components/schemas/Posizione'
 *         stato:
 *           type: string
 *           enum: [DA_VERIFICARE, ATTIVA, RISOLTA, SCARTATA]
 *         commento:
 *           type: string
 *           description: Commento dell'operatore del Comune
 *         gruppoSegnalazioni:
 *           type: string
 *           description: ID del gruppo di segnalazioni a cui appartiene (se presente)
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
 *       500:
 *         description: Errore interno del server
 */
router.post('/', authenticateToken, authorizeRole(['utente']), async (req, res) => {
    try {
        const { categoria, descrizione, posizione } = req.body;

        if (!categoria || !descrizione || !posizione?.coordinates) {
            return res.status(400).json({ message: 'Dati mancanti o incompleti.' });
        }

        //In futuro se implementato calcolo della via (riga da aggiungere):
        //const via = await getViaFromCoordinates(posizione.coordinates);

        const nuovaSegnalazione = new Segnalazione({
            utente: req.user.userId,
            categoria,
            descrizione,
            posizione: {
                ...posizione,
                via: null //via: via (quando implementato)
            }
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
 *       500:
 *         description: Errore interno del server
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
 *       500:
 *         description: Errore interno del server
 */
router.get('/', authenticateToken, authorizeRole(['operatore', 'admin']), async (req, res) => {
    try {
        const tutte = await Segnalazione.find().populate('utente', 'nome email');
        res.json(tutte);
    } catch (error) {
        res.status(500).json({ message: 'Errore nel recupero delle segnalazioni' });
    }
});

//PATCH aggiunge o modifica il commento su una segnalazione (solo per operatore)
/**
 * @swagger
 * /segnalazioni/{id}/commento:
 *   patch:
 *     summary: Aggiunge o modifica il commento dell'operatore su una segnalazione
 *     tags: [Segnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID della segnalazione da aggiornare
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [commento]
 *             properties:
 *               commento:
 *                 type: string
 *                 description: Testo del commento da salvare
 *     responses:
 *       200:
 *         description: Commento aggiornato con successo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Segnalazione'
 *       400:
 *         description: Dati non validi
 *       404:
 *         description: Segnalazione non trovata
 *       500:
 *         description: Errore interno del server
 */
router.patch('/:id/commento', authenticateToken, authorizeRole(['operatore']), async (req, res) => {
    const { commento } = req.body;

    if (!commento || typeof commento !== 'string') {
        return res.status(400).json({ message: 'Il campo commento è obbligatorio e deve essere una stringa.' });
    }

    try {
        const aggiornata = await Segnalazione.findByIdAndUpdate(
            req.params.id,
            {
                commento,
                ultimaModificataIl: Date.now()
            },
            { new: true }
        );

        if (!aggiornata) {
            return res.status(404).json({ message: 'Segnalazione non trovata' });
        }

        res.status(200).json(aggiornata);
    } catch (error) {
        res.status(500).json({ message: 'Errore durante l\'aggiornamento del commento', error: error.message });
    }
});

// PATCH cambia lo stato di una segnalazione e di tutte le segnalazioni del suo gruppo (se presente)
/**
 * @swagger
 * /segnalazioni/{id}/stato:
 *   patch:
 *     summary: Aggiorna lo stato di una segnalazione (e dell'intero gruppo se la segnalazione è associata a un gruppo)
 *     tags: [Segnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID della segnalazione da aggiornare
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
 *                 enum: [DA_VERIFICARE, ATTIVA, RISOLTA, SCARTATA]
 *     responses:
 *       200:
 *         description: Stato aggiornato con successo
 *       400:
 *         description: Stato non valido
 *       404:
 *         description: Segnalazione non trovata
 *       500:
 *         description: Errore interno del server
 */
router.patch('/:id/stato', authenticateToken, authorizeRole(['operatore']), async (req, res) => {
    const { stato } = req.body;
    const statiValidi = ['DA_VERIFICARE', 'ATTIVA', 'RISOLTA', 'SCARTATA'];

    if (!statiValidi.includes(stato)) {
        return res.status(400).json({ message: 'Stato non valido' });
    }

    try {
        const segnalazione = await Segnalazione.findById(req.params.id);
        if (!segnalazione) {
            return res.status(404).json({ message: 'Segnalazione non trovata' });
        }

        if (segnalazione.gruppoSegnalazioni) {
            // La segnalazione fa parte di un gruppo → aggiorna tutte le segnalazioni del gruppo
            const aggiornate = await Segnalazione.updateMany(
                { gruppoSegnalazioni: segnalazione.gruppoSegnalazioni },
                {
                    $set: {
                        stato,
                        ultimaModificaIl: new Date()
                    }
                }
            );
            return res.status(200).json({
                message: `Stato aggiornato a '${stato}' per tutte le segnalazioni del gruppo (${aggiornate.modifiedCount} aggiornate)`
                //aggiornate: aggiornate.modifiedCount  //contatore da aggiungere in risposta se il messaggio è troppo verboso
            });
        } else {
            // La segnalazione non fa parte di alcun gruppo → aggiorna solo lei
            segnalazione.stato = stato;
            segnalazione.ultimaModificaIl = new Date();
            await segnalazione.save();

            return res.status(200).json({
                message: `Stato aggiornato a '${stato}' per la segnalazione`,
                segnalazione
            });
        }

    } catch (error) {
        console.error('Errore durante l\'aggiornamento dello stato della segnalazione:', error);
        res.status(500).json({ message: 'Errore interno del server', error: error.message });
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
 *       500:
 *         description: Errore interno del server
 */
router.patch('/:id/lettura', authenticateToken, authorizeRole(['operatore']), async (req, res) => {
    try {
        const segnalazione = await Segnalazione.findById(req.params.id);
        if (!segnalazione) {
            return res.status(404).json({message: 'Segnalazione non trovata'});
        }

        segnalazione.lettaDalComune = true;

        await segnalazione.save();
        res.json({ message: 'Segnalazione marcata come letta', segnalazione });
    } catch (err) {
        res.status(500).json({ message: 'Errore nel marcare come letta', error: err.message });
    }
});

// PATCH aggiunge o rimuove una segnalazione da un gruppo di segnalazioni
/**
 * @swagger
 * /segnalazioni/{id}/gruppoSegnalazioni:
 *   patch:
 *     summary: Aggiunge o rimuove una segnalazione da un gruppo
 *     tags: [Segnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID della segnalazione da aggiornare
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               gruppoSegnalazioni:
 *                 type: string
 *                 nullable: true
 *                 description: ID del gruppo da associare, oppure null per rimuovere
 *     responses:
 *       200:
 *         description: Gruppo associato o rimosso correttamente
 *       400:
 *         description: Dati non validi o conflitto di stato
 *       404:
 *         description: Segnalazione o gruppo non trovati
 *       500:
 *         description: Errore interno del server
 */
router.patch('/:id/gruppoSegnalazioni', authenticateToken, authorizeRole(['operatore']), async (req, res) => {
    const segnalazioneId = req.params.id;
    const { gruppoSegnalazioni } = req.body;

    try {
        const segnalazione = await Segnalazione.findById(segnalazioneId);
        if (!segnalazione) {
            return res.status(404).json({ message: 'Segnalazione non trovata' });
        }

        // RIMOZIONE da gruppo
        if (gruppoSegnalazioni === null) {
            if (!segnalazione.gruppoSegnalazioni) {
                return res.status(400).json({ message: 'La segnalazione è già senza gruppo' });
            }

            const gruppo = await GruppoSegnalazioni.findById(segnalazione.gruppoSegnalazioni);
            if (!gruppo) {
                return res.status(404).json({ message: 'Gruppo associato non trovato' });
            }

            // Rimuove la segnalazione dal gruppo
            segnalazione.gruppoSegnalazioni = null;
            await segnalazione.save();

            gruppo.numeroSegnalazioni -= 1;

            if (gruppo.numeroSegnalazioni <= 0) {
                // Il gruppo rimane senza segnalazioni -> eliminato
                await GruppoSegnalazioni.findByIdAndDelete(gruppo._id);
                return res.status(200).json({ message: 'Segnalazione rimossa dal gruppo. Il gruppo è stato eliminato perché vuoto.' });
            } else {
                // Se il gruppo rimane, aggiorna la data
                gruppo.ultimaModificaIl = new Date();
                await gruppo.save();
                return res.status(200).json({ message: 'Segnalazione rimossa dal gruppo con successo' });
            }
        }

        // AGGIUNTA a gruppo
        const gruppo = await GruppoSegnalazioni.findById(gruppoSegnalazioni);
        if (!gruppo) {
            return res.status(404).json({ message: 'Gruppo di segnalazioni non trovato' });
        }

        if (String(segnalazione.gruppoSegnalazioni) === String(gruppo._id)) {
            return res.status(400).json({ message: 'La segnalazione è già associata a questo gruppo' });
        }

        // Recupera una segnalazione qualsiasi dal gruppo per verificarne lo stato
        const segnalazioneGruppo = await Segnalazione.findOne({ gruppoSegnalazioni: gruppo._id });
        if (!segnalazioneGruppo) {
            return res.status(400).json({ message: 'Il gruppo esiste ma non contiene segnalazioni (inconsistenza)' });
        }

        const statoGruppo = segnalazioneGruppo.stato;

        // Verifica compatibilità dello stato
        if (segnalazione.stato !== statoGruppo) {
            if (segnalazione.stato === 'DA_VERIFICARE' && statoGruppo === 'ATTIVA') {
                // Compatibile: aggiorniamo la segnalazione
                segnalazione.stato = 'ATTIVA';
                segnalazione.ultimaModificaIl = new Date(); // solo in questo caso va aggiornata
            } else {
                return res.status(400).json({
                    message: `Stato non compatibile: la segnalazione è ${segnalazione.stato}, ma il gruppo contiene segnalazioni con stato ${statoGruppo}`
                });
            }
        }

        // Eventuale rimozione dal vecchio gruppo, se presente (se rimane vuoto viene eliminato)
        let gruppoEliminato = false;
        const vecchioGruppo = await GruppoSegnalazioni.findById(segnalazione.gruppoSegnalazioni);
        if (vecchioGruppo) {
            vecchioGruppo.numeroSegnalazioni -= 1;
            if (vecchioGruppo.numeroSegnalazioni <= 0){
                await GruppoSegnalazioni.findByIdAndDelete(vecchioGruppo._id);
                gruppoEliminato = true;
            }else{
                vecchioGruppo.ultimaModificaIl = new Date();
                await vecchioGruppo.save();
            }
        }

        // Aggiunge al nuovo gruppo
        segnalazione.gruppoSegnalazioni = gruppo._id;
        await segnalazione.save();

        gruppo.numeroSegnalazioni += 1;
        gruppo.ultimaModificaIl = new Date();
        await gruppo.save();

        if (gruppoEliminato) {
            return res.status(200).json({ message: 'Segnalazione aggiunta al gruppo con successo. Gruppo precedente eliminato perché vuoto.' });
        }
        return res.status(200).json({ message: 'Segnalazione aggiunta al gruppo con successo' });
    } catch (error) {
        console.error('Errore durante l\'aggiornamento del gruppo della segnalazione:', error);
        res.status(500).json({ message: 'Errore interno del server', error: error.message });
    }
});

module.exports = router;

//TODO: aggiungere sistema di filtraggio per le segnalazioni (filtri per tipologia, per stato, per lette/non lette)
//TODO: aggiungere endpoint che forniscono statistiche aggregate (numero segnalazioni attive...)
// valutare quali statistiche calcolare a ogni chiamata in real time e quali tenere salvate du database (da aggiornare a ogni modifica delle segnalazioni)

//TODO: facoltativo -> aggiungere il ricalcolo della posizione media del gruppo quando viene aggiunta o rimossa una segnalazione (PATCH /segnalazioni/:id/gruppoSegnalazioni)