const { app, connectToMongoDB } = require('../index');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Segnalazione = require('../models/Segnalazione'); // Assicurati che il percorso sia corretto
const GruppoSegnalazioni = require('../models/GruppoSegnalazioni'); // Assicurati che il percorso sia corretto
const { VALID_KEYS } = require('../models/GlobalTimestamp'); // Per accedere a VALID_KEYS se necessario

// Parametri di configurazione
const operatorUserId = '605c72a7c364821a8864a065'; // ID di un utente operatore esistente nel DB di test
const standardUserId = '605c72a7c364821a8864a066'; // ID di un utente standard esistente nel DB di test
const adminUserId = '605c72a7c364821a8864a067'; // ID di un utente admin esistente nel DB di test
const jwtSecret = process.env.JWT_SECRET || 'test_secret';
const baseUrl = process.env.BASE_URL || '/api/v1';

// Token di autenticazione
let operatorToken;
let standardUserToken;
let adminToken;

// ID di test per le operazioni
let testSegnalazioneId;
let testSegnalazioneUtenteId; // Per segnalazioni create dall'utente standard
let testGruppoId;

let segnalazioneIds = []; // Per tenere traccia degli ID delle segnalazioni create
let gruppoSegnalazioniTestId; // Per memorizzare l'ID del gruppo di test

beforeAll(async () => {
    await connectToMongoDB();

    // Crea token per i test
    operatorToken = jwt.sign({ userId: operatorUserId, ruolo: 'operatore' }, jwtSecret, { expiresIn: '1h' });
    standardUserToken = jwt.sign({ userId: standardUserId, ruolo: 'utente' }, jwtSecret, { expiresIn: '1h' });
    adminToken = jwt.sign({ userId: adminUserId, ruolo: 'admin' }, jwtSecret, { expiresIn: '1h' });

    // Creazione di un gruppo di segnalazioni di test (COME NEL MIO ESEMPIO PRECEDENTE, MA ORA operatorUserId È DEFINITO)
    const testGruppoData = {
        nome: "Gruppo Test Posizione",
        posizione: {
            type: "Point",
            coordinates: [11.12345, 46.06789]
        },
        creatoDa: operatorUserId, // Ora operatorUserId è definito!
        numeroSegnalazioni: 0
    };
    const testGruppo = new GruppoSegnalazioni(testGruppoData);
    await testGruppo.save();
    gruppoSegnalazioniTestId = testGruppo._id;

    // Crea alcune segnalazioni per i test successivi (US00X-10, ecc.)
    // Assicurati che abbiano le date e le proprietà corrette
    const segnalazione1 = new Segnalazione({
        utente: standardUserId,
        categoria: 'OSTACOLO',
        descrizione: 'Segnalazione per filtro data 1',
        posizione: { type: 'Point', coordinates: [11.0, 46.0], via: 'Via Trento' },
        creataIl: '2024-01-03T10:00:00Z',
        stato: 'DA_VERIFICARE'
    });
    await segnalazione1.save();
    segnalazioneIds.push(segnalazione1._id);

    const segnalazione2 = new Segnalazione({
        utente: standardUserId,
        categoria: 'OSTACOLO',
        descrizione: 'Segnalazione per filtro data 2',
        posizione: { type: 'Point', coordinates: [11.0, 46.0], via: 'Via Trento' },
        creataIl: '2024-01-02T10:00:00Z',
        stato: 'DA_VERIFICARE'
    });
    await segnalazione2.save();
    segnalazioneIds.push(segnalazione2._id);

    // ... aggiungi altre segnalazioni o dati di test necessari per tutti i test che vuoi mantenere
});

afterAll(async () => {
    // Pulisci le segnalazioni create durante i test
    await Segnalazione.deleteMany({
        $or: [
            { utente: standardUserId },
            { descrizione: /Test Segnalazione/ },
            { commento: /Test commento/ }
        ]
    });
    // Pulisci i gruppi di segnalazioni creati durante i test
    await GruppoSegnalazioni.deleteMany({
        $or: [
            { _id: testGruppoId },
            { numeroSegnalazioni: 0 } // Pulisce eventuali gruppi vuoti
        ]
    });

    await mongoose.connection.close();
});

