const express = require('express');
const cors = require('cors');
const http = require('http'); // Importar el módulo http
const socketIo = require('socket.io'); // Importar Socket.IO
const db = require('./ConexionFirebase/firebase');
const routerApi = require('./routes'); // Importar las rutas

// Configurar Express
const app = express();
const port = 3000;

// Crear un servidor HTTP con Express
const server = http.createServer(app);

// Configurar Socket.IO
const io = socketIo(server, {
  cors: {
    origin: '*', // Permitir conexiones desde cualquier origen (ajusta según tus necesidades)
    methods: ['GET', 'POST'], // Métodos permitidos
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Implementar el sistema de rutas versionadas
routerApi(app);

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

// Limpieza de usuarios invitados expirados
const cleanupExpiredGuests = async () => {
  try {
    const usersRef = db.collection('users');
    const now = new Date();
    const fiveDaysAgo = new Date(now.setDate(now.getDate() - 5));

    const snapshot = await usersRef
      .where('isGuest', '==', true)
      .where('createdAt', '<=', fiveDaysAgo)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`${snapshot.size} usuarios invitados expirados eliminados.`);
  } catch (error) {
    console.error('Error al limpiar usuarios invitados expirados:', error);
  }
};

// Ejecutar la limpieza de usuarios invitados expirados cada día
setInterval(cleanupExpiredGuests, 24 * 60 * 60 * 1000);

// Configurar eventos de Socket.IO
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  // Unirse a una sala específica (gameId)
  socket.on('joinGame', (gameId) => {
    socket.join(gameId);
    console.log(`Cliente ${socket.id} se unió a la sala ${gameId}`);
  });

  // Manejar desconexión
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Iniciar el servidor
server.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});