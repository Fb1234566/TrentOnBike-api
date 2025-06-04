const express = require('express');
const router = express.Router();
const RegistroAccessoVia = require('../models/RegistroAccessoVia');
const authenticateToken = require('../middleware/authenticateToken');
const authorizeRole = require('../middleware/authorizeRole');

/**
 * @swagger
 * tags:
 *   - name: StatisticheVie
 *     description: Endpoint per la registrazione e la visualizzazione degli accessi e della frequentazione delle vie.
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * security:
 *   - bearerAuth: []
 */

/**
 * @swagger
 * /statisticheVie/registraPassaggio:
 *   post:
 *     summary: Registra un passaggio/presenza utente su una via specifica.
 *     description: Questo endpoint viene chiamato dall'app client quando rileva che un utente sta percorrendo una via.
 *     tags: [StatisticheVie]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nomeVia
 *             properties:
 *               nomeVia:
 *                 type: string
 *                 description: Il nome della via percorsa. Il backend la normalizzerà (trim, lowercase).
 *                 example: "Via Belenzani"
 *     responses:
 *       201:
 *         description: Passaggio registrato con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegistroAccessoVia'
 *       400:
 *         description: Nome della via mancante o non valido.
 *       401:
 *         description: Utente non autenticato.
 *       500:
 *         description: Errore interno del server.
 */
router.post('/registraPassaggio', authenticateToken, async (req, res) => {
    const { nomeVia } = req.body;

    if (!nomeVia || typeof nomeVia !== 'string' || nomeVia.trim() === '') {
        return res.status(400).json({ message: 'Il campo nomeVia è obbligatorio e deve essere una stringa non vuota.' });
    }

    const nomeViaNormalizzato = nomeVia.trim().toLowerCase();

    try {
        const nuovoPassaggio = new RegistroAccessoVia({
            nomeVia: nomeViaNormalizzato,
        });
        const passaggioSalvato = await nuovoPassaggio.save();
        res.status(201).json(passaggioSalvato);
    } catch (error) {
        console.error('Errore durante la registrazione del passaggio via:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Errore di validazione', errors: error.errors });
        }
        res.status(500).json({ message: 'Errore interno del server durante la registrazione del passaggio.', error: error.message });
    }
});

/**
 * @swagger
 * /statisticheVie/storico:
 *   get:
 *     summary: Ottiene statistiche storiche aggregate sugli accessi alle vie (per operatori/admin).
 *     description: Permette di aggregare i passaggi registrati per periodo e per via. Accetta date complete (ISOString) per filtri temporali precisi.
 *     tags: [StatisticheVie]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: nomeVia
 *         schema:
 *           type: string
 *         description: (Opzionale) Filtra per un nome di via specifico (normalizzato, case-insensitive).
 *       - in: query
 *         name: dataInizio
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data e ora di inizio del periodo (ISOString, es. "2023-10-27T00:00:00.000Z") per il filtro.
 *       - in: query
 *         name: dataFine
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Data e ora di fine del periodo (ISOString, es. "2023-10-27T23:59:59.999Z") per il filtro (inclusa).
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [giorno, settimana, mese, via, ora]
 *           default: giorno
 *         description: Granularità dell'aggregazione. 'via' raggruppa per nomeVia nel periodo specificato. 'ora' raggruppa per ora del giorno.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: conteggio
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Elenco delle statistiche aggregate per le vie.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       periodo:
 *                         type: string
 *                       nomeVia:
 *                         type: string
 *                       conteggio:
 *                         type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 totalRecords:
 *                    type: integer
 *       400:
 *         description: Parametri di query non validi o errore di validazione.
 *       500:
 *         description: Errore interno del server.
 */
