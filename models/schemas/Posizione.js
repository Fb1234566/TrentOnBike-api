const mongoose = require('mongoose');

const PosizioneSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
    },
    coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
    },
    via: {
        type: String // via stimata o inserita
    }
}, { _id: false });

module.exports = PosizioneSchema;

//TODO: Per calcolo della via in automatico, creare un middleware o una funzione di supporto che chiama Nominatim/OpenStreetMap
// Aggiungerla nel POST o fare un batch che aggiorna tutte le segnalazioni esistenti