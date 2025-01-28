// index.js
const express = require('express');
const cors = require('cors');
const db = require('./ConexionFirebase/firebase');
const routerApi = require('./routes'); // Cambiamos la importación de rutas

// Configurar Express
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Implementar el sistema de rutas versionadas
routerApi(app); // Reemplaza la línea app.use('/api/users', userRoutes)

// Limpieza de partidas temporales expiradas
const cleanupExpiredGames = async () => {
  try {
    const gamesRef = db.collection('games');
    const now = new Date();

    const snapshot = await gamesRef
      .where('isTemporary', '==', true)
      .where('expiresAt', '<=', now)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`${snapshot.size} partidas temporales expiradas eliminadas.`);
  } catch (error) {
    console.error('Error al limpiar partidas expiradas:', error);
  }
};

// Ejecutar la limpieza cada hora
setInterval(cleanupExpiredGames, 60 * 60 * 1000);

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});