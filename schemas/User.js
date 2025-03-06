// schemas/User.js
const { admin, db, FieldValue } = require('./../ConexionFirebase/firebase');
const User = db.collection('users'); // Representa la colección "users"

module.exports = User;