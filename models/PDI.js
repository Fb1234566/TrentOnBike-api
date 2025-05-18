const mongoose = require("mongoose");

const PdiScheda = new mongoose.Schema({
    nome: {
        type: String,
        required: true,
    },
    descrizione: {
        type: String,
        required: true,
    },
    posizione: {
        type: [Number],
        required: true,
        validate: [function (val) {return val.length <=2}, "{PATH} non può avere più di di due elementi"]
    },
    tipoPoi: {
        type: String,
        required: true,
        enum: [
            "RASTRELLIERA",
            "OFFICINA",
            "FONTANELLA",
            "PUNTO_RICARICA",
            "MUSEO",
            "MONUMENTO",
            "LUOGO_STORICO_CULTURALE",
            "ALTRO"
        ]
    }
})

module.exports = mongoose.model("PDI", PdiScheda);