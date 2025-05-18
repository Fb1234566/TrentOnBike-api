const mongoose = require('mongoose');

const TappaSchema = new mongoose.Schema({
    ordine: {
        type: Number,
        required: true,
    },
    descrizione: {
        type: String,
        required: true,
    },
    posizione: { // EPSG:4326
        type: [Number],
        required: true,
    },
    PuntoDiInteresse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PDI",
        required: true
    }

}, { timestamps: true })

const PercorsoSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["TURISTICO", "SUGGERITO_COMUNE", "UTENTE"], default: "TURISTICO"
    },
    length: {
        type: Number,
        default: 1
    },
    difficulty: {
        type: String,
        enum: ["Facile", "Medio", "Difficile"],
        default: "Facile"
    },
    tappe:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tappa"
    }],
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }
}, { timestamps: true });

PercorsoSchema.methods.addTappa = async function(newTappa){
    this.tappe.push(newTappa);
    this.save();
}

const Percorso = mongoose.model('Percorso', PercorsoSchema);
const Tappa = mongoose.model('Tappa', TappaSchema);

module.exports = {
    Percorso,
    Tappa,
};