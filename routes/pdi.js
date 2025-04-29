const express = require('express');
const router = express.Router();

/*

PDIs Routes

*/

/**
 * @swagger
 * /pdi/:
 *  get:
 *      tags:
 *          - Punti di Interesse
 *      summary: Get all the pdi
 *      description: Retrive all pdi from the db
 */

router.get('/', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({description: "Get all pdis"}));
});

router.post('/', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({description: "Add a pdi"}));
});

module.exports = router;