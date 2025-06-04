const mongoose = require('mongoose');

const ViaPercorsaSchema = new mongoose.Schema({
    nomeVia: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    timestampIngresso: { // Momento in cui l'utente è entrato nella via durante la sessione
        type: Date,
        required: true
    }
    // Si potrebbe aggiungere timestampUscita, durataPermanenza, ecc.
}, { _id: false });


const SessioneCiclismoSchema = new mongoose.Schema({
    dataOraInizio: {
        type: Date,
        required: true,
        default: Date.now
    },
    dataOraFine: {
        type: Date
    },
    distanzaKm: {
        type: Number,
        default: 0
    },
    percorsoEffettuato: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Percorso'
    },
    velocitaMedia: { // km/h
        type: Number,
        default: 0
    },
    calorieBruciate: {
        type: Number,
        default: 0
    },
    co2Risparmiato: {
        type: Number,
        default: 0
    },
    viePercorse: { // NUOVO CAMPO OPZIONALE
        type: [ViaPercorsaSchema],
        default: undefined // Per non salvarlo se non fornito
    }
});

const StatisticheUtenteSchema = new mongoose.Schema({
    utente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    kmTotali: {
        type: Number,
        default: 0
    },
    calorieTotali: {
        type: Number,
        default: 0
    },
    co2RisparmiatoTotale: {
        type: Number,
        default: 0
    },
    sessioni: [SessioneCiclismoSchema],
    velocitaMediaGenerale: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

StatisticheUtenteSchema.methods.aggiornaStatisticheGenerali = function() {
    this.kmTotali = this.sessioni.reduce((acc, curr) => acc + (curr.distanzaKm || 0), 0);
    this.calorieTotali = this.sessioni.reduce((acc, curr) => acc + (curr.calorieBruciate || 0), 0);
    this.co2RisparmiatoTotale = this.sessioni.reduce((acc, curr) => acc + (curr.co2Risparmiato || 0), 0);

    const sessioniConVelocita = this.sessioni.filter(s => s.velocitaMedia && s.velocitaMedia > 0);

    if (sessioniConVelocita.length > 0) {
        this.velocitaMediaGenerale = sessioniConVelocita.reduce((acc, curr) => acc + curr.velocitaMedia, 0) / sessioniConVelocita.length;
    } else {
        this.velocitaMediaGenerale = 0;
    }
};


module.exports = mongoose.model('StatisticheUtente', StatisticheUtenteSchema);