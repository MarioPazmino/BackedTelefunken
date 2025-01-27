const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Archivo de credenciales de Firebase

// Inicializar Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://telefunken-748e4.firebaseio.com', // URL de tu proyecto Firebase
});

// Obtener una referencia a Firestore
const db = admin.firestore();

// Exportar la conexión para usarla en otros archivos
module.exports = db;