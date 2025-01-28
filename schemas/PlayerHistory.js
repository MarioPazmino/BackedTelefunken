const db = require('../ConexionFirebase/firebase');

const PlayerHistory = db.collection('playerHistory');

module.exports = PlayerHistory;