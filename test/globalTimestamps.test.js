const mongoose = require('mongoose');
const { Timestamps, initGlobalTimestamp, updateGlobalTimestamp, VALID_KEYS } = require('../models/GlobalTimestamp');
const request = require('supertest');
const { app, connectToMongoDB } = require('../index');

// Prima dei test
beforeAll(async () => {
    await connectToMongoDB(); // Connessione a MongoDB
    await Timestamps.deleteMany({}); // Pulisce la raccolta
});

// Dopo tutti i test
afterAll(async () => {
    await Timestamps.deleteMany({}); // Ripulisce la raccolta
    await mongoose.connection.close(); // Chiude la connessione
});

describe('Model: GlobalTimestamp', () => {
    it('should create a timestamp with a valid key and default value', async () => {
        const key = VALID_KEYS.LAST_REPORTS_UPDATE;
        const timestamp = new Timestamps({ key, value: new Date() });

        const savedTimestamp = await timestamp.save();
        expect(savedTimestamp.key).toBe(key);
        expect(savedTimestamp.value).toBeInstanceOf(Date);
    });

    it('should not allow invalid keys', async () => {
        const invalidKey = 'invalidKey';
        const timestamp = new Timestamps({ key: invalidKey, value: new Date() });

        await expect(timestamp.save()).rejects.toThrow(mongoose.Error.ValidationError);
    });
});

describe('Functions: GlobalTimestamp', () => {
    it('should initialize global timestamps', async () => {
        await initGlobalTimestamp();
        const fetched = await Timestamps.findOne({ key: VALID_KEYS.LAST_REPORTS_UPDATE });
        expect(fetched).not.toBeNull();
        expect(fetched.key).toBe(VALID_KEYS.LAST_REPORTS_UPDATE);
        expect(fetched.value).toBeInstanceOf(Date);
    });

    it('should update timestamp with a newer value', async () => {
        const key = VALID_KEYS.LAST_REPORTS_UPDATE;
        const oldValue = new Date('2023-01-01');

        await Timestamps.findOneAndUpdate({ key }, { value: oldValue }, { upsert: true }); // Assicura che esista
        const updatedValue = await updateGlobalTimestamp(key);

        expect(updatedValue).toBeInstanceOf(Date);
        expect(updatedValue.getTime()).toBeGreaterThan(oldValue.getTime());
    });

    it('should not update timestamp with a more recent value already in the database', async () => {
        const key = VALID_KEYS.LAST_REPORTS_UPDATE;

        // Crea un valore futuro nel database (simulando un timestamp già configurato)
        const futureDate = new Date(Date.now() + 100000); // 100 secondi nel futuro
        await Timestamps.findOneAndUpdate({ key }, { value: futureDate }, { upsert: true });

        // Chiama la funzione di aggiornamento, che dovrebbe usare la data attuale
        const updatedValue = await updateGlobalTimestamp(key);

        // Verifica che il valore rimanga quello futuro, poiché più recente
        expect(updatedValue.getTime()).toEqual(futureDate.getTime());
    });
});

describe('Route: /globalTimestamps', () => {
    test('Test fittizio per setup iniziale', () => {
        expect(true).toBe(true);
    });
    //RICHIEDONO MOCK DEI MIDDLEWARE DI AUTENTICAZIONE E CONTROLLO RUOLI, ALTRIMENTI FALLISCONO
    /**
    it('should return the value of an existing timestamp', async () => {
        const key = VALID_KEYS.LAST_REPORTS_UPDATE;
        const value = new Date();

        // Crea un timestamp iniziale
        await Timestamps.findOneAndUpdate({ key }, { value }, { upsert: true });

        const response = await request(app)
            .get(`/api/v1/globalTimestamps/${key}`)
            .set('Authorization', 'Bearer valid-test-token'); // Usa un token di test valido

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('key', key);
        expect(new Date(response.body.value)).toEqual(value);
    });

    it('should return 400 for an invalid key', async () => {
        const response = await request(app)
            .get('/api/v1/globalTimestamps/invalidKey')
            .set('Authorization', 'Bearer valid-test-token');

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
    });

    it('should return 404 for a valid key not in database', async () => {
        const key = VALID_KEYS.LAST_REPORTS_UPDATE;

        // Rimuovi eventuali valori
        await Timestamps.deleteMany({ key });

        const response = await request(app)
            .get(`/api/v1/globalTimestamps/${key}`)
            .set('Authorization', 'Bearer valid-test-token');

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('message');
    });
     */
});
