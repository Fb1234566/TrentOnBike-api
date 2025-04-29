// packages imports
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

// routes imports
const userRoutes = require('./routes/users');
const pdiRoutes = require('./routes/pdi');
const percorsoRoutes = require('./routes/percorsi');

// express setup
const app = express();
const port = 3000;

// swagger-ui-express and swagger-jsdoc setup
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'TrentOnBike',
            version: '1.0.0',
        },
        servers: [
            {
                url: "http://127.0.0.1:3000/api/v1/",
                description: "Development server"
            }
        ]
    },
    apis: ['./routes/*.js'], // files containing annotations as above
};
const swaggerDocument = swaggerJsDoc(swaggerOptions);
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// routes
app.use("api/v1/users", userRoutes); // users route
app.use("api/v1/pdi", pdiRoutes); // pdi route
app.use("api/v1/percorsi", percorsoRoutes); // percorso route

app.listen(port, () => {
    console.log(`TrentOnBike API listening on http://localhost:${port}`);
});


