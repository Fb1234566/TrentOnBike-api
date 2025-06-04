const mongoose = require('mongoose');

const RegistroAccessoViaSchema = new mongoose.Schema({
    nomeVia: {
        type: String,
        required: [true, "Il nome della via è obbligatorio."],
        trim: true,
        lowercase: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
}, { timestamps: { createdAt: 'registratoIl', updatedAt: false } });

// Indice composto utile per query sullo storico di una via in un range temporale
RegistroAccessoViaSchema.index({ nomeVia: 1, timestamp: -1 });

/**
 * @swagger
 * components:
 *   schemas:
 *     RegistroAccessoVia:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID univoco del record di accesso.
 *         nomeVia:
 *           type: string
 *           description: Nome normalizzato (lowercase, trimmed) della via percorsa.
 *           example: "via roma"
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Momento in cui il passaggio sulla via è stato registrato.
 *         registratoIl:
 *           type: string
 *           format: date-time
 *           description: Data di creazione del record nel database.
 */
module.exports = mongoose.model('RegistroAccessoVia', RegistroAccessoViaSchema);