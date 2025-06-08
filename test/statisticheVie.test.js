const { app, connectToMongoDB } = require('../index');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const RegistroAccessoVia = require('../models/RegistroAccessoVia');

const operatorId = '605c72a7c364821a8864a065';
const standardUserId = '605c72a7c364821a8864a066';
const jwtSecret = process.env.JWT_SECRET || 'test_secret';
const baseUrl = process.env.BASE_URL || '/api/v1';

let operatorToken;
let standardUserToken;

beforeAll(async () => {
    await connectToMongoDB();
    await RegistroAccessoVia.deleteMany({});

    operatorToken = jwt.sign({ userId: operatorId, ruolo: 'operatore' }, jwtSecret, { expiresIn: '1h' });
    standardUserToken = jwt.sign({ userId: standardUserId, ruolo: 'utente' }, jwtSecret, { expiresIn: '1h' });

    await RegistroAccessoVia.insertMany([
        { nomeVia: 'via belenzani', timestamp: new Date('2023-10-27T10:00:00.000Z') },
        { nomeVia: 'via belenzani', timestamp: new Date('2023-10-27T11:00:00.000Z') },
        { nomeVia: 'piazza duomo', timestamp: new Date('2023-10-27T10:30:00.000Z') },
        { nomeVia: 'via belenzani', timestamp: new Date('2023-10-28T12:00:00.000Z') },
    ]);
});

afterAll(async () => {
    await RegistroAccessoVia.deleteMany({});
});

describe('POST /statisticheVie/registraPassaggio', () => {
    test('Dovrebbe restituire 401 se non autenticato', async () => {
        const response = await request(app)
            .post(`${baseUrl}/statisticheVie/registraPassaggio`)
            .send({ nomeVia: 'Via del Test' });

        expect(response.statusCode).toBe(401);
    });

    test('Dovrebbe restituire 400 se nomeVia manca', async () => {
        const response = await request(app)
            .post(`${baseUrl}/statisticheVie/registraPassaggio`)
            .set('Authorization', `Bearer ${standardUserToken}`)
            .send({});

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toContain('obbligatorio');
    });

    test('Dovrebbe registrare un passaggio con successo per un utente autenticato', async () => {
        const nomeVia = 'Via Nuova Prova';
        const response = await request(app)
            .post(`${baseUrl}/statisticheVie/registraPassaggio`)
            .set('Authorization', `Bearer ${standardUserToken}`)
            .send({ nomeVia: nomeVia });

        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('_id');
        expect(response.body.nomeVia).toBe(nomeVia.toLowerCase());
    });
});

describe('GET /statisticheVie/storico', () => {
    test('Dovrebbe restituire 401 se non autenticato', async () => {
        const response = await request(app).get(`${baseUrl}/statisticheVie/storico`);
        expect(response.statusCode).toBe(401);
    });

    test('Dovrebbe restituire 403 per un utente con ruolo non autorizzato', async () => {
        const response = await request(app)
            .get(`${baseUrl}/statisticheVie/storico`)
            .set('Authorization', `Bearer ${standardUserToken}`);

        expect(response.statusCode).toBe(403);
    });

    test('Dovrebbe restituire le statistiche aggregate per un operatore', async () => {
        const response = await request(app)
            .get(`${baseUrl}/statisticheVie/storico`)
            .set('Authorization', `Bearer ${operatorToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('currentPage');
        expect(response.body).toHaveProperty('totalPages');
        expect(response.body).toHaveProperty('totalRecords');
        expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('Dovrebbe raggruppare per "via" correttamente', async () => {
        const response = await request(app)
            .get(`${baseUrl}/statisticheVie/storico?groupBy=via`)
            .set('Authorization', `Bearer ${operatorToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);

        const viaBelenzani = response.body.data.find(item => item.nomeVia === 'via belenzani');
        expect(viaBelenzani).toBeDefined();
        expect(viaBelenzani.conteggio).toBe(3);
    });

    test('Dovrebbe filtrare per "nomeVia" correttamente', async () => {
        const response = await request(app)
            .get(`${baseUrl}/statisticheVie/storico?groupBy=via&nomeVia=piazza duomo`)
            .set('Authorization', `Bearer ${operatorToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.data.length).toBe(1);
        expect(response.body.data[0].nomeVia).toBe('piazza duomo');
        expect(response.body.data[0].conteggio).toBe(1);
    });

    test('Dovrebbe filtrare per intervallo di date correttamente', async () => {
        const response = await request(app)
            .get(`${baseUrl}/statisticheVie/storico?dataInizio=2023-10-28T00:00:00.000Z&dataFine=2023-10-28T23:59:59.999Z`)
            .set('Authorization', `Bearer ${operatorToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.totalRecords).toBe(1);
        expect(response.body.data[0].nomeVia).toBe('via belenzani');
        expect(response.body.data[0].conteggio).toBe(1);
    });

    test('Dovrebbe restituire 400 per un valore di groupBy non valido', async () => {
        const response = await request(app)
            .get(`${baseUrl}/statisticheVie/storico?groupBy=anno`)
            .set('Authorization', `Bearer ${operatorToken}`);

        expect(response.statusCode).toBe(400);
    });
});
