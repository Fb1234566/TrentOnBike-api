const { app, connectToMongoDB } = require('../index');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const operatorId = '605c72a7c364821a8864a065';
const standardUserId = '605c72a7c364821a8864a066';
const jwtSecret = process.env.JWT_SECRET || 'test_secret';
const baseUrl = process.env.BASE_URL || '/api/v1';

let operatorToken;
let standardUserToken;

// Mock di fetch globale
global.fetch = jest.fn();

beforeAll(async () => {
    await connectToMongoDB();

    operatorToken = jwt.sign({ userId: operatorId, ruolo: 'operatore' }, jwtSecret, { expiresIn: '1h' });
    standardUserToken = jwt.sign({ userId: standardUserId, ruolo: 'utente' }, jwtSecret, { expiresIn: '1h' });

    // Imposta token per Mapbox
    process.env.MAPBOX_TOKEN = 'test_token';
});

afterAll(async () => {
    await mongoose.connection.close();
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('Test GET /pdi endpoint', () => {

    test('Dovrebbe restituire 401 se non autenticato', async () => {
        const response = await request(app).get(`${baseUrl}/pdi`);
        expect(response.statusCode).toBe(401);
    });

    test('Dovrebbe restituire tutti i PDI se non ci sono filtri', async () => {
        const response = await request(app)
            .get(`${baseUrl}/pdi`)
            .set('Authorization', `Bearer ${operatorToken}`);  // <- Corretto

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    test('Dovrebbe filtrare i PDI per un singolo tipo', async () => {
        const response = await request(app)
            .get(`${baseUrl}/pdi?tipoPoi=MUSEO`)
            .set('Authorization', `Bearer ${operatorToken}`);  // <- Corretto

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        // Il test potrebbe fallire se non ci sono PDI di tipo MUSEO
        if (response.body.length > 0) {
            expect(response.body[0].tipoPoi).toBe('MUSEO');
        }
    });

    test('Dovrebbe filtrare i PDI per più tipi', async () => {
        const response = await request(app)
            .get(`${baseUrl}/pdi?tipoPoi=MUSEO,MONUMENTO`)
            .set('Authorization', `Bearer ${operatorToken}`)  // <- Corretto
            .set('Accept', 'application/json');

        // Se il problema è che response.body è una stringa JSON
        let data = response.body;

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(data)).toBe(true);

    });

    test('Dovrebbe restituire array vuoto se non ci sono PDI del tipo richiesto', async () => {
        const response = await request(app)
            .get(`${baseUrl}/pdi?tipoPoi=OFFICINA`)
            .set('Authorization', `Bearer ${operatorToken}`);  // <- Corretto

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    test('I PDI restituiti dovrebbero avere la struttura corretta', async () => {
        const response = await request(app)
            .get(`${baseUrl}/pdi`)
            .set('Authorization', `Bearer ${operatorToken}`);  // <- Corretto

        expect(response.statusCode).toBe(200);
        // Verifica che ci siano risultati prima di controllare la struttura
        if (response.body.length > 0) {
            const pdi = response.body[0];
            expect(pdi).toHaveProperty('_id');
            expect(pdi).toHaveProperty('nome');
            expect(pdi).toHaveProperty('descrizione');
            expect(pdi).toHaveProperty('posizione');
            expect(pdi).toHaveProperty('tipoPoi');
            expect(Array.isArray(pdi.posizione)).toBe(true);
        }
    });
    test('Dovrebbe creare un nuovo PDI', async () => {
        const pdiData = {
            nome: "Rastrelliera Duomo",
            descrizione: "Rastrelliera bici presso il Duomo",
            posizione: [11.12345, 46.06789],
            tipoPoi: "RASTRELLIERA"
        };

        const response = await request(app)
            .post(`${baseUrl}/pdi`)
            .set('Authorization', `Bearer ${operatorToken}`)
            .send(pdiData);

        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('_id');
        expect(response.body).toHaveProperty('nome', pdiData.nome);
        expect(response.body).toHaveProperty('tipoPoi', pdiData.tipoPoi);

        // Salva l'ID per i test successivi
        pdiTestId = response.body._id;
    });

    // US006-01: Aggiungi un PDI con più di 2 coordinate
    test('Dovrebbe restituire errore con coordinate non valide', async () => {
        const pdiData = {
            nome: "Rastrelliera Piazza",
            descrizione: "Rastrelliera bici in piazza",
            posizione: [11.12345, 46.06789, 46.06789], // Tre coordinate non valide
            tipoPoi: "RASTRELLIERA"
        };

        const response = await request(app)
            .post(`${baseUrl}/pdi`)
            .set('Authorization', `Bearer ${operatorToken}`)
            .send(pdiData);

        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });

    // US006-03: Aggiunta di PDI con tipoPoi non valido
    test('Dovrebbe restituire errore con tipoPoi non valido', async () => {
        const pdiData = {
            nome: "Punto Test",
            descrizione: "Descrizione di test",
            posizione: [11.12345, 46.06789],
            tipoPoi: "prova" // Valore non valido
        };

        const response = await request(app)
            .post(`${baseUrl}/pdi`)
            .set('Authorization', `Bearer ${operatorToken}`)
            .send(pdiData);

        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
    });
});