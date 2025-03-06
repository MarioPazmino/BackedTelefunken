// app.js o index.js (archivo principal)
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { admin, db, FieldValue } = require('./ConexionFirebase/firebase');
const routerApi = require('./routes');
const gameSessionService = require('./services/gameSessionService');

// Configurar Express
const app = express();
const port = 3000;

// Configuración CORS para Express
const corsOptions = {
  origin: 'http://localhost:4200', // Origen permitido (tu frontend Angular)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Headers permitidos
  credentials: true // Habilitar credenciales
};

// Crear servidor HTTP
const server = http.createServer(app);

// Configuración CORS para Socket.IO
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:4200', // Mismo origen que Express
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
});

// Middleware
app.use(cors(corsOptions)); // Aplicar configuración CORS a Express
app.use(express.json());

// Pasar io a las rutas
routerApi(app, io);

// Almacenar información de usuarios conectados
const connectedUsers = new Map();

// Configurar eventos de Socket.IO
io.on('connection', (socket) => {
  console.log(`Nuevo cliente conectado: ${socket.id}`);
  
  // Autenticación del usuario
  socket.on('authenticate', ({ username }) => {
    if (!username) {
      return socket.emit('error', { message: 'Falta el nombre de usuario' });
    }
    
    connectedUsers.set(socket.id, { username, games: new Set() });
    console.log(`Usuario ${username} autenticado con socket ${socket.id}`);
    
    socket.emit('authenticated', { success: true });
  });

  // Unirse a una sala de juego
  socket.on('joinGame', async ({ gameId, gameCode, username }) => {
    try {
      if (!gameId || !gameCode || !username) {
        return socket.emit('error', { message: 'Datos incompletos para unirse al juego' });
      }

      const waitingRoomSnapshot = await db
        .collection('waitingRooms')
        .where('gameCode', '==', gameCode)
        .where('gameId', '==', gameId)
        .get();

      if (waitingRoomSnapshot.empty) {
        return socket.emit('error', { message: 'Sala de espera no encontrada o código de juego inválido' });
      }

      socket.join(gameId);
      socket.join(gameCode);

      const userInfo = connectedUsers.get(socket.id);
      if (userInfo) {
        userInfo.games.add(gameId);
        userInfo.games.add(gameCode);
      }

      io.to(gameCode).emit('playerJoined', { username, timestamp: new Date().toISOString() });

      console.log(`Cliente ${socket.id} (${username}) se unió a ${gameId} y ${gameCode}`);

      const gameSessionDoc = await db.collection('gameSessions').doc(gameId).get();
      if (gameSessionDoc.exists) {
        socket.emit('gameState', gameSessionDoc.data());
      }
    } catch (error) {
      console.error('Error al unirse al juego:', error);
      socket.emit('error', { message: 'Error al unirse al juego: ' + error.message });
    }
  });

  // Abandonar una sala
  socket.on('leaveGame', ({ gameId, gameCode, username }) => {
    if (!gameId || !gameCode || !username) {
      return socket.emit('error', { message: 'Datos incompletos para salir del juego' });
    }

    socket.leave(gameId);
    socket.leave(gameCode);

    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      userInfo.games.delete(gameId);
      userInfo.games.delete(gameCode);
    }

    io.to(gameCode).emit('playerLeft', { username, timestamp: new Date().toISOString() });

    console.log(`Cliente ${socket.id} (${username}) abandonó ${gameId} y ${gameCode}`);
  });

  // Acción de juego
socket.on('gameAction', async (actionData) => {
  try {
    const { gameId, gameCode, actionType, username, data } = actionData;

    if (!gameId || !gameCode || !actionType || !username) {
      return socket.emit('error', { message: 'Datos incompletos para la acción' });
    }

    const userInfo = connectedUsers.get(socket.id);
    if (!userInfo || (!userInfo.games.has(gameId) && !userInfo.games.has(gameCode))) {
      return socket.emit('error', { message: 'No autorizado para esta acción' });
    }

    // Usar el servicio correctamente
    switch (actionType) {
      case 'card_purchase':
        await gameSessionService.recordCardPurchase(gameId, username, data.card, data.tokensUsed);
        break;
      case 'card_discard':
        await gameSessionService.recordCardDiscard(gameId, username, data.card);
        break;
      case 'game_played':
        await gameSessionService.recordGamePlayed(gameId, username, data.gameType, data.cards);
        break;
      case 'end_turn':
        await gameSessionService.endTurn(gameId, actionData.nextTurn);
        break;
      default:
        await gameSessionService.recordAction(gameId, username, { type: actionType, ...data });
    }

    io.to(gameCode).emit('actionUpdate', {
      actionType, username, data, timestamp: new Date().toISOString(),
    });

    if (actionData.nextTurn) {
      io.to(gameCode).emit('turnChanged', {
        currentTurn: actionData.nextTurn, previousTurn: username, timestamp: new Date().toISOString(),
      });
    }

    const gameSessionDoc = await db.collection('gameSessions').doc(gameId).get();
    if (gameSessionDoc.exists) {
      io.to(gameCode).emit('gameState', gameSessionDoc.data());
    }
  } catch (error) {
    console.error('Error en acción de juego:', error);
    socket.emit('error', { message: 'Error en acción: ' + error.message });
  }
});

  // Manejo de desconexión
  socket.on('disconnect', async () => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      for (const gameId of userInfo.games) {
        io.to(gameId).emit('playerDisconnected', {
          username: userInfo.username, timestamp: new Date().toISOString(),
        });

        try {
          const gameSessionDoc = await db.collection('gameSessions').doc(gameId).get();
          if (gameSessionDoc.exists) {
            await db.collection('gameSessions').doc(gameId).update({
              [`players.${userInfo.username}.status`]: 'disconnected',
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error(`Error al actualizar estado tras desconexión en ${gameId}:`, error);
        }
      }

      connectedUsers.delete(socket.id);
    }
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

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
    snapshot.forEach((doc) => {
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
    snapshot.forEach((doc) => {
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

// Iniciar el servidor
server.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${port}`);
});