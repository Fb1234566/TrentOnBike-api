const mongoose = require('mongoose');

const SegnalazioneSchema = new mongoose.Schema({
    utente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    posizione: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    categoria: {
        type: String,
        enum: ['BUCA', 'PISTA_DANNEGGIATA', 'SEGNALAZIONE_STRADALE_MANCANTE', 'ALTRO'],
        required: true
    },
    descrizione: {
        type: String,
        required: true
    },
    stato: {
        type: String,
        enum: ['ATTIVA', 'RISOLTA', 'SCARTATA'],
        default: 'ATTIVA'
    },
    creataIl: {
        type: Date,
        default: Date.now
    },
    ultimaModificaIl: {
        type: Date,
        default: Date.now
    },
    lettaDalComune: {
        type: Boolean,
        default: false
    }
});

SegnalazioneSchema.index({ posizione: '2dsphere' });

module.exports = mongoose.model('Segnalazione', SegnalazioneSchema);