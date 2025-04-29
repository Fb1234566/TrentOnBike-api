const express = require('express');
const router = express.Router();

/*

PDIs Routes

*/

/**
 * @swagger
 * /:
 *  get:
 *      summary: Get all the users
 *      description: Retrive all users from the db
 */

router.get('/', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ description: "Get all pdis" }));
});

router.post('/', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ description: "Add a pdi" }));
});

module.exports = router;