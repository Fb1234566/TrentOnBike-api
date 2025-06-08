const express = require('express');
const router = express.Router();
const Segnalazione = require('../models/Segnalazione');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');
const { VALID_KEYS, updateGlobalTimestamp } = require('../models/globalTimestamp');

/* I permessi dei vari endpoint seguono i principi di separazione dei ruoli e minimo privilegio:
- utente autenticatom può:  creare segnalazioni, visualizzare quelle che ha già creato (non tutti i loro campi però)
- operatore può:            visualizzare tutte le segnalazioni, segnarle come lette, cambiare il loro stato, aggiungere un commento
- admin può:                visualizzare tutte le segnalazioni
Admin ha il ruolo di supervisionare e configurare il sistema, non svolge le funzioni operative
Admin può crearsi il suo utente con ruolo operatore se vuole gestire le segnalazioni
 */

const categorieValide = [
    'OSTACOLO',
    'ILLUMINAZIONE_INSUFFICIENTE',
    'PISTA_DANNEGGIATA',
    'SEGNALAZIONE_STRADALE_MANCANTE',
    'ALTRO'
];
const statiValidi = ['DA_VERIFICARE', 'ATTIVA', 'RISOLTA', 'SCARTATA'];

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
 *             required: [categoria, posizione]
 *             properties:
 *               categoria:
 *                 type: string
 *               descrizione:
 *                 type: string
 *                 nullable: true
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

        if (!categoria || !posizione?.coordinates) {
            return res.status(400).json({ message: 'Dati mancanti o incompleti.' });
        }

        // controllo sulla categoria fornita
        if (!categorieValide.includes(categoria)) {
            return res.status(400).json({ message: 'Categoria non valida.' });
        }

        //In futuro se implementato calcolo della via (riga da aggiungere):
        //const via = await getViaFromCoordinates(posizione.coordinates);

        const nuovaSegnalazione = new Segnalazione({
            utente: req.user.userId,
            categoria,
            descrizione,   //facoltativa
            posizione: {
                ...posizione,
                via: null //via: via (quando implementato)
            }
        });

        await nuovaSegnalazione.save();

        // Aggiorna il timestamp globale dell'ultima modifica alle segnalazioni
        await updateGlobalTimestamp(VALID_KEYS.LAST_REPORTS_UPDATE);

        res.status(201).json(nuovaSegnalazione);
    } catch (error) {
        res.status(500).json({ message: 'Errore durante la creazione della segnalazione', error: error.message });
    }
});

// GET ottiene tutte le segnalazioni create dall'utente autenticato (solo per utente) possibile filtrare e ordinare
/**
 * @swagger
 * /segnalazioni/mie:
 *   get:
 *     summary: Ottieni tutte le segnalazioni dell'utente autenticato con possibilità di filtro per stato e categoria
 *     tags: [Segnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: stati
 *         in: query
 *         description: Filtra le segnalazioni per uno o più stati (separati da virgola)
 *         required: false
 *         schema:
 *           type: string
 *       - name: categorie
 *         in: query
 *         description: Filtra le segnalazioni per una o più categorie (separate da virgola)
 *         required: false
 *         schema:
 *           type: string
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
 *       - name: ordine
 *         in: query
 *         description: Ordinamento delle segnalazioni, può essere crescente o decrescente per uno dei campi disponibili
 *         required: false
 *         schema:
 *           type: string
 *           enum: [creatoIl]
 *       - name: direction
 *         in: query
 *         description: Ordinamento crescente o decrescente
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - name: limit
 *         in: query
 *         description: Numero massimo di segnalazioni da visualizzare
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista delle segnalazioni dell'utente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Segnalazione'
 *       400:
 *         description: Parametro non valido
 *       500:
 *         description: Errore interno del server
 */
