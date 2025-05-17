const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Per hashing password

const UserSchema = new mongoose.Schema({
    // idUtente è _id di Mongoose
    email: {
        type: String,
        required: [true, "L'email è obbligatoria"],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, "L'email non è valida"]
    },
    passwordHash: {
        type: String,
        required: [true, "La password è obbligatoria"]
    },
    nome: {
        type: String,
        trim: true
    },
    cognome: {
        type: String,
        trim: true
    },

    statistiche: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StatisticheUtente'
    },
    impostazioni: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ImpostazioniUtente'
    },
    ruolo: { // Serve per controllo dei ruoli
        type: String,
        enum: ['utente', 'operatore', 'admin'],
        default: 'utente'
    }

}, { timestamps: true }); // timestamps aggiunge createdAt e updatedAt

// Pre-save hook per hashare la password prima di salvarla
//next() serve per passare al prossimo middleware
UserSchema.pre('save', async function(next) {
    if (!this.isModified('passwordHash')) { // Solo se la password è cambiata o nuova
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Metodo per confrontare la password fornita con quella hashata nel DB
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('User', UserSchema);