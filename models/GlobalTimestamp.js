const mongoose = require('mongoose');

// Enum per le chiavi valide (timestamp globali accettati)
const VALID_KEYS = Object.freeze({
    LAST_REPORTS_UPDATE: 'lastReportsUpdate', // Timestamp per l'ultima modifica dei report
});

// Modello per memorizzare timestamp globali
const TimestampsSchema = new mongoose.Schema({
    key: {
        type: String,
        unique: true,
        required: true,
        enum: Object.values(VALID_KEYS), // Verifica che la chiave appartenga alle chiavi valide
    },
    value: {
        type: Date,
        required: true, // Il valore deve essere una data
    },
});

// Controlla se il modello esiste già, altrimenti lo crea
const Timestamps = mongoose.models.Timestamps || mongoose.model('Timestamps', TimestampsSchema);


// Funzione per assicurare che la chiave appartenga all'enum definito
function validateKey(key) {
    if (!Object.values(VALID_KEYS).includes(key)) {
        throw new Error(`La chiave '${key}' non è valida. Le chiavi valide sono: ${Object.values(VALID_KEYS).join(', ')}`);
    }
}

// Funzione per inizializzare chiavi di timestamp nel database (solo se non presenti)
async function initGlobalTimestamp() {
    try {
        // Mappa le chiavi valide dell'enum con un valore di default (data corrente)
        const defaults = Object.fromEntries(
            Object.values(VALID_KEYS).map((key) => [key, new Date()])
        );

        // Itera su ogni chiave di default e la salva nel database solo se non esiste
        for (const [key, defaultValue] of Object.entries(defaults)) {
            // Verifica se la chiave è già presente nel database
            let timestamp = await Timestamps.findOne({ key });
            if (!timestamp) {
                timestamp = new Timestamps({ key, value: defaultValue });
                await timestamp.save();
                console.log(`Timestamp '${key}' inizializzato con valore: ${defaultValue}`);
            } else {
                console.log(`Timestamp '${key}' già presente nel database, nessuna inizializzazione necessaria.`);
            }
        }
        console.log('Inizializzazione dei timestamp globali completata.');
    } catch (error) {
        console.error('Errore durante l\'inizializzazione dei timestamp globali:', error.message);
        throw error; // Lancia un errore se qualcosa va storto
    }
}

// Funzione per aggiornare un timestamp globale
async function updateGlobalTimestamp(key) {
    validateKey(key); // Verifica che la chiave sia valida
    const timestamp = await Timestamps.findOne({ key });
    if (!timestamp) {
        throw new Error(`La chiave '${key}' non esiste nel database.`); // Non crea un nuovo timestamp
    }

    const currentTime = new Date();
    // Aggiorna solo se la data corrente è più recente
    if (currentTime > timestamp.value) {
        timestamp.value = currentTime;
        await timestamp.save();
    }
    return timestamp.value; // Restituisce il valore aggiornato
}

// Funzione per ottenere il valore di un timestamp globale
async function getGlobalTimestamp(key) {
    validateKey(key); // Verifica che la chiave sia valida
    const timestamp = await Timestamps.findOne({ key });
    return timestamp ? timestamp.value : null; // Ritorna null se il timestamp non esiste
}

module.exports = {
    Timestamps,
    VALID_KEYS,
    initGlobalTimestamp,
    updateGlobalTimestamp,
    getGlobalTimestamp,
};