router.get('/mie', authenticateToken, authorizeRole(['utente']), async (req, res) => {
    try {
        let query = { utente: req.user.userId };

        // Filtro per stato (supporta lista separata da virgola o parametro ripetuto)
        if (req.query.stati) {
            const stati = Array.isArray(req.query.stati)
                ? req.query.stati
                : req.query.stati.split(',').map(s => s.trim());

            // Controlla se i valori passati sono validi
            for (let stato of stati) {
                if (!statiValidi.includes(stato)) {
                    return res.status(400).json({ message: `Stato non valido: ${stato}` });
                }
            }
            query.stato = { $in: stati };
        }

        // Filtro per categoria (supporta lista separata da virgola o parametro ripetuto)
        if (req.query.categorie) {
            const categorie = Array.isArray(req.query.categorie)
                ? req.query.categorie
                : req.query.categorie.split(',').map(c => c.trim());

            // Controlla se i valori passati sono validi
            for (let categoria of categorie) {
                if (!categorieValide.includes(categoria)) {
                    return res.status(400).json({ message: `Categoria non valida: ${categoria}` });
                }
            }
            query.categoria = { $in: categorie };
        }

        // Filtro per data di creazione (range)
        if (req.query.daData || req.query.aData) {
            const dataInizio = req.query.daData ? new Date(req.query.daData) : null;
            const dataFine = req.query.aData ? new Date(req.query.aData) : null;
            if (dataInizio || dataFine) {
                query.creatoIl = {};
                if (dataInizio) query.creatoIl.$gte = dataInizio;
                if (dataFine) query.creatoIl.$lte = dataFine;
            }
        }

        // Ordinamento
        let sort = {};
        if (req.query.ordine) {
            // 'asc' -> 1, 'desc' -> -1
            sort[req.query.ordine] = req.query.direction === 'asc' ? 1 : -1;
        } else {
            // Se non è stato fornito un parametro di ordinamento, usa 'creatoIl' con direzione decrescente
            sort['creatoIl'] = -1; // 1 per crescente, -1 per decrescente (predefinito)
        }

        // Limitazione dei risultati
        let limit;
        if (req.query.limit !== undefined) { // Controlla solo se il parametro esiste
            limit = parseInt(req.query.limit, 10); // Converte il parametro in un numero intero
            if (isNaN(limit) || limit < 1) { // Se non è un numero o è negativo/zero, restituisci errore
                return res.status(400).json({ message: 'Parametro limit non valido' });
            }
        }

        // Esegui la ricerca con filtri e ordinamento, limitando il numero di risultati
        const segnalazioni = await Segnalazione
            .find(query)
            .sort(sort)
            .limit(limit)
            .select('-lettaDalComune -commento -gruppoSegnalazioni -utente');

        res.json(segnalazioni);
    } catch (error) {
        res.status(500).json({ message: 'Errore durante il recupero delle segnalazioni' });
    }
});

// GET ottiene tutte le segnalazioni con possibilità di filtro, ordinamento e limitazione (per operatore e admin)
/**
 * @swagger
 * /segnalazioni:
 *   get:
 *     summary: Ottieni tutte le segnalazioni con possibilità di filtro per stato, categoria, lettaDalComune, gruppoSegnalazioni
 *     tags: [Segnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: stati
 *         in: query
 *         description: Filtra le segnalazioni per uno o più stati (separati da virgola)
 *         required: false
 *         schema:
 *           type: string
 *       - name: categorie
 *         in: query
 *         description: Filtra le segnalazioni per una o più categorie (separate da virgola)
 *         required: false
 *         schema:
 *           type: string
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
 *       - name: lettaDalComune
 *         in: query
 *         description: Filtra le segnalazioni che sono state lette o meno dal comune (true/false)
 *         required: false
 *         schema:
 *           type: boolean
 *       - name: gruppoSegnalazioni
 *         in: query
 *         description: Filtra le segnalazioni che hanno un gruppo o che non lo hanno (true/false)
 *         required: false
 *         schema:
 *           type: boolean
 *       - name: ordine
 *         in: query
 *         description: Ordinamento delle segnalazioni, può essere crescente o decrescente per uno dei campi disponibili
 *         required: false
 *         schema:
 *           type: string
 *       - name: direction
 *         in: query
 *         description: Ordinamento crescente o decrescente
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - name: limit
 *         in: query
 *         description: Numero massimo di segnalazioni da visualizzare
 *         required: false
 *         schema:
 *           type: integer
 *       - name: via
 *         in: query
 *         description: Filtra le segnalazioni per via esatta
 *         required: false
 *         schema:
 *           type: string
 *       - name: lat
 *         in: query
 *         description: Latitudine per il filtro geospaziale (richiede anche lng)
 *         required: false
 *         schema:
 *           type: number
 *       - name: lng
 *         in: query
 *         description: Longitudine per il filtro geospaziale (richiede anche lat)
 *         required: false
 *         schema:
 *           type: number
 *       - name: raggio
 *         in: query
 *         description: Raggio in metri entro cui cercare dalla posizione indicata
 *         required: false
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Lista delle segnalazioni
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Segnalazione'
 *       400:
 *         description: Parametro non valido
 *       500:
 *         description: Errore interno del server
 */
