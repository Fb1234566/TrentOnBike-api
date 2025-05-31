const { app, connectToMongoDB } = require('../index');
const request = require('supertest');
const mongoose = require('mongoose');

// Connetti al database prima di tutti i test
beforeAll(async () => {
    await connectToMongoDB();
});

// Disconnetti dopo tutti i test
afterAll(async () => {
    await mongoose.connection.close();
});

describe('Tests Percorsi', () => {
    // test('GET / dovrebbe rispondere con 200', async () => {
    //     const response = await request(app).get('/');
    //     expect(response.statusCode).toBe(200);
    // });
    //
    // test('POST /api/utenti dovrebbe creare un nuovo utente', async () => {
    //     const response = await request(app)
    //         .post('/api/utenti')
    //         .send({
    //             nome: 'Test',
    //             email: 'test@example.com',
    //             password: 'password123'
    //         });
    //     expect(response.statusCode).toBe(201);
    //     expect(response.body).toHaveProperty('_id');
    // });
});