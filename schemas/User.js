// schemas/User.js
const admin = require('firebase-admin');
const db = admin.firestore();

const User = db.collection('users'); // Representa la colección "users"

module.exports = User;