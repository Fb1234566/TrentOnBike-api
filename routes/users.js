const express = require('express');
const router = express.Router();

/*

Users Routes

*/

/**
 * @swagger
 * users/:
 *  get:
 *      tags:
 *          - Utenti
 *      summary: Get all the users
 *      description: Retrive all users from the db
 */

router.get('/', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({description: "Get all users"}));
});

router.post('/', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({description: "Add a user"}));
});

module.exports = router;