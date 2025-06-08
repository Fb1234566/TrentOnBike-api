const { app, connectToMongoDB } = require('../index');
const request = require('supertest');
const jwt = require('jsonwebtoken');
// Determina i dati utente in base all'ambiente
const userId = process.env.TEST_USER_ID;
const jwtSecret = process.env.JWT_SECRET;
const baseUrl = process.env.BASE_URL;

// Token di autenticazione per i test
let authToken;

// Setup prima di tutti i test
beforeAll(async () => {
    await connectToMongoDB();
    // Creazione token di test
    authToken = jwt.sign( {email: userId},
        jwtSecret, {expiresIn: 86400} ); // create a valid token
    // Rimuovi tutti i PDI esistenti
});


describe('Test GET /pdi endpoint', () => {

    test('Dovrebbe restituire 401 se non autenticato', async () => {
        const response = await request(app).get(`${baseUrl}/pdi`);
        expect(response.statusCode).toBe(401);
    });

    test('Dovrebbe restituire tutti i PDI se non ci sono filtri', async () => {
        const response = await request(app)
            .get(`${baseUrl}/pdi`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    test('Dovrebbe filtrare i PDI per un singolo tipo', async () => {
        const response = await request(app)
            .get(`${baseUrl}/pdi?tipoPoi=MUSEO`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body[0].tipoPoi).toBe('MUSEO');
    });

    test('Dovrebbe filtrare i PDI per più tipi', async () => {
        const response = await request(app)
            .get(`${baseUrl}/pdi?tipoPoi=MUSEO,MONUMENTO`)
            .set('Authorization', `Bearer ${authToken}`)
            .set('Accept', 'application/json');

        // Se il problema è che response.body è una stringa JSON
        let data = response.body;

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(data)).toBe(true);

    });

    test('Dovrebbe restituire array vuoto se non ci sono PDI del tipo richiesto', async () => {
        const response = await request(app)
            .get(`${baseUrl}/pdi?tipoPoi=OFFICINA`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    test('I PDI restituiti dovrebbero avere la struttura corretta', async () => {
        const response = await request(app)
            .get(`${baseUrl}/pdi`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.statusCode).toBe(200);
        const pdi = response.body[0];

        expect(pdi).toHaveProperty('_id');
        expect(pdi).toHaveProperty('nome');
        expect(pdi).toHaveProperty('descrizione');
        expect(pdi).toHaveProperty('posizione');
        expect(pdi).toHaveProperty('tipoPoi');
        expect(Array.isArray(pdi.posizione)).toBe(true);
    });
});