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

// mongoose
const mongoose = require('mongoose');
require('dotenv').config();

// express setup
const app = express();
const port = 3000;

//cors
app.use(cors());

//to read json data from the body of the request
app.use(express.json());

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connesso a MongoDB Atlas'))
.catch(err => console.error('Errore connessione:', err));

// swagger-ui-express and swagger-jsdoc setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'TrentOnBike API',
            version: '1.0.0',
        },
        servers: [
            {
                url: `http://localhost:${port}/api/v1/`,
                description: "Development server"
            }
        ],
        components: { // Aggiunto per lo schema di sicurezza JWT
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        },
        security: [{ // Applica la sicurezza a tutte le rotte
            bearerAuth: []
        }]
    },
    apis: ['./routes/*.js'], // Percorso per le annotazioni Swagger
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

app.listen(port, () => {
    console.log(`TrentOnBike API listening on http://localhost:${port}`);
    console.log(`Swagger docs available on http://localhost:${port}/api/v1/docs`);
});