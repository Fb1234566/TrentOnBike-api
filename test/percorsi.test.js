const { app, connectToMongoDB } = require('../index');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Parametri di configurazione
const operatorId = '605c72a7c364821a8864a065';
const standardUserId = '605c72a7c364821a8864a066';
const jwtSecret = process.env.JWT_SECRET || 'test_secret';
const baseUrl = process.env.BASE_URL || '/api/v1';

// Token di autenticazione
let operatorToken;
let standardUserToken;

// Id di test per le operazioni
let percorsoTestId;

beforeAll(async () => {
    await connectToMongoDB();

    // Crea token per i test
    operatorToken = jwt.sign({ userId: operatorId, ruolo: 'operatore' }, jwtSecret, { expiresIn: '1h' });
    standardUserToken = jwt.sign({ userId: standardUserId, ruolo: 'utente' }, jwtSecret, { expiresIn: '1h' });
});

afterAll(async () => {
    await mongoose.connection.close();
});

describe('Test Percorsi', () => {
    // US003-01: Aggiunta di un nuovo Percorso
    test('Dovrebbe creare un nuovo percorso', async () => {
        const percorsoData = {
            nome: "Castello Buon Consiglio",
            descrizione: "Il percorso termina al castello del buon consiglio",
            tipo: "TURISTICO",
            difficolta: "Facile"
        };

        const response = await request(app)
            .post(`${baseUrl}/percorsi`)
            .set('Authorization', `Bearer ${operatorToken}`)
            .send(percorsoData);

        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('_id');
        expect(response.body).toHaveProperty('nome', percorsoData.nome);
        expect(response.body).toHaveProperty('tipo', percorsoData.tipo);
        expect(response.body).toHaveProperty('tappe');

        // Salva l'ID per i test successivi
        percorsoTestId = response.body._id;
    });

    // US003-05: Aggiunta di un percorso con difficoltà non valida
    test('Dovrebbe restituire errore con difficoltà non valida', async () => {
        const percorsoData = {
            nome: "Castello Buon Consiglio",
            descrizione: "Il percorso termina al castello del buon consiglio",
            tipo: "TURISTICO",
            lunghezza: -100000000,
            difficolta: "Prova" // Valore non valido
        };

        const response = await request(app)
            .post(`${baseUrl}/percorsi`)
            .set('Authorization', `Bearer ${operatorToken}`)
            .send(percorsoData);

        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });

    // US003-06: Aggiunta di un percorso con tipo non valido
    test('Dovrebbe restituire errore con tipo non valido', async () => {
        const percorsoData = {
            nome: "Castello Buon Consiglio",
            descrizione: "Il percorso termina al castello del buon consiglio",
            tipo: "prova", // Valore non valido
            lunghezza: -100000000,
            difficolta: "Facile"
        };

        const response = await request(app)
            .post(`${baseUrl}/percorsi`)
            .set('Authorization', `Bearer ${operatorToken}`)
            .send(percorsoData);

        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });

    // US003-03: Aggiunta di una tappa con 3 coordinate
    test('Dovrebbe restituire errore con coordinate non valide', async () => {
        // Creiamo un percorso dedicato per questo test
        const percorsoData = {
            nome: "Percorso test coordinate",
            descrizione: "Test coordinate",
            tipo: "TURISTICO",
            difficolta: "Facile"
        };

        const percorsoResponse = await request(app)
            .post(`${baseUrl}/percorsi`)
            .set('Authorization', `Bearer ${operatorToken}`)
            .send(percorsoData);

        expect(percorsoResponse.statusCode).toBe(201);
        // Prima creiamo un punto di interesse valido per la tappa
        const pdiData = {
            nome: "Punto di riferimento test",
            descrizione: "Punto per test coordinate",
            posizione: [11.12345, 46.06789],
            tipoPoi: "RASTRELLIERA"
        };

        const pdiResponse = await request(app)
            .post(`${baseUrl}/pdi`)
            .set('Authorization', `Bearer ${operatorToken}`)
            .send(pdiData);

        expect(pdiResponse.statusCode).toBe(201);

        // Testiamo l'aggiunta di tappa con coordinate non valide
        const tappaData = {
            ordine: 1,
            descrizione: "Tappa test",
            posizione: [11.12345, 46.06789, 46.06789], // Tre coordinate (non valido)
            puntoDiInteresse: pdiResponse.body._id // Punto di interesse valido
        };

        const response = await request(app)
            .post(`${baseUrl}/percorsi/${percorsoResponse.body._id}/tappa`)
            .set('Authorization', `Bearer ${operatorToken}`)
            .send(tappaData);

        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });

    test('Dovrebbe restituire errore con PDI inesistente', async () => {
        // Creiamo un percorso dedicato per questo test
        const percorsoData = {
            nome: "Percorso test PDI",
            descrizione: "Test PDI inesistente",
            tipo: "TURISTICO",
            difficolta: "Facile"
        };

        const percorsoResponse = await request(app)
            .post(`${baseUrl}/percorsi`)
            .set('Authorization', `Bearer ${operatorToken}`)
            .send(percorsoData);


        // Testiamo l'aggiunta di tappa con PDI inesistente
        const tappaData = {
            ordine: 1,
            descrizione: "Tappa test",
            posizione: [11.12345, 46.06789],
            puntoDiInteresse: "000000000000000000000000" // ID valido ma inesistente (24 zeri)
        };

        const response = await request(app)
            .post(`${baseUrl}/percorsi/${percorsoResponse.body._id}/tappa`)
            .set('Authorization', `Bearer ${operatorToken}`)
            .send(tappaData);

        expect(response.statusCode).toBe(400);
        console.log(response.body);
        expect(response.body).toHaveProperty('error');
    });

    // US003-02: Cancellazione di un percorso
    test('Dovrebbe cancellare un percorso esistente', async () => {
        const response = await request(app)
            .delete(`${baseUrl}/percorsi/${percorsoTestId}`)
            .set('Authorization', `Bearer ${operatorToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('_id', percorsoTestId);
    });

    test('US003-02: Dovrebbe restituire 404 per percorso non esistente', async () => {
        const response = await request(app)
            .delete(`${baseUrl}/percorsi/605c72a7c364821a8864a999`) // ID non esistente
            .set('Authorization', `Bearer ${operatorToken}`);

        expect(response.statusCode).toBe(404);
    });
});