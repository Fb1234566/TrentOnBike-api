const mongoose = require('mongoose');
const PosizioneSchema = require('./schemas/Posizione');

const GruppoSegnalazioniSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: true
    },
    posizione: {
        type: PosizioneSchema,
        required: true
    },
    creatoDa: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    creatoIl: {
        type: Date,
        default: Date.now
    },
    ultimaModificaIl: {
        type: Date,
        default: Date.now
    },
    numeroSegnalazioni: {
        type: Number,
        default: 0
    }
});

GruppoSegnalazioniSchema.index({ 'posizione': '2dsphere' });

module.exports = mongoose.model('GruppoSegnalazioni', GruppoSegnalazioniSchema);