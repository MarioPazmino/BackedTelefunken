// app.js o index.js (archivo principal)
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { admin, db, FieldValue } = require('./ConexionFirebase/firebase');
const routerApi = require('./routes');
const gameSessionService = require('./services/gameSessionService');

// Configuración Express
const app = express();
const port = 3000;

// Configuración CORS
const corsOptions = {
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Servidor HTTP y Socket.IO
const server = http.createServer(app);
const io = socketIo(server, { cors: corsOptions });

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
routerApi(app, io);

// Usuarios conectados
const connectedUsers = new Map();

// Eventos Socket.IO
io.on('connection', (socket) => {
  console.log(`Nuevo cliente: ${socket.id}`);

  // Autenticación
  socket.on('authenticate', ({ username }) => {
    if (!username) return socket.emit('error', 'Nombre de usuario requerido');
    connectedUsers.set(socket.id, { username, games: new Set() });
    socket.emit('authenticated', true);
  });

  // Unirse a partida
  socket.on('joinGame', async ({ gameId, gameCode, username }) => {
    try {
      const room = await db.collection('waitingRooms')
        .where('gameCode', '==', gameCode)
        .where('gameId', '==', gameId)
        .get();

      if (room.empty) throw new Error('Sala no encontrada');

      socket.join([gameId, gameCode]);
      const user = connectedUsers.get(socket.id);
      user.games.add(gameId).add(gameCode);

      io.to(gameCode).emit('playerJoined', { username });
      socket.emit('gameState', (await db.collection('gameSessions').doc(gameId).get()).data());
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // En app.js o donde estén los eventos Socket.IO
socket.on('leaveGame', async ({ gameId, gameCode, username }) => {
  try {
    const user = connectedUsers.get(socket.id);
    if (!user) throw new Error('Usuario no encontrado');

    // Actualizar estado del jugador en la base de datos
    await db.collection('gameSessions').doc(gameId).update({
      [`players.${username}.status`]: 'left'
    });

    // Emitir evento de salida
    io.to(gameCode).emit('playerLeft', { username });
    socket.leave([gameId, gameCode]);
  } catch (error) {
    socket.emit('error', error.message);
  }
});
  // Acciones de juego
  socket.on('gameAction', async (actionData) => {
    try {
      const { gameId, gameCode, actionType, username, data } = actionData;
      const user = connectedUsers.get(socket.id);

      if (!user || !user.games.has(gameCode)) 
        throw new Error('No autorizado');

      switch(actionType) {
        case 'claim_round':
          await gameSessionService.claimRound(gameId, username, data.tokenCount);
          break;
        case 'approve_round':
          await gameSessionService.approveRound(gameId, username, data.approved);
          break;
        case 'declare_cards':
          await gameSessionService.declareCards(gameId, username, data.declarations);
          break;
        default:
          throw new Error('Acción desconocida');
      }

      // Emitir actualizaciones
      const gameState = (await db.collection('gameSessions').doc(gameId).get()).data();
      io.to(gameCode).emit('gameUpdate', gameState);
    } catch (error) {
      socket.emit('error', error.message);
    }
  });

  // Desconexión
  socket.on('disconnect', async () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    user.games.forEach(async (gameId) => {
      try {
        await db.collection('gameSessions').doc(gameId).update({
          [`players.${user.username}.status`]: 'disconnected'
        });
        io.to(gameId).emit('playerDisconnected', { username: user.username });
      } catch (error) {
        console.error('Error al actualizar estado:', error);
      }
    });

    connectedUsers.delete(socket.id);
  });
});

// Limpieza de datos
const cleanup = async (collection, query) => {
  const batch = db.batch();
  (await db.collection(collection).where(...query).get())
    .forEach(doc => batch.delete(doc.ref));
  await batch.commit();
};

// Limpiar partidas temporales cada hora
setInterval(async () => {
  cleanup('games', [['isTemporary', '==', true], ['expiresAt', '<=', new Date()]]);
}, 3600000);

// Limpiar usuarios invitados cada día
setInterval(async () => {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  cleanup('users', [['isGuest', '==', true], ['createdAt', '<=', fiveDaysAgo]]);
}, 86400000);

// Iniciar servidor
server.listen(port, () => {
  console.log(`Servidor activo en puerto ${port}`);
});