router.get('/', authenticateToken, authorizeRole(['operatore', 'admin']), async (req, res) => {
    try {
        let query = {};

        // Filtro per stato (supporta lista separata da virgola o parametro ripetuto)
        if (req.query.stati) {
            const stati = Array.isArray(req.query.stati)
                ? req.query.stati
                : req.query.stati.split(',').map(s => s.trim());

            // Controlla se i valori passati sono validi
            for (let stato of stati) {
                if (!statiValidi.includes(stato)) {
                    return res.status(400).json({ message: `Stato non valido: ${stato}` });
                }
            }
            query.stato = { $in: stati };
        }

        // Filtro per categoria (supporta lista separata da virgola o parametro ripetuto)
        if (req.query.categorie) {
            const categorie = Array.isArray(req.query.categorie)
                ? req.query.categorie
                : req.query.categorie.split(',').map(c => c.trim());

            // Controlla se i valori passati sono validi
            for (let categoria of categorie) {
                if (!categorieValide.includes(categoria)) {
                    return res.status(400).json({ message: `Categoria non valida: ${categoria}` });
                }
            }
            query.categoria = { $in: categorie };
        }

        // Filtro per data di creazione (range)
        if (req.query.daData || req.query.aData) {
            const dataInizio = req.query.daData ? new Date(req.query.daData) : null;
            const dataFine = req.query.aData ? new Date(req.query.aData) : null;
            if (dataInizio || dataFine) {
                query.creatoIl = {};
                if (dataInizio) query.creatoIl.$gte = dataInizio;
                if (dataFine) query.creatoIl.$lte = dataFine;
            }
        }

        // Filtro per lettaDalComune
        if (req.query.lettaDalComune !== undefined) {
            query.lettaDalComune = req.query.lettaDalComune === 'true'; // True o False
        }

        // Filtro per gruppoSegnalazioni
        if (req.query.gruppoSegnalazioni !== undefined) {
            if (req.query.gruppoSegnalazioni === 'true') {
                // Se il parametro è 'true', prendi segnalazioni che hanno un gruppo (gruppoSegnalazioni !== null)
                query.gruppoSegnalazioni = { $ne: null };
            } else if (req.query.gruppoSegnalazioni === 'false') {
                // Se il parametro è 'false', prendi segnalazioni senza un gruppo (gruppoSegnalazioni === null)
                query.gruppoSegnalazioni = null;
            }
        }

        // Filtro per posizione geografica (se viene fornita la via, ignora eventuali coordinate)
        if (req.query.via) {
            query['posizione.via'] = req.query.via;
        } else if (req.query.lat && req.query.lng) {
            const lat = parseFloat(req.query.lat);
            const lng = parseFloat(req.query.lng);
            const raggio = parseInt(req.query.raggio) || 1000; // default 1000 metri

            if (isNaN(lat) || isNaN(lng)) {
                return res.status(400).json({ message: 'Latitudine o longitudine non valide' });
            }

            // Cerca entro un certo raggio usando $geoWithin con $centerSphere
            query.posizione = {
                $geoWithin: {
                    $centerSphere: [[lng, lat], raggio / 6378137]  // raggio in radianti (raggio terrestre ~6378137 m)
                }
            };
        }

        // Ordinamento
        let sort = {};
        if (req.query.ordine) {
            // 'asc' -> 1, 'desc' -> -1
            sort[req.query.ordine] = req.query.direction === 'asc' ? 1 : -1;
        } else {
            // Se non è stato fornito un parametro di ordinamento, usa 'creatoIl' con direzione decrescente
            sort['creataIl'] = -1; // 1 per crescente, -1 per decrescente (predefinito)
        }

        // Limitazione dei risultati
        let limit;
        if (req.query.limit !== undefined) { // Controlla solo se il parametro esiste
            limit = parseInt(req.query.limit, 10); // Converte il parametro in un numero intero
            if (isNaN(limit) || limit < 1) { // Se non è un numero o è negativo/zero, restituisci errore
                return res.status(400).json({ message: 'Parametro limit non valido' });
            }
        }

        // Esegui la ricerca con filtri, ordinamento e limitazione
        const segnalazioni = await Segnalazione
            .find(query)
            .sort(sort)
            .limit(limit)
            //.select('-utente');  // Esclude il campo 'utente' dalla risposta

        res.json(segnalazioni);
    } catch (error) {
        res.status(500).json({ message: 'Errore durante il recupero delle segnalazioni' });
    }
});

