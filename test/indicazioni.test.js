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

describe('GET /indicazioni/route', () => {
    test('Dovrebbe restituire indicazioni stradali con coordinate valide', async () => {
        // Mock risposta Mapbox
        const mockMapboxResponse = {
            routes: [{ geometry: { coordinates: [[1, 2], [3, 4]] } }]
        };

        global.fetch.mockResolvedValueOnce({
            json: jest.fn().mockResolvedValueOnce(mockMapboxResponse)
        });

        const response = await request(app)
            .get(`${baseUrl}/indicazioni/route`)
            .set('Authorization', `Bearer ${standardUserToken}`)
            .query({ coord: ['1,2', '3,4'] });

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(mockMapboxResponse);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('1,2;3,4'));
    });

    test('Dovrebbe restituire errore 400 quando le coordinate sono mancanti', async () => {
        const response = await request(app)
            .get(`${baseUrl}/indicazioni/route`)
            .set('Authorization', `Bearer ${standardUserToken}`);

        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('Dovrebbe restituire errore 400 quando ci sono meno di 2 coordinate', async () => {
        const response = await request(app)
            .get(`${baseUrl}/indicazioni/route`)
            .set('Authorization', `Bearer ${standardUserToken}`)
            .query({ coord: ['1,2'] });

        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('Dovrebbe restituire errore 400 quando il formato delle coordinate è errato', async () => {
        const response = await request(app)
            .get(`${baseUrl}/indicazioni/route`)
            .set('Authorization', `Bearer ${standardUserToken}`)
            .query({ coord: ['1,2', 'invalid'] });

        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('Dovrebbe restituire errore 401 quando il token è mancante', async () => {
        const response = await request(app)
            .get(`${baseUrl}/indicazioni/route`)
            .query({ coord: ['1,2', '3,4'] });

        expect(response.statusCode).toBe(401);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('Dovrebbe restituire errore 403 quando il token non è valido', async () => {
        const response = await request(app)
            .get(`${baseUrl}/indicazioni/route`)
            .set('Authorization', 'Bearer token_non_valido')
            .query({ coord: ['1,2', '3,4'] });

        expect(response.statusCode).toBe(403);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('Dovrebbe gestire errori dall\'API Mapbox', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Errore API'));

        const response = await request(app)
            .get(`${baseUrl}/indicazioni/route`)
            .set('Authorization', `Bearer ${standardUserToken}`)
            .query({ coord: ['1,2', '3,4'] });

        expect(response.statusCode).toBe(500);
        expect(response.body).toHaveProperty('error');
    });
});