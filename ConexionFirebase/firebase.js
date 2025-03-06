//conexionfirebase/firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://telefunken-748e4.firebaseio.com',
});

// Obtener referencias a servicios
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Exportar todo lo necesario
module.exports = {
  admin,          // Exportar el módulo admin inicializado
  db,             // Exportar la instancia de Firestore
  FieldValue      // Exportar FieldValue para operaciones específicas
};