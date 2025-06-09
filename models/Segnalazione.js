const mongoose = require('mongoose');
const PosizioneSchema = require("./schemas/Posizione");

const SegnalazioneSchema = new mongoose.Schema({
    utente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    posizione: {
        type: PosizioneSchema,
        required: true
    },
    categoria: {
        type: String,
        enum: [
            'OSTACOLO',
            'ILLUMINAZIONE_INSUFFICIENTE',
            'PISTA_DANNEGGIATA',
            'SEGNALAZIONE_STRADALE_MANCANTE',
            'ALTRO'
        ],
        required: true
    },
    descrizione: {
        type: String,
        required: false,
        default: null
    },
    stato: {
        type: String,
        enum: ['DA_VERIFICARE', 'ATTIVA', 'RISOLTA', 'SCARTATA'],
        default: 'DA_VERIFICARE'
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
    },
    commento: {
        type: String, // testo libero inserito dall'operatore
        default: null
    },
    gruppoSegnalazioni: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GruppoSegnalazioni',
        default: null
    }
});

SegnalazioneSchema.index({ posizione: '2dsphere' });

module.exports = mongoose.model('Segnalazione', SegnalazioneSchema);