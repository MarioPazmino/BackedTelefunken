// services/gameService.js
const { admin, db, FieldValue } = require('./../ConexionFirebase/firebase');
const { v4: uuidv4 } = require('uuid');
const waitingRoomService = require('./waitingRoomService');
const gameSessionService = require('./gameSessionService');


// Buscar un usuario por su username
const findUserByUsername = async (username) => {
  const userSnapshot = await db.collection('users').where('username', '==', username).get();
  if (userSnapshot.empty) return null;
  const userDoc = userSnapshot.docs[0];
  return userDoc.data(); // Devolvemos solo los datos del usuario, sin userId
};

// Crear una nueva partida
const createGame = async (username, creatorType, isTemporary = false, gameCode = '') => {
  try {
    let user = await findUserByUsername(username);
    if (!user) throw new Error(`Usuario con username ${username} no existe.`);

    const code = gameCode || generateGameCode();
    const gameId = uuidv4();

    const newGame = {
      code,
      title: `Partida ${code}`,
      gameId,
      createdBy: username, // Usamos el username en lugar de userId
      creatorType,
      isTemporary,
      status: 'lobby',
      players: [{
        id: username, // Usamos el username como identificador del jugador
        username: username, // Aseguramos que solo usamos el username
        type: creatorType,
        joinedAt: new Date().toISOString()
      }],
      createdAt: new Date().toISOString()
    };

    await db.collection('games').doc(gameId).set(newGame);

    // Pasar los jugadores iniciales al crear la sala de espera
    const waitingRoom = await waitingRoomService.createWaitingRoom(
      gameId,
      code,
      newGame.players // Pasar los jugadores iniciales
    );

    await db.collection('games').doc(gameId).update({
      waitingRoomId: waitingRoom.roomId,
      status: 'in_waiting_room',
    });

    return { game: newGame, waitingRoom };
  } catch (error) {
    throw new Error(`Error al crear la partida: ${error.message}`);
  }
};

// Unirse a una partida existente
const joinGame = async (gameCode, username) => {
  try {
    if (!username) throw new Error('El nombre de usuario es requerido.');

    const gamesSnapshot = await db.collection('games').where('code', '==', gameCode).get();
    if (gamesSnapshot.empty) throw new Error('Partida no encontrada.');

    const gameDoc = gamesSnapshot.docs[0];
    const gameData = gameDoc.data();

    // Verificar si el usuario ya está en la partida
    if (gameData.players.some(player => player.username === username)) {
      throw new Error('El usuario ya está en la partida.');
    }

    // Unirse a la sala de espera
    const waitingRoom = await waitingRoomService.joinWaitingRoom(
      gameCode,
      username,
      'registered' // O 'guest', dependiendo del tipo de jugador
    );

    // Actualizar la lista de jugadores en la partida
    const updatedPlayers = [...gameData.players, {
      id: username, // Usar username como identificador
      type: 'registered', // O 'guest'
      name: username,
      joinedAt: new Date().toISOString()
    }];

    await gameDoc.ref.update({ players: updatedPlayers });

    return {
      gameId: gameDoc.id,
      ...gameData,
      waitingRoom
    };
  } catch (error) {
    throw new Error(`Error al unirse a la partida: ${error.message}`);
  }
};

// Obtener una partida por su ID
const getGameById = async (gameId) => {
  try {
    const gameSnapshot = await db.collection('games').doc(gameId).get();
    if (!gameSnapshot.exists) return null;
    return { gameId: gameSnapshot.id, ...gameSnapshot.data() };
  } catch (error) {
    throw new Error(`Error al obtener la partida: ${error.message}`);
  }
};

// Función para iniciar la sesión del juego
const startGameSession = async (gameCode) => {
  try {
    console.log('Iniciando sesión de juego para:', gameCode);

    // Buscar la partida
    const gamesSnapshot = await db.collection('games').where('code', '==', gameCode).get();

    if (gamesSnapshot.empty) {
      console.error('No se encontró la partida:', gameCode);
      throw new Error('Partida no encontrada o no está en fase de lobby');
    }

    const gameDoc = gamesSnapshot.docs[0];
    const gameData = gameDoc.data();

    // Verificar que tengamos todos los datos necesarios
    if (!gameData.gameId || !gameData.players) {
      throw new Error('Datos de partida incompletos');
    }

    console.log('Datos de partida encontrados:', {
      gameId: gameData.gameId,
      code: gameData.code,
      players: gameData.players.length,
    });

    // Verificar si la sala de espera ya existe
    const waitingRoomsCollection = db.collection('waitingRooms');
    const existingWaitingRoom = await waitingRoomsCollection.where('gameCode', '==', gameCode).get();

    let waitingRoom;

    if (!existingWaitingRoom.empty) {
      console.log('Sala de espera existente encontrada');
      waitingRoom = existingWaitingRoom.docs[0].data();
    } else {
      // Crear nueva sala de espera
      console.log('Creando nueva sala de espera...');
      waitingRoom = await waitingRoomService.createWaitingRoom(
        gameData.gameId,
        gameCode,
        gameData.players
      );

      if (!waitingRoom || !waitingRoom.roomId) {
        throw new Error('Error al crear sala de espera: respuesta inválida');
      }

      console.log('Sala de espera creada:', waitingRoom);
    }

    // Actualizar estado de la partida
    await gameDoc.ref.update({
      status: 'in_waiting_room',
      waitingRoomId: waitingRoom.roomId,
    });

    // Verificar si la sala de espera está lista para comenzar
    if (waitingRoom.activePlayers >= waitingRoom.minPlayers) {
      console.log('La sala de espera está lista para comenzar.');

      // Asignar dealer y jugador que comienza
      const { dealer, starter } = assignDealerAndStarter(gameData.players);

      // Crear el estado inicial de la partida
      const initialGameState = {
        dealer,
        currentTurn: starter,
        players: gameData.players,
        status: 'in_progress',
        actions: [],
        jokerUses: [],
        results: {},
        createdAt: new Date().toISOString(),
      };

      // Guardar el estado inicial de la partida en Firestore
      await gameDoc.ref.update({ gameState: initialGameState });

      console.log('Partida iniciada con éxito:', initialGameState);

      return {
        ...gameData,
        status: 'in_progress',
        waitingRoom,
        gameState: initialGameState,
      };
    } else {
      console.log('La sala de espera no está lista para comenzar.');
      return {
        ...gameData,
        status: 'in_waiting_room',
        waitingRoom,
      };
    }
  } catch (error) {
    console.error('Error completo en startGameSession:', error);
    throw error;
  }
};

// Función auxiliar para verificar/crear la colección waitingRooms
const ensureWaitingRoomCollection = async () => {
  try {
    const waitingRoomsCollection = db.collection('waitingRooms');

    // Verificar si la colección existe
    const tempDoc = await waitingRoomsCollection.doc('_temp').get();

    if (!tempDoc.exists) {
      // Crear documento temporal
      await waitingRoomsCollection.doc('_temp').set({
        _temp: true,
        createdAt: new Date().toISOString()
      });
      console.log('Colección waitingRooms creada exitosamente');

      // Limpiar después de crear
      await waitingRoomsCollection.doc('_temp').delete();
    }

    return true;
  } catch (error) {
    console.error('Error al verificar/crear colección waitingRooms:', error);
    throw new Error('No se pudo asegurar la existencia de la colección waitingRooms');
  }
};

module.exports = {
  createGame,
  joinGame,
  getGameById,
  startGameSession,
  ensureWaitingRoomCollection,
  findUserByUsername
};