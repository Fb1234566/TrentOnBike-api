function authorizeRole(allowedRoles) {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.ruolo)) {
            return res.status(403).json({ message: 'Accesso vietato: ruolo non autorizzato.' });
        }
        next();
    };
}

module.exports = authorizeRole;

//funzione controlla se ruolo dell'utente appartiene a lista di ruoli permessi "allowedRoles"
//da utilizzare negli endpoint per limitare l'accesso a determinate categorie di utenti

/* ESEMPIO:
const authorizeRole = require('../middleware/authorizeRole');
// Solo gli operatori del Comune possono aggiornare lo stato di una segnalazione
router.put('/segnalazioni/:id/stato', authenticateToken, authorizeRole(['operator']), async (req, res) => {...
*/