//GET ottiene una segnalazione specifica
/**
 * @swagger
 * /segnalazioni/{id}:
 *   get:
 *     summary: Ottieni i dettagli di una specifica segnalazione
 *     tags: [Segnalazioni]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID della segnalazione
 *     responses:
 *       200:
 *         description: Dettagli della segnalazione recuperati con successo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Segnalazione'
 *       404:
 *         description: Segnalazione non trovata
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Errore interno del server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', authenticateToken, authorizeRole(['operatore', 'admin']), async (req, res) => {
    try {
        const segnalazione = await Segnalazione.findById(req.params.id);

        if (!segnalazione) {
            return res.status(404).json({ message: 'Segnalazione non trovata.' });
        }

        res.status(200).json(segnalazione);
    } catch (error) {
        res.status(500).json({ message: 'Errore interno del server', error: error.message });
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

    if (typeof commento !== 'string') {
        return res.status(400).json({ message: 'Il campo commento deve essere una stringa.' });
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

        // Aggiorna il timestamp globale dell'ultima modifica alle segnalazioni
        await updateGlobalTimestamp(VALID_KEYS.LAST_REPORTS_UPDATE);

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

    // Controllo che lo stato sia valido
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

            // Aggiorna il timestamp globale dell'ultima modifica alle segnalazioni
            await updateGlobalTimestamp(VALID_KEYS.LAST_REPORTS_UPDATE);

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
 *         description: Operazione completata con successo
 *         content:
 *           application/json:
 *             schema:
 *                 type: object
 *                 properties:
 *                   message:
 *                     type: string
 *                     example: "Segnalazione marcata come letta" # oppure: "La segnalazione era già marcata come letta"
 *                   segnalazione:
 *                     $ref: '#/components/schemas/Segnalazione'
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

        if(!segnalazione.lettaDalComune){
            segnalazione.lettaDalComune = true;
            await segnalazione.save();

            // Aggiorna il timestamp globale dell'ultima modifica alle segnalazioni
            await updateGlobalTimestamp(VALID_KEYS.LAST_REPORTS_UPDATE);
            return res.status(200).json({ message: 'Segnalazione marcata come letta', segnalazione });
        }

        res.status(200).json({ message: 'La segnalazione era già marcata come letta', segnalazione });
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

                // Aggiorna il timestamp globale dell'ultima modifica alle segnalazioni
                await updateGlobalTimestamp(VALID_KEYS.LAST_REPORTS_UPDATE);

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
            // Aggiorna il timestamp globale dell'ultima modifica alle segnalazioni
            await updateGlobalTimestamp(VALID_KEYS.LAST_REPORTS_UPDATE);
            return res.status(200).json({ message: 'Segnalazione aggiunta al gruppo con successo. Gruppo precedente eliminato perché vuoto.' });
        }
        // Aggiorna il timestamp globale dell'ultima modifica alle segnalazioni
        await updateGlobalTimestamp(VALID_KEYS.LAST_REPORTS_UPDATE);
        return res.status(200).json({ message: 'Segnalazione aggiunta al gruppo con successo' });
    } catch (error) {
        console.error('Errore durante l\'aggiornamento del gruppo della segnalazione:', error);
        res.status(500).json({ message: 'Errore interno del server', error: error.message });
    }
});

module.exports = router;

//TODO: aggiungere endpoint che forniscono statistiche aggregate (numero segnalazioni attive...)
// valutare quali statistiche calcolare a ogni chiamata in real time e quali tenere salvate du database (da aggiornare a ogni modifica delle segnalazioni)

//TODO: facoltativo -> aggiungere il ricalcolo della posizione media del gruppo quando viene aggiunta o rimossa una segnalazione (PATCH /segnalazioni/:id/gruppoSegnalazioni)