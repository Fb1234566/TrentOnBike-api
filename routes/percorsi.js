const express = require('express');
const router = express.Router();

/*

Percorsi Routes

*/

/**
 * @swagger
 * /percorsi/:
 *  get:
 *      tags:
 *          - Percorsi
 *      summary: Get all the percorsi
 *      description: Retrive all percorsi from the db
 */
router.get('/', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({description: "Get all percorsi"}));
});

router.post('/', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({description: "Add a percorso"}));
});

module.exports = router;