router.get('/storico', authenticateToken, authorizeRole(['operatore', 'admin']), async (req, res) => {
    const {
        nomeVia,
        dataInizio,
        dataFine,
        groupBy = 'giorno',
        page = 1,
        limit = 20,
        sortBy = 'conteggio',
        sortOrder = 'desc'
    } = req.query;

    const nPage = parseInt(page);
    const nLimit = parseInt(limit);
    const skip = (nPage - 1) * nLimit;
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    let matchConditions = {};
    if (nomeVia) {
        matchConditions.nomeVia = nomeVia.trim().toLowerCase();
    }

    if (dataInizio || dataFine) {
        matchConditions.timestamp = {};
        if (dataInizio) {
            try {
                const date = new Date(dataInizio);
                if (isNaN(date.getTime())) throw new Error('Data inizio non valida');
                matchConditions.timestamp.$gte = date;
            } catch (e) {
                return res.status(400).json({ message: `Formato dataInizio non valido. Usare ISOString (es. YYYY-MM-DDTHH:mm:ss.sssZ). Errore: ${e.message}` });
            }
        }
        if (dataFine) {
            try {
                const date = new Date(dataFine);
                if (isNaN(date.getTime())) throw new Error('Data fine non valida');
                matchConditions.timestamp.$lte = date;
            } catch (e) {
                return res.status(400).json({ message: `Formato dataFine non valido. Usare ISOString (es. YYYY-MM-DDTHH:mm:ss.sssZ). Errore: ${e.message}` });
            }
        }
    }

    let groupStageId = {};
    let projectPeriodField = {};
    let sortStage = { [sortBy]: sortDir };

    switch (groupBy) {
        case 'ora':
            groupStageId = {
                year: { $year: "$timestamp" },
                month: { $month: "$timestamp" },
                day: { $dayOfMonth: "$timestamp" },
                hour: { $hour: "$timestamp" },
                via: "$nomeVia"
            };
            projectPeriodField = { $dateToString: { format: "%Y-%m-%dT%H:00", date: { $dateFromParts: { 'year': "$_id.year", 'month': "$_id.month", 'day': "$_id.day", 'hour': "$_id.hour"} } } };
            if (sortBy === 'periodo') sortStage = { "_id.year": sortDir, "_id.month": sortDir, "_id.day": sortDir, "_id.hour": sortDir, "nomeVia": 1};
            break;
        case 'giorno':
            groupStageId = {
                year: { $year: "$timestamp" },
                month: { $month: "$timestamp" },
                day: { $dayOfMonth: "$timestamp" },
                via: "$nomeVia"
            };
            projectPeriodField = { $dateToString: { format: "%Y-%m-%d", date: { $dateFromParts: { 'year': "$_id.year", 'month': "$_id.month", 'day': "$_id.day"} } } };
            if (sortBy === 'periodo') sortStage = { "_id.year": sortDir, "_id.month": sortDir, "_id.day": sortDir, "nomeVia": 1};
            break;
        case 'settimana':
            groupStageId = {
                isoWeekYear: { $isoWeekYear: "$timestamp" },
                isoWeek: { $isoWeek: "$timestamp" },
                via: "$nomeVia"
            };
            projectPeriodField = { $concat: [ { $toString: "$_id.isoWeekYear" }, "-W", { $toString: "$_id.isoWeek" } ] };
            if (sortBy === 'periodo') sortStage = { "_id.isoWeekYear": sortDir, "_id.isoWeek": sortDir, "nomeVia": 1};
            break;
        case 'mese':
            groupStageId = {
                year: { $year: "$timestamp" },
                month: { $month: "$timestamp" },
                via: "$nomeVia"
            };
            projectPeriodField = { $dateToString: { format: "%Y-%m", date: { $dateFromParts: { 'year': "$_id.year", 'month': "$_id.month", 'day': 1} } } };
            if (sortBy === 'periodo') sortStage = { "_id.year": sortDir, "_id.month": sortDir, "nomeVia": 1};
            break;
        case 'via':
            groupStageId = "$nomeVia";
            if (sortBy === 'periodo') sortStage = { "nomeVia": sortDir };
            break;
        default:
            return res.status(400).json({ message: "Valore groupBy non valido. Valori permessi: ora, giorno, settimana, mese, via." });
    }

    try {
        const aggregation = [
            { $match: matchConditions },
            { $group: { _id: groupStageId, conteggio: { $sum: 1 } } },
        ];

        const countTotalPipeline = [...aggregation, { $count: "totalRecords" }];
        const totalCountResult = await RegistroAccessoVia.aggregate(countTotalPipeline);
        const totalRecords = totalCountResult.length > 0 ? totalCountResult[0].totalRecords : 0;
        const totalPages = Math.ceil(totalRecords / nLimit);

        let projectStage = {
            _id: 0,
            conteggio: 1
        };
        if (groupBy === 'via') {
            projectStage.nomeVia = "$_id";
        } else {
            projectStage.periodo = projectPeriodField;
            projectStage.nomeVia = "$_id.via";
        }
        aggregation.push({ $project: projectStage });

        // Costruzione dello stage di ordinamento
        // Se l'ordinamento primario è per 'conteggio' o 'nomeVia' (quando groupBy='via'), va bene.
        // Se è per 'periodo', `sortStage` è già configurato correttamente.
        // Altrimenti, se sortBy è un campo che non esiste dopo il $project, MongoDB darà errore.
        // Dobbiamo assicurarci che i campi in sortStage esistano.
        let finalSortStage = {};
        if (sortStage[sortBy] !== undefined) { // Se il campo primario di sort è valido
            finalSortStage = sortStage;
            if (sortBy !== 'nomeVia' && (groupBy !== 'via' || sortBy !== '_id') ) { // Aggiungi sort secondario se necessario
                 finalSortStage['nomeVia'] = 1; // Default secondary sort
            }
        } else if (projectStage[sortBy] !== undefined) { // Se il campo di sort è uno dei campi proiettati
            finalSortStage[sortBy] = sortDir;
            if (sortBy !== 'nomeVia') finalSortStage['nomeVia'] = 1;
        }
        else { // Fallback a un ordinamento di default se sortBy non è valido
            console.warn(`Campo sortBy '${sortBy}' non valido per il groupBy '${groupBy}', fallback a conteggio desc.`);
            finalSortStage = { 'conteggio': -1, 'nomeVia': 1 };
        }


        aggregation.push({ $sort: finalSortStage });
        aggregation.push({ $skip: skip });
        aggregation.push({ $limit: nLimit });

        const risultati = await RegistroAccessoVia.aggregate(aggregation);

        res.status(200).json({
            data: risultati,
            currentPage: nPage,
            totalPages,
            totalRecords
        });

    } catch (error) {
        console.error("Errore durante l'aggregazione dello storico vie:", error);
        if (error.name === 'MongoServerError' && (error.code === 17287 || error.codeName === 'Location17287' || error.message.includes('$sort stage considers comparing different types'))) {
             return res.status(400).json({ message: `Ordinamento per '${sortBy}' non valido o tipi di dati non confrontabili per il raggruppamento '${groupBy}'. Prova con 'conteggio' o un campo periodo valido.` });
        }
        res.status(500).json({ message: 'Errore interno del server durante il recupero dello storico.', error: error.message });
    }
});

module.exports = router;