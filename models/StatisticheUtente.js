const mongoose = require('mongoose');

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
        ref: 'Percorso' // Bisogna creare un modello Percorso (Filippo)
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
    }
});

const StatisticheUtenteSchema = new mongoose.Schema({
    utente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // Ogni utente ha un solo set di statistiche
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
    sessioni: [SessioneCiclismoSchema], // Array di sotto-documenti
    velocitaMediaGenerale: { // Calcolata su tutte le sessioni
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Metodo per aggiornare le statistiche totali quando si aggiunge una sessione
StatisticheUtenteSchema.methods.aggiornaStatisticheGenerali = function() {
    //se non è presente il dato, di default è 0
    // Calcola il totale dei chilometri
    this.kmTotali = this.sessioni.reduce((acc, curr) => acc + (curr.distanzaKm || 0), 0);

    // Calcola il totale delle calorie bruciate
    this.calorieTotali = this.sessioni.reduce((acc, curr) => acc + (curr.calorieBruciate || 0), 0);

    // Calcola il totale della CO2 risparmiata
    this.co2RisparmiatoTotale = this.sessioni.reduce((acc, curr) => acc + (curr.co2Risparmiato || 0), 0);

    // Filtra le sessioni che hanno una velocità media valida (maggiore di 0)
    const sessioniConVelocita = this.sessioni.filter(s => s.velocitaMedia > 0);

    if (sessioniConVelocita.length > 0) {
        // Calcola la velocità media generale come media aritmetica delle velocità medie
        this.velocitaMediaGenerale = sessioniConVelocita.reduce((acc, curr) => acc + curr.velocitaMedia, 0) / sessioniConVelocita.length;
    } else {
        // Se non ci sono sessioni valide, imposta la velocità media generale a 0
        this.velocitaMediaGenerale = 0;
    }
};


module.exports = mongoose.model('StatisticheUtente', StatisticheUtenteSchema);
