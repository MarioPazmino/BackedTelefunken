
// server.js
const express = require('express');
const cors = require('cors');
const db = require('./ConexionFirebase/firebase'); // Importa la conexión a Firestore
const userRoutes = require('./routes/userRoutes'); // Importa las rutas de usuarios


// Configurar Express
const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Permitir solicitudes desde otros orígenes
app.use(express.json()); // Parsear el cuerpo de las solicitudes como JSON

// Rutas
app.use('/api/users', userRoutes); // Rutas de usuarios bajo el prefijo /api/users

// Limpieza de partidas temporales expiradas
const cleanupExpiredGames = async () => {
  try {
    const gamesRef = db.collection('games'); // Referencia a la colección de partidas
    const now = new Date();

    // Buscar partidas temporales expiradas
    const snapshot = await gamesRef
      .where('isTemporary', '==', true)
      .where('expiresAt', '<=', now)
      .get();

    // Eliminar partidas expiradas en un lote
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
setInterval(cleanupExpiredGames, 60 * 60 * 1000); // 60 * 60 * 1000 = 1 hora

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});