const { app, connectToMongoDB } = require('../index');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ImpostazioniUtente = require('../models/ImpostazioniUtente');
const StatisticheUtente = require('../models/StatisticheUtente');

const adminId = '507f1f77bcf86cd799439011';
const standardUserId = '507f191e810c19729de860ea';
const jwtSecret = process.env.JWT_SECRET || 'test_secret';
const baseUrl = process.env.BASE_URL || '/api/v1';

let adminToken;
let standardUserToken;

beforeAll(async () => {
    await connectToMongoDB();

    // Pulisci solo gli utenti di test (e relative impostazioni/statistiche)
    await User.deleteMany({ _id: { $in: [adminId, standardUserId] } });
    await ImpostazioniUtente.deleteMany({ utente: { $in: [adminId, standardUserId] } });
    await StatisticheUtente.deleteMany({ utente: { $in: [adminId, standardUserId] } });

    const admin = await new User({
        _id: adminId,
        email: 'admin@test.com',
        passwordHash: 'hashedpassword',
        nome: 'Admin',
        ruolo: 'admin'
    }).save();

    const standardUser = await new User({
        _id: standardUserId,
        email: 'user@test.com',
        passwordHash: 'hashedpassword',
        nome: 'Standard',
        ruolo: 'utente'
    }).save();

    await new ImpostazioniUtente({ utente: standardUser._id }).save();
    await new StatisticheUtente({ utente: standardUser._id }).save();

    adminToken = jwt.sign({ userId: admin._id, ruolo: 'admin' }, jwtSecret, { expiresIn: '1h' });
    standardUserToken = jwt.sign({ userId: standardUser._id, ruolo: 'utente' }, jwtSecret, { expiresIn: '1h' });
});

afterAll(async () => {
    // Elimina solo gli utenti di test e dati collegati
    await User.deleteMany({ _id: { $in: [adminId, standardUserId] } });
    await ImpostazioniUtente.deleteMany({ utente: { $in: [adminId, standardUserId] } });
    await StatisticheUtente.deleteMany({ utente: { $in: [adminId, standardUserId] } });
});

describe('GET /users/me', () => {
    test('Dovrebbe restituire 401 se non autenticato', async () => {
        const response = await request(app).get(`${baseUrl}/users/me`);
        expect(response.statusCode).toBe(401);
    });

    test("Dovrebbe restituire i dati dell'utente autenticato", async () => {
        const response = await request(app)
            .get(`${baseUrl}/users/me`)
            .set('Authorization', `Bearer ${standardUserToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body._id).toBe(standardUserId);
        expect(response.body.email).toBe('user@test.com');
        expect(response.body).not.toHaveProperty('passwordHash');
        //expect(response.body).toHaveProperty('impostazioni');
        //expect(response.body).toHaveProperty('statistiche');
    });
});

describe('GET /users', () => {
    test('Dovrebbe restituire 401 per accesso non autenticato', async () => {
        const response = await request(app).get(`${baseUrl}/users`);
        expect(response.statusCode).toBe(401);
    });

    test('Dovrebbe restituire 403 per un utente non admin', async () => {
        const response = await request(app)
            .get(`${baseUrl}/users`)
            .set('Authorization', `Bearer ${standardUserToken}`);
        expect(response.statusCode).toBe(403);
    });

    test('Dovrebbe restituire la lista di utenti per un admin', async () => {
        const response = await request(app)
            .get(`${baseUrl}/users`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(2);
        const userEmails = response.body.map(u => u.email);
        expect(userEmails).toContain('admin@test.com');
        expect(userEmails).toContain('user@test.com');
    });

    test('Non dovrebbe implementare filtri non previsti come ?role=', async () => {
        const response = await request(app)
            .get(`${baseUrl}/users?role=admin`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.statusCode).toBe(200);
        expect(response.body.length).toBe(2);
    });
});
