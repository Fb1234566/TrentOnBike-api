const mongoose = require('mongoose');

const ImpostazioniUtenteSchema = new mongoose.Schema({
    utente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    lingua: {
        type: String,
        enum: ['it', 'en', 'de'],
        default: 'it'
    },
    tema: {
        type: String,
        enum: ['CHIARO', 'SCURO', 'SISTEMA'],
        default: 'CHIARO'
    },
    notifichePOIVicini: {
        type: Boolean,
        default: true
    }
}, { timestamps: true }); // timestamps aggiunge createdAt e updatedAt

module.exports = mongoose.model('ImpostazioniUtente', ImpostazioniUtenteSchema);