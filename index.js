// packages imports
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const cors = require('cors');

// routes imports
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const pdiRoutes = require('./routes/pdi');
const percorsoRoutes = require('./routes/percorsi');
const segnalazioniRoutes = require('./routes/segnalazioni');
const gruppiSegnalazioniRoutes = require('./routes/gruppiSegnalazioni');
const statisticheVieRoutes = require('./routes/statisticheVie');

// mongoose
const mongoose = require('mongoose');
require('dotenv').config();

// express setup
const app = express();
const port = process.env.PORT || 3000; // Usa la porta da .env o default 3000

//cors
app.use(cors());

//to read json data from the body of the request
app.use(express.json());

// Connect to MongoDB Atlas
const connectToMongoDB = async () => {
    try{
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI non definita nel file .env");
        }
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
            // useCreateIndex e useFindAndModify non sono più necessari con le versioni recenti di Mongoose
        });
        console.log('Connesso a MongoDB Atlas');
    }
    catch (error) {
    console.error('Errore connessione a MongoDB:', error);
    // Potrebbe essere utile terminare il processo se la connessione al DB fallisce all'avvio
    process.exit(1);
    }
}

// swagger-ui-express and swagger-jsdoc setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'TrentOnBike API',
            version: '1.0.0',
            description: 'API per la gestione di percorsi ciclabili, punti di interesse, segnalazioni e statistiche per TrentOnBike.',
        },
        servers: [
            {
                url: `http://localhost:${port}/api/v1/`,
                description: "Development server"
            }
            // Aggiungere altri server (staging, production) se necessario
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Inserire il token JWT preceduto da "Bearer ". Es: "Bearer {token}"'
                }
            }
            // Gli schemi dei modelli verranno inclusi automaticamente se si usa JSDoc nei file dei modelli
        },
        security: [{ // Applica la sicurezza JWT a tutte le rotte globalmente
            bearerAuth: []
        }]
        // È possibile specificare la sicurezza a livello di singola rotta o tag per maggiore granularità
    },
    apis: ['./routes/*.js', './models/*.js'], // Percorso per le annotazioni Swagger (anche nei modelli)
};
const swaggerDocument = swaggerJsDoc(swaggerOptions);
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/pdi", pdiRoutes);
app.use("/api/v1/percorsi", percorsoRoutes);
app.use('/api/v1/segnalazioni', segnalazioniRoutes);
app.use('/api/v1/gruppiSegnalazioni', gruppiSegnalazioniRoutes);
app.use('/api/v1/statisticheVie', statisticheVieRoutes); // NUOVA ROUTE AGGIUNTA

// Gestione errori centralizzata (opzionale ma consigliata per produzione)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Qualcosa è andato storto sul server!');
});


// Avvia il server solo se questo file viene eseguito direttamente
if (require.main === module) {
    connectToMongoDB().then(() => {
        app.listen(port, () => {
            console.log(`TrentOnBike API listening on http://localhost:${port}`);
            console.log(`Swagger docs available on http://localhost:${port}/api/v1/docs`);
        });
    });
}

module.exports = {app, connectToMongoDB}; // Export della app per i test