describe('Test Segnalazioni', () => {

    // --- POST /segnalazioni ---
    describe('POST /segnalazioni', () => {
        /*test('US00X-01: Dovrebbe creare una nuova segnalazione per un utente autenticato', async () => {
            const segnalazioneData = {
                categoria: 'OSTACOLO',
                descrizione: 'Un albero caduto sulla pista ciclabile',
                posizione: {
                    type: 'Point',
                    coordinates: [11.12345, 46.06789],
                    via: 'Via Roma'
                }
            };

            const response = await request(app)
                .post(`${baseUrl}/segnalazioni`)
                .set('Authorization', `Bearer ${standardUserToken}`)
                .send(segnalazioneData);

            expect(response.statusCode).toBe(201);
            expect(response.body).toHaveProperty('_id');
            expect(response.body).toHaveProperty('utente', standardUserId);
            expect(response.body).toHaveProperty('categoria', segnalazioneData.categoria);
            expect(response.body.posizione.coordinates).toEqual(segnalazioneData.posizione.coordinates);
            expect(response.body.stato).toBe('DA_VERIFICARE');
            testSegnalazioneUtenteId = response.body._id; // Salva l'ID per test futuri
            testSegnalazioneId = response.body._id; // Salva l'ID per test futuri per operatore/admin
        });

         */

        test('US00X-02: Non dovrebbe creare una segnalazione con categoria non valida', async () => {
            const segnalazioneData = {
                categoria: 'CATEGORIA_NON_VALIDA',
                descrizione: 'Descrizione di test',
                posizione: {
                    type: 'Point',
                    coordinates: [11.12345, 46.06789]
                }
            };

            const response = await request(app)
                .post(`${baseUrl}/segnalazioni`)
                .set('Authorization', `Bearer ${standardUserToken}`)
                .send(segnalazioneData);

            expect(response.statusCode).toBe(400);
            expect(response.body).toHaveProperty('message', 'Categoria non valida.');
        });

        test('US00X-03: Non dovrebbe creare una segnalazione senza coordinate', async () => {
            const segnalazioneData = {
                categoria: 'OSTACOLO',
                descrizione: 'Descrizione di test',
                posizione: {
                    type: 'Point',
                    // coordinates mancanti
                }
            };

            const response = await request(app)
                .post(`${baseUrl}/segnalazioni`)
                .set('Authorization', `Bearer ${standardUserToken}`)
                .send(segnalazioneData);

            expect(response.statusCode).toBe(400);
            expect(response.body).toHaveProperty('message', 'Dati mancanti o incompleti.');
        });

        test('US00X-04: Non dovrebbe creare una segnalazione senza autenticazione', async () => {
            const segnalazioneData = {
                categoria: 'OSTACOLO',
                descrizione: 'Descrizione di test',
                posizione: {
                    type: 'Point',
                    coordinates: [11.12345, 46.06789]
                }
            };

            const response = await request(app)
                .post(`${baseUrl}/segnalazioni`)
                .send(segnalazioneData);

            expect(response.statusCode).toBe(401); // Unauthorized
        });
    });

    // --- GET /segnalazioni/mie (solo per utente) ---
    describe('GET /segnalazioni/mie', () => {
        beforeAll(async () => {
            // Crea alcune segnalazioni di test per l'utente standard
            await Segnalazione.create([
                {
                    utente: standardUserId,
                    categoria: 'OSTACOLO',
                    descrizione: 'Segnalazione 1 (OSTACOLO, DA_VERIFICARE)',
                    posizione: { type: 'Point', coordinates: [11.1, 46.1] },
                    stato: 'DA_VERIFICARE',
                    creataIl: new Date('2024-01-01T10:00:00Z')
                },
                {
                    utente: standardUserId,
                    categoria: 'ILLUMINAZIONE_INSUFFICIENTE',
                    descrizione: 'Segnalazione 2 (ILLUMINAZIONE, RISOLTA)',
                    posizione: { type: 'Point', coordinates: [11.2, 46.2] },
                    stato: 'RISOLTA',
                    creataIl: new Date('2024-01-02T11:00:00Z')
                },
                {
                    utente: standardUserId,
                    categoria: 'PISTA_DANNEGGIATA',
                    descrizione: 'Segnalazione 3 (PISTA_DANNEGGIATA, ATTIVA)',
                    posizione: { type: 'Point', coordinates: [11.3, 46.3] },
                    stato: 'ATTIVA',
                    creataIl: new Date('2024-01-03T12:00:00Z')
                },
                {
                    utente: standardUserId,
                    categoria: 'OSTACOLO',
                    descrizione: 'Segnalazione 4 (OSTACOLO, DA_VERIFICARE)',
                    posizione: { type: 'Point', coordinates: [11.4, 46.4] },
                    stato: 'DA_VERIFICARE',
                    creataIl: new Date('2024-01-04T13:00:00Z')
                },
                {
                    utente: operatorUserId, // Segnalazione di un altro utente (non dovrebbe essere visibile)
                    categoria: 'OSTACOLO',
                    descrizione: 'Segnalazione di altro utente',
                    posizione: { type: 'Point', coordinates: [11.5, 46.5] }
                }
            ]);
        });

        test('US00X-06: Dovrebbe ottenere tutte le segnalazioni dell\'utente autenticato', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni/mie`)
                .set('Authorization', `Bearer ${standardUserToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.length).toBeGreaterThanOrEqual(4); // Almeno 4 segnalazioni dell'utente di test
            expect(response.body.every(s => s.utente === undefined)).toBe(true); // Il campo utente non dovrebbe essere esposto
            expect(response.body.every(s => s.lettaDalComune === undefined)).toBe(true); // Il campo lettaDalComune non dovrebbe essere esposto
        });

        test('US00X-08: Dovrebbe filtrare le segnalazioni per stati multipli', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni/mie?stati=DA_VERIFICARE,RISOLTA`)
                .set('Authorization', `Bearer ${standardUserToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.length).toBeGreaterThanOrEqual(3);
            expect(response.body.every(s => ['DA_VERIFICARE', 'RISOLTA'].includes(s.stato))).toBe(true);
        });

        test('US00X-09: Dovrebbe filtrare le segnalazioni per categoria', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni/mie?categorie=OSTACOLO`)
                .set('Authorization', `Bearer ${standardUserToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.length).toBeGreaterThanOrEqual(2);
            expect(response.body.every(s => s.categoria === 'OSTACOLO')).toBe(true);
        });

        /*test('US00X-10: Dovrebbe filtrare le segnalazioni per data di creazione', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni/mie?daData=2024-01-01T18:43:12.000Z&aData=2024-01-03T18:43:12.000Z`)
                .set('Authorization', `Bearer ${standardUserToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.length).toBeGreaterThanOrEqual(2);
            expect(new Date(response.body[0].creataIl).toISOString().split('T')[0]).toBe('2024-01-03');
            expect(new Date(response.body[1].creataIl).toISOString().split('T')[0]).toBe('2024-01-02');
        });
         */

        test('US00X-12: Dovrebbe limitare il numero di risultati', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni/mie?limit=2`)
                .set('Authorization', `Bearer ${standardUserToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.length).toBe(2);
        });

        test('US00X-13: Dovrebbe restituire 400 per stato non valido nel filtro', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni/mie?stati=INVALIDO`)
                .set('Authorization', `Bearer ${standardUserToken}`);

            expect(response.statusCode).toBe(400);
            expect(response.body).toHaveProperty('message', 'Stato non valido: INVALIDO');
        });

        test('US00X-14: Dovrebbe restituire 400 per categoria non valida nel filtro', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni/mie?categorie=INVALIDA`)
                .set('Authorization', `Bearer ${standardUserToken}`);

            expect(response.statusCode).toBe(400);
            expect(response.body).toHaveProperty('message', 'Categoria non valida: INVALIDA');
        });

        test('US00X-15: Dovrebbe restituire 400 per limite non valido', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni/mie?limit=abc`)
                .set('Authorization', `Bearer ${standardUserToken}`);

            expect(response.statusCode).toBe(400);
            expect(response.body).toHaveProperty('message', 'Parametro limit non valido');
        });
    });

    // --- GET /segnalazioni (per operatore e admin) ---
    describe('GET /segnalazioni', () => {
        let opSegnalazioneId;
        beforeAll(async () => {
            // Crea alcune segnalazioni di test per l'operatore
            const s1 = await Segnalazione.create({
                utente: operatorUserId,
                categoria: 'OSTACOLO',
                descrizione: 'Segnalazione Operatore 1',
                posizione: { type: 'Point', coordinates: [12.0, 47.0] },
                stato: 'DA_VERIFICARE',
                lettaDalComune: false,
                creataIl: new Date('2024-02-01T10:00:00Z')
            });
            opSegnalazioneId = s1._id;

            await Segnalazione.create({
                utente: standardUserId,
                categoria: 'ILLUMINAZIONE_INSUFFICIENTE',
                descrizione: 'Segnalazione Operatore 2',
                posizione: { type: 'Point', coordinates: [12.1, 47.1] },
                stato: 'RISOLTA',
                lettaDalComune: true,
                creataIl: new Date('2024-02-02T11:00:00Z')
            });

            // Crea un gruppo di segnalazioni e una segnalazione associata
            const gruppo = await GruppoSegnalazioni.create({
                nome: "Gruppo Test",
                descrizione: "Gruppo di segnalazioni per test",
                numeroSegnalazioni: 1,
                posizione: { type: 'Point', coordinates: [12.2, 47.2] },
            });
            testGruppoId = gruppo._id;

            await Segnalazione.create({
                utente: standardUserId,
                categoria: 'ALTRO',
                descrizione: 'Segnalazione in gruppo',
                posizione: { type: 'Point', coordinates: [12.2, 47.2] },
                stato: 'DA_VERIFICARE',
                gruppoSegnalazioni: testGruppoId,
                lettaDalComune: false,
                creataIl: new Date('2024-02-03T12:00:00Z')
            });
        });

        test('US00X-16: Dovrebbe ottenere tutte le segnalazioni (operatore)', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni`)
                .set('Authorization', `Bearer ${operatorToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.length).toBeGreaterThanOrEqual(6); // Tutte le segnalazioni (utente e operatore)
            expect(response.body.every(s => s.utente !== undefined)).toBe(true); // Il campo utente dovrebbe essere presente
            expect(response.body.every(s => s.lettaDalComune !== undefined)).toBe(true); // Il campo lettaDalComune dovrebbe essere presente
        });

        test('US00X-18: Dovrebbe filtrare le segnalazioni per lettaDalComune=false', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni?lettaDalComune=false`)
                .set('Authorization', `Bearer ${operatorToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.length).toBeGreaterThanOrEqual(2); // Almeno la segnalazione operatore 1 e la segnalazione in gruppo
            expect(response.body.every(s => s.lettaDalComune === false)).toBe(true);
        });

        test('US00X-19: Dovrebbe filtrare le segnalazioni per gruppoSegnalazioni=true', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni?gruppoSegnalazioni=true`)
                .set('Authorization', `Bearer ${operatorToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.length).toBeGreaterThanOrEqual(1);
            expect(response.body.every(s => s.gruppoSegnalazioni !== null)).toBe(true);
        });

        test('US00X-21: Dovrebbe filtrare le segnalazioni per posizione geografica (lat/lng/raggio)', async () => {
            // Dovrebbe trovare la segnalazione creata con coordinate [12.0, 47.0]
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni?lat=47.0&lng=12.0&raggio=100`) // Raggio piccolo intorno al punto
                .set('Authorization', `Bearer ${operatorToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body.length).toBeGreaterThanOrEqual(1);
            expect(response.body.some(s => s._id.toString() === opSegnalazioneId.toString())).toBe(true);
        });


    });

    // --- GET /segnalazioni/:id (solo per operatore e admin) ---
    describe('GET /segnalazioni/:id', () => {
        let tempSegnalazioneId;
        beforeAll(async () => {
            const tempSegnalazione = await Segnalazione.create({
                utente: standardUserId,
                categoria: 'ALTRO',
                descrizione: 'Segnalazione di test per ID',
                posizione: { type: 'Point', coordinates: [13.0, 48.0] }
            });
            tempSegnalazioneId = tempSegnalazione._id;
        });

        test('US00X-24: Dovrebbe ottenere una specifica segnalazione (operatore)', async () => {
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni/${tempSegnalazioneId}`)
                .set('Authorization', `Bearer ${operatorToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('_id', tempSegnalazioneId.toString());
            expect(response.body).toHaveProperty('descrizione', 'Segnalazione di test per ID');
        });

        test('US00X-26: Dovrebbe restituire 404 per segnalazione non trovata', async () => {
            const nonExistingId = new mongoose.Types.ObjectId().toHexString(); // ID che non esiste
            const response = await request(app)
                .get(`${baseUrl}/segnalazioni/${nonExistingId}`)
                .set('Authorization', `Bearer ${operatorToken}`);

            expect(response.statusCode).toBe(404);
            expect(response.body).toHaveProperty('message', 'Segnalazione non trovata.');
        });
    });

    // --- PATCH /segnalazioni/:id/commento (solo per operatore) ---
    /*describe('PATCH /segnalazioni/:id/commento', () => {
        let commentSegnalazioneId;
        beforeAll(async () => {
            const segnalazione = await Segnalazione.create({
                utente: standardUserId,
                categoria: 'ALTRO',
                descrizione: 'Segnalazione per commento',
                posizione: { type: 'Point', coordinates: [14.0, 49.0] }
            });
            commentSegnalazioneId = segnalazione._id;
        });

        test('US00X-28: Dovrebbe aggiungere un commento a una segnalazione', async () => {
            const newComment = 'Questo è un commento di prova.';
            const response = await request(app)
                .patch(`${baseUrl}/segnalazioni/${commentSegnalazioneId}/commento`)
                .set('Authorization', `Bearer ${operatorToken}`)
                .send({ commento: newComment });

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('commento', newComment);
            expect(response.body).toHaveProperty('ultimaModificataIl');

            const updatedSegnalazione = await Segnalazione.findById(commentSegnalazioneId);
            expect(updatedSegnalazione.commento).toBe(newComment);
        });
    });

     */

    // --- PATCH /segnalazioni/:id/stato (solo per operatore) ---
    describe('PATCH /segnalazioni/:id/stato', () => {
        let statoSegnalazioneId;
        let gruppoSegnalazioneId;
        let segnalazioneInGruppoId;

        beforeEach(async () => {
            const segnalazione = await Segnalazione.create({
                utente: standardUserId,
                categoria: 'ALTRO',
                descrizione: 'Segnalazione per cambio stato',
                posizione: { type: 'Point', coordinates: [15.0, 50.0] },
                stato: 'DA_VERIFICARE'
            });
            statoSegnalazioneId = segnalazione._id;

            // Crea un gruppo e una segnalazione associata per testare l'aggiornamento del gruppo
            const gruppo = await GruppoSegnalazioni.create({
                nome: "Gruppo per Stato",
                descrizione: "Test aggiornamento stato gruppo",
                numeroSegnalazioni: 1,
                posizione: { type: 'Point', coordinates: [15.1, 50.1] },
            });
            gruppoSegnalazioneId = gruppo._id;

            const segInGruppo = await Segnalazione.create({
                utente: standardUserId,
                categoria: 'PISTA_DANNEGGIATA',
                descrizione: 'Segnalazione in gruppo per stato',
                posizione: { type: 'Point', coordinates: [15.1, 50.1] },
                stato: 'DA_VERIFICARE',
                gruppoSegnalazioni: gruppoSegnalazioneId
            });
            segnalazioneInGruppoId = segInGruppo._id;
        });

        /*test('US00X-33: Dovrebbe cambiare lo stato di una segnalazione singola', async () => {
            const newState = 'ATTIVA';
            const response = await request(app)
                .patch(`${baseUrl}/segnalazioni/${statoSegnalazioneId}/stato`)
                .set('Authorization', `Bearer ${operatorToken}`)
                .send({ stato: newState });

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toContain(`Stato aggiornato a '${newState}' per la segnalazione`);
            expect(response.body.segnalazione).toHaveProperty('stato', newState);

            const updatedSegnalazione = await Segnalazione.findById(statoSegnalazioneId);
            expect(updatedSegnalazione.stato).toBe(newState);
        });

         */

        test('US00X-34: Dovrebbe cambiare lo stato di tutte le segnalazioni di un gruppo', async () => {
            const newState = 'RISOLTA';
            const response = await request(app)
                .patch(`${baseUrl}/segnalazioni/${segnalazioneInGruppoId}/stato`)
                .set('Authorization', `Bearer ${operatorToken}`)
                .send({ stato: newState });

            expect(response.statusCode).toBe(200);
            expect(response.body.message).toContain(`Stato aggiornato a '${newState}' per tutte le segnalazioni del gruppo`);

            const updatedSegnalazione = await Segnalazione.findById(segnalazioneInGruppoId);
            expect(updatedSegnalazione.stato).toBe(newState);
        });

        test('US00X-35: Non dovrebbe cambiare lo stato con stato non valido', async () => {
            const response = await request(app)
                .patch(`${baseUrl}/segnalazioni/${statoSegnalazioneId}/stato`)
                .set('Authorization', `Bearer ${operatorToken}`)
                .send({ stato: 'STATO_NON_ESISTENTE' });

            expect(response.statusCode).toBe(400);
            expect(response.body).toHaveProperty('message', 'Stato non valido');
        });

        test('US00X-36: Non dovrebbe cambiare lo stato di segnalazione non trovata', async () => {
            const nonExistingId = new mongoose.Types.ObjectId().toHexString();
            const response = await request(app)
                .patch(`${baseUrl}/segnalazioni/${nonExistingId}/stato`)
                .set('Authorization', `Bearer ${operatorToken}`)
                .send({ stato: 'ATTIVA' });

            expect(response.statusCode).toBe(404);
            expect(response.body).toHaveProperty('message', 'Segnalazione non trovata');
        });
    });

    // --- PATCH /segnalazioni/:id/lettura (solo per operatore) ---
    describe('PATCH /segnalazioni/:id/lettura', () => {
        let letturaSegnalazioneId;
        beforeEach(async () => {
            const segnalazione = await Segnalazione.create({
                utente: standardUserId,
                categoria: 'ALTRO',
                descrizione: 'Segnalazione per test lettura',
                posizione: { type: 'Point', coordinates: [16.0, 51.0] },
                lettaDalComune: false
            });
            letturaSegnalazioneId = segnalazione._id;
        });

        /*test('US00X-38: Dovrebbe marcare una segnalazione come letta', async () => {
            const response = await request(app)
                .patch(`${baseUrl}/segnalazioni/${letturaSegnalazioneId}/lettura`)
                .set('Authorization', `Bearer ${operatorToken}`);

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('message', 'Segnalazione marcata come letta');
            expect(response.body.segnalazione).toHaveProperty('lettaDalComune', true);

            const updatedSegnalazione = await Segnalazione.findById(letturaSegnalazioneId);
            expect(updatedSegnalazione.lettaDalComune).toBe(true);
        });

         */

        test('US00X-40: Non dovrebbe marcare come letta segnalazione non trovata', async () => {
            const nonExistingId = new mongoose.Types.ObjectId().toHexString();
            const response = await request(app)
                .patch(`${baseUrl}/segnalazioni/${nonExistingId}/lettura`)
                .set('Authorization', `Bearer ${operatorToken}`);

            expect(response.statusCode).toBe(404);
            expect(response.body).toHaveProperty('message', 'Segnalazione non trovata');
        });
    });

    // --- PATCH /segnalazioni/:id/gruppoSegnalazioni (solo per operatore) ---
    /*describe('PATCH /segnalazioni/:id/gruppoSegnalazioni', () => {
        let segPerGruppoId1;
        let segPerGruppoId2;
        let segPerGruppoId3;
        let existingGruppoId;
        let existingGruppo2Id;

        beforeEach(async () => {
            // Segnalazione singola da aggiungere a un gruppo
            const seg1 = await Segnalazione.create({
                utente: standardUserId,
                categoria: 'OSTACOLO',
                descrizione: 'Segnalazione per test gruppo 1',
                posizione: { type: 'Point', coordinates: [17.0, 52.0] },
                stato: 'DA_VERIFICARE'
            });
            segPerGruppoId1 = seg1._id;

            // Segnalazione già in un gruppo, per test di rimozione
            const gruppo = await GruppoSegnalazioni.create({
                nome: "Gruppo Esistente",
                descrizione: "Gruppo per test di rimozione",
                numeroSegnalazioni: 1,
                posizione: { type: 'Point', coordinates: [17.1, 52.1] },
            });
            existingGruppoId = gruppo._id;

            const seg2 = await Segnalazione.create({
                utente: standardUserId,
                categoria: 'ILLUMINAZIONE_INSUFFICIENTE',
                descrizione: 'Segnalazione per test gruppo 2 (già in gruppo)',
                posizione: { type: 'Point', coordinates: [17.1, 52.1] },
                stato: 'DA_VERIFICARE',
                gruppoSegnalazioni: existingGruppoId
            });
            segPerGruppoId2 = seg2._id;

            // Aggiorna il contatore del gruppo esistente dopo aver aggiunto la segnalazione
            await GruppoSegnalazioni.findByIdAndUpdate(existingGruppoId, { $inc: { numeroSegnalazioni: 1 } });

            // Segnalazione con stato diverso per test di compatibilità
            const gruppo2 = await GruppoSegnalazioni.create({
                nome: "Gruppo Esistente 2 (stato ATTIVA)",
                descrizione: "Gruppo per test stato compatibilità",
                numeroSegnalazioni: 1,
                posizione: { type: 'Point', coordinates: [17.2, 52.2] },
            });
            existingGruppo2Id = gruppo2._id;

            const seg3 = await Segnalazione.create({
                utente: standardUserId,
                categoria: 'PISTA_DANNEGGIATA',
                descrizione: 'Segnalazione per test gruppo 3 (gruppo con stato ATTIVA)',
                posizione: { type: 'Point', coordinates: [17.2, 52.2] },
                stato: 'ATTIVA', // Stato ATTIVA per il gruppo
                gruppoSegnalazioni: existingGruppo2Id
            });
            segPerGruppoId3 = seg3._id;
            await GruppoSegnalazioni.findByIdAndUpdate(existingGruppo2Id, { $inc: { numeroSegnalazioni: 1 } });
        });

        /*test('US00X-42: Dovrebbe aggiungere una segnalazione a un gruppo esistente', async () => {
            // Prima creiamo un nuovo gruppo vuoto (o usiamo uno esistente ma non associato)
            const newEmptyGroup = await GruppoSegnalazioni.create({
                nome: "Nuovo Gruppo Vuoto",
                descrizione: "Gruppo da associare",
                numeroSegnalazioni: 0,
                posizione: { type: 'Point', coordinates: [17.3, 52.3] },
            });


            const response = await request(app)
                .patch(`${baseUrl}/segnalazioni/${segPerGruppoId1}/gruppoSegnalazioni`)
                .set('Authorization', `Bearer ${operatorToken}`)
                .send({ gruppoSegnalazioni: newEmptyGroup._id });

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('message', 'Segnalazione aggiunta al gruppo con successo');

            const updatedSegnalazione = await Segnalazione.findById(segPerGruppoId1);
            expect(updatedSegnalazione.gruppoSegnalazioni.toString()).toBe(newEmptyGroup._id.toString());

            const updatedGroup = await GruppoSegnalazioni.findById(newEmptyGroup._id);
            expect(updatedGroup.numeroSegnalazioni).toBe(1);
        });

         */

        /*test('US00X-44: Dovrebbe rimuovere la segnalazione e il gruppo se il gruppo diventa vuoto', async () => {
            // Creiamo un gruppo con una sola segnalazione al suo interno
            const singleSeg = await Segnalazione.create({
                utente: standardUserId,
                categoria: 'ALTRO',
                descrizione: 'Segnalazione in gruppo singolo',
                posizione: { type: 'Point', coordinates: [18.0, 53.0] }
            });

            const singleGroup = await GruppoSegnalazioni.create({
                nome: "Gruppo Singolo",
                numeroSegnalazioni: 1,
                posizione: {type: 'Point', coordinates: [18.1, 53.1]},
            });

            singleSeg.gruppoSegnalazioni = singleGroup._id;
            await singleSeg.save();

            const response = await request(app)
                .patch(`${baseUrl}/segnalazioni/${singleSeg._id}/gruppoSegnalazioni`)
                .set('Authorization', `Bearer ${operatorToken}`)
                .send({ gruppoSegnalazioni: null });

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('message', 'Segnalazione rimossa dal gruppo. Il gruppo è stato eliminato perché vuoto.');

            const updatedSegnalazione = await Segnalazione.findById(singleSeg._id);
            expect(updatedSegnalazione.gruppoSegnalazioni).toBeNull();

            const deletedGroup = await GruppoSegnalazioni.findById(singleGroup._id);
            expect(deletedGroup).toBeNull();
        });

         */

        /*test('US00X-46: Non dovrebbe associare a un gruppo con stato incompatibile (es. segnalazione DA_VERIFICARE a gruppo RISOLTA)', async () => {
            const segDaVerificare = await Segnalazione.create({
                utente: standardUserId,
                categoria: 'OSTACOLO',
                descrizione: 'Segnalazione da verificare',
                posizione: { type: 'Point', coordinates: [19.0, 54.0] },
                stato: 'DA_VERIFICARE'
            });

            const gruppoRisolto = await GruppoSegnalazioni.create({
                nome: "Gruppo Risolto",
                numeroSegnalazioni: 1,
                posizione: { type: 'Point', coordinates: [19.1, 54.1] },
            });
            await Segnalazione.create({ // Aggiungiamo una segnalazione al gruppo per dargli lo stato
                utente: standardUserId,
                categoria: 'ALTRO',
                descrizione: 'Segnalazione nel gruppo risolto',
                posizione: { type: 'Point', coordinates: [19.1, 54.1] },
                stato: 'RISOLTA',
                gruppoSegnalazioni: gruppoRisolto._id
            });
            await GruppoSegnalazioni.findByIdAndUpdate(gruppoRisolto._id, { $inc: { numeroSegnalazioni: 1 } });


            const response = await request(app)
                .patch(`${baseUrl}/segnalazioni/${segDaVerificare._id}/gruppoSegnalazioni`)
                .set('Authorization', `Bearer ${operatorToken}`)
                .send({ gruppoSegnalazioni: gruppoRisolto._id });

            expect(response.statusCode).toBe(400);
            expect(response.body).toHaveProperty('message'); // Messaggio di stato incompatibile
            expect(response.body.message).toContain('Stato non compatibile');
        });


    });
*/

});