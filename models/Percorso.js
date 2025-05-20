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
        validate: [function (val) {return val.length <=2}, "{PATH} non può avere più di di due elementi"]
    },
    puntoDiInteresse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PDI",
        required: true
    }

}, { timestamps: true })

const PercorsoSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: true
    },
    descrizione: {
        type: String,
        required: true
    },
    tipo: {
        type: String,
        enum: ["TURISTICO", "SUGGERITO_COMUNE", "UTENTE"],
        default: "TURISTICO"
    },
    lunghezza: {
        type: Number,
        default: 1
    },
    difficolta: {
        type: String,
        enum: ["Facile", "Medio", "Difficile"],
        default: "Facile"
    },
    tappe:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tappa"
    }],
    createdBy: {
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