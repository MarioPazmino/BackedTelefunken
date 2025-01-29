
// services/gameService.js
const db = require('../ConexionFirebase/firebase');
const { v4: uuidv4 } = require('uuid');
const waitingRoomService = require('./waitingRoomService');

const generateGuestId = () => `guest_${uuidv4()}`;
// Crear una nueva partida
const createGame = async (userId, creatorType, isTemporary = false, gameCode = '') => {
  try {
    // Validar usuario registrado
    const userSnapshot = await db.collection('users').doc(userId).get();
    if (!userSnapshot.exists && creatorType === 'registered') {
      throw new Error(`El usuario registrado con ID ${userId} no existe.`);
    }

    // Obtener nombre e ID del usuario
    let userName = creatorType === 'registered'
      ? userSnapshot.data().email || 'Usuario Sin Email'
      : `Invitado_${Math.floor(Math.random() * 10000)}`;

    const guestId = creatorType === 'guest' ? generateGuestId() : userId;

    // Generar códigos y IDs
    const code = gameCode || generateGameCode();
    const gameId = uuidv4();

    // Crear la partida inicial
    const newGame = {
      code,
      title: `Partida ${code}`,
      gameId,
      createdBy: guestId,
      creatorType,
      isTemporary,
      status: 'lobby',
      players: [{
        id: guestId,
        type: creatorType,
        name: userName,
        joinedAt: new Date().toISOString()
      }],
      createdAt: new Date().toISOString()
    };

    await db.collection('games').doc(gameId).set(newGame);
    return newGame;
  } catch (error) {
    throw new Error(`Error al crear la partida: ${error.message}`);
  }
};


// Unirse a una partida existente

const joinGame = async (gameCode, userId, playerType, playerName) => {
  try {
    // Buscar la partida
    const gamesSnapshot = await db.collection('games').where('code', '==', gameCode).get();
    if (gamesSnapshot.empty) throw new Error('Partida no encontrada');

    const gameDoc = gamesSnapshot.docs[0];
    const gameData = gameDoc.data();

    // Generar ID de invitado si es necesario
    const guestId = playerType === 'guest' ? generateGuestId() : userId;
    const finalPlayerName = playerName || `Invitado_${Math.floor(Math.random() * 10000)}`;

    // Verificar sala de espera
    const waitingRoomsSnapshot = await db.collection('waitingRooms').where('gameCode', '==', gameCode).get();
    let waitingRoomData;

    if (!waitingRoomsSnapshot.empty) {
      const waitingRoomDoc = waitingRoomsSnapshot.docs[0];
      waitingRoomData = waitingRoomDoc.data();

      // Verificar si el jugador ya está en la sala de espera
      const existingPlayer = waitingRoomData.players.find(p => p.id === guestId);

      if (!existingPlayer) {
        // Añadir jugador a la sala de espera
        const newPlayer = {
          id: guestId,
          type: playerType,
          name: finalPlayerName,
          status: 'active',
          joinedAt: new Date().toISOString()
        };

        const updatedPlayers = [...waitingRoomData.players, newPlayer];
        const activeCount = updatedPlayers.filter(p => p.status === 'active').length;

        await waitingRoomDoc.ref.update({
          players: updatedPlayers,
          activePlayers: activeCount,
          status: activeCount >= waitingRoomData.minPlayers ? 'ready' : 'waiting',
          updatedAt: new Date().toISOString()
        });

        // También actualizar la lista de jugadores en la partida
        await gameDoc.ref.update({ players: updatedPlayers });
      }
    }

    return {
      gameId: gameDoc.id,
      ...gameData,
      waitingRoom: waitingRoomData
    };
  } catch (error) {
    console.error('Error en joinGame:', error);
    throw new Error(`Error al unirse a la partida: ${error.message}`);
  }
};
// Obtener una partida por su ID
const getGameById = async (gameId) => {
  try {
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      throw new Error('Partida no encontrada');
    }
    return { gameId: gameDoc.id, ...gameDoc.data() };
  } catch (error) {
    throw new Error(`Error al obtener la partida: ${error.message}`);
  }
};

// Generar un código aleatorio para la partida
const generateGameCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

const startGameSession = async (gameCode) => {
  try {
    console.log('Iniciando sesión de juego para:', gameCode);
    
    // Ensure waitingRooms collection exists
    await ensureWaitingRoomCollection();
    
    // Buscar la partida
    const gamesSnapshot = await db
      .collection('games')
      .where('code', '==', gameCode)
      .where('status', '==', 'lobby')
      .get();

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
      players: gameData.players.length
    });

    // Verificar sala de espera existente
    const waitingRoomsCollection = db.collection('waitingRooms');
    const existingWaitingRoom = await waitingRoomsCollection
      .where('gameCode', '==', gameCode)
      .get();

    if (!existingWaitingRoom.empty) {
      console.log('Sala de espera existente encontrada');
      const existingRoom = existingWaitingRoom.docs[0].data();
      return {
        ...gameData,
        status: 'in_waiting_room',
        waitingRoom: existingRoom
      };
    }

    // Crear nueva sala de espera
    console.log('Creando nueva sala de espera...');
    const waitingRoom = await waitingRoomService.createWaitingRoom(
      gameData.gameId,
      gameCode,
      gameData.players
    );

    if (!waitingRoom || !waitingRoom.roomId) {
      throw new Error('Error al crear sala de espera: respuesta inválida');
    }

    console.log('Sala de espera creada:', waitingRoom);

    // Actualizar estado de la partida
    await gameDoc.ref.update({ 
      status: 'in_waiting_room',
      waitingRoomId: waitingRoom.roomId
    });

    return {
      ...gameData,
      status: 'in_waiting_room',
      waitingRoom: waitingRoom
    };

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
  ensureWaitingRoomCollection
};