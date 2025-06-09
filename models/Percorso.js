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
    }
}, { timestamps: true });

// Funzione ausiliaria per calcolare la lunghezza del percorso
PercorsoSchema.methods.calcolaLunghezza = async function() {
    try {
        if (this.tappe.length < 2) {
            this.lunghezza = 0;
            return;
        }

        // Popola le tappe se non sono già popolate
        const percorsoPopulated = await mongoose.model('Percorso').findById(this._id)
            .populate('tappe');

        if (!percorsoPopulated || percorsoPopulated.tappe.length < 2) {
            return;
        }

        // Estrai le coordinate
        const coords = percorsoPopulated.tappe.map(tappa =>
            tappa.posizione.join(',')
        );

        // Chiama l'API Mapbox
        const coordinatesString = coords.join(';');
        const response = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordinatesString}?` +
            `geometries=geojson&overview=full&access_token=${process.env.MAPBOX_TOKEN}`
        );

        const data = await response.json();

        // Aggiorna la lunghezza
        if (data.routes && data.routes.length > 0) {
            this.lunghezza = (data.routes[0].distance / 1000).toFixed(1); // Converti da metri a km
        }
    } catch (error) {
        console.error('Errore nel calcolo della lunghezza:', error);
    }
};

// Middleware pre-save
PercorsoSchema.pre('save', async function(next) {
    await this.calcolaLunghezza();
    next();
});

// Middleware post-findOneAndUpdate
PercorsoSchema.post('findOneAndUpdate', async function(doc) {
    if (doc) {
        await doc.calcolaLunghezza();
        await doc.save();
    }
});

// Modifica il metodo addTappa per ricalcolare la lunghezza
PercorsoSchema.methods.addTappa = async function(newTappa) {
    this.tappe.push(newTappa);

    await this.save();

    await this.calcolaLunghezza();

    await this.save();

    return this;
};

const Percorso = mongoose.model('Percorso', PercorsoSchema);
const Tappa = mongoose.model('Tappa', TappaSchema);

module.exports = {
    Percorso,
    Tappa,
};