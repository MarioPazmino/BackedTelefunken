
//services/waitingRoomService.js
const { admin, db, FieldValue } = require('./../ConexionFirebase/firebase');
const { v4: uuidv4 } = require('uuid');
const WaitingRoom = require('../schemas/WaitingRoom');
const gameSessionService = require('./gameSessionService'); 

// Buscar un usuario por su username
const findUserByUsername = async (username) => {
  const userSnapshot = await db.collection('users').where('username', '==', username).get();
  if (userSnapshot.empty) return null;
  const userDoc = userSnapshot.docs[0];
  return userDoc.data(); // Devolvemos solo los datos del usuario, sin userId
};

// Crear una sala de espera
const createWaitingRoom = async (gameId, gameCode, initialPlayers = []) => {
  try {
    console.log('Creating waiting room for:', { gameId, gameCode, initialPlayers });

    const waitingRoom = new WaitingRoom({
      gameId,
      gameCode,
      minPlayers: 2, // Cambiado el mínimo de jugadores a 2
      players: initialPlayers, // Asegúrate de que initialPlayers se está pasando correctamente
      createdBy: initialPlayers.length ? initialPlayers[0].id : null, // Usamos el username como creador
    });

    await waitingRoom.save();

    console.log('Waiting room created successfully:', waitingRoom.toJSON());
    return waitingRoom.toJSON();
  } catch (error) {
    console.error('Error creating waiting room:', error);
    throw new Error(`Failed to create waiting room: ${error.message}`);
  }
};

// Unirse a una sala de espera
const joinWaitingRoom = async (gameCode, username, playerType) => {
  try {
    const roomsSnapshot = await db.collection('waitingRooms')
      .where('gameCode', '==', gameCode)
      .where('status', '!=', 'started')
      .get();

    if (roomsSnapshot.empty) throw new Error('Sala de espera no encontrada');

    const roomDoc = roomsSnapshot.docs[0];
    const roomData = roomDoc.data();

    // Verificar si el usuario ya está en la sala de espera
    if (roomData.players.some(p => p.id === username)) {
      throw new Error('El usuario ya está en la sala de espera.');
    }

    // Crear un nuevo jugador
    const newPlayer = {
      id: username, // Usar username como identificador
      username: username, // Aseguramos que solo usamos el username
      type: playerType,
      status: 'active',
      joinedAt: new Date().toISOString()
    };

    // Actualizar la lista de jugadores
    const updatedPlayers = [...roomData.players, newPlayer];
    const activeCount = updatedPlayers.filter(p => p.status === 'active').length;

    // Actualizar la sala de espera
    await roomDoc.ref.update({
      players: updatedPlayers,
      activePlayers: activeCount,
      status: activeCount >= roomData.minPlayers ? 'ready' : 'waiting',
      updatedAt: new Date().toISOString()
    });

    return { ...roomData, players: updatedPlayers };
  } catch (error) {
    throw new Error(`Error al unirse a la sala de espera: ${error.message}`);
  }
};


// Salir de una sala de espera
const leaveWaitingRoom = async (gameCode, username) => {
  try {
    const roomsSnapshot = await db
      .collection('waitingRooms')
      .where('gameCode', '==', gameCode)
      .where('status', '!=', 'started')
      .get();

    if (roomsSnapshot.empty) {
      throw new Error('Sala de espera no encontrada');
    }

    const roomDoc = roomsSnapshot.docs[0];
    const roomData = roomDoc.data();

    // Marcar jugador como inactivo
    const updatedPlayers = roomData.players.map(p =>
      p.id === username
        ? { ...p, status: 'inactive', leftAt: new Date().toISOString() }
        : p
    );

    // Actualizar contador de jugadores activos
    const activeCount = updatedPlayers.filter(p => p.status === 'active').length;

    // Actualizar estado de la sala
    const newStatus = activeCount >= roomData.minPlayers ? 'ready' : 'waiting';

    await roomDoc.ref.update({
      players: updatedPlayers,
      activePlayers: activeCount,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    return {
      success: true,
      activeCount,
      status: newStatus
    };
  } catch (error) {
    throw new Error(`Error al salir de la sala de espera: ${error.message}`);
  }
};

// Obtener el estado de una sala de espera
const getWaitingRoomStatus = async (gameCode) => {
  try {
    const roomsSnapshot = await db
      .collection('waitingRooms')
      .where('gameCode', '==', gameCode)
      .get();

    if (roomsSnapshot.empty) {
      throw new Error('Sala de espera no encontrada');
    }

    const roomDoc = roomsSnapshot.docs[0];
    const waitingRoom = new WaitingRoom({ ...roomDoc.data() });

    console.log('Estado de la sala recuperado:', waitingRoom.toJSON());

    return waitingRoom.toJSON();
  } catch (error) {
    throw new Error(`Error al obtener el estado de la sala: ${error.message}`);
  }
};

const startGame = async (gameCode) => {
  try {
    const roomsSnapshot = await db
      .collection('waitingRooms')
      .where('gameCode', '==', gameCode)
      .where('status', '==', 'ready')
      .get();

    if (roomsSnapshot.empty) {
      throw new Error('Sala de espera no encontrada o no está lista para comenzar');
    }

    const roomDoc = roomsSnapshot.docs[0];
    const waitingRoom = new WaitingRoom({ ...roomDoc.data() });

    if (!waitingRoom.isReadyToStart()) {
      throw new Error('No hay suficientes jugadores para comenzar');
    }

    const activePlayers = waitingRoom.players.filter(p => p.status === 'active');
    
    // Extract gameId from the waiting room
    const gameId = waitingRoom.gameId;

    const gameSession = await gameSessionService.startGameSession(
      gameId,
      activePlayers,
      gameCode // Pasar gameCode aquí
    );

    await waitingRoom.update({
      status: 'started',
      gameSessionId: gameSession.gameId
    });

    return {
      ...waitingRoom.toJSON(),
      gameSession,
      gameId  // Add gameId to the returned object
    };
  } catch (error) {
    throw new Error(`Error al iniciar el juego: ${error.message}`);
  }
};

module.exports = {
  createWaitingRoom,
  joinWaitingRoom,
  leaveWaitingRoom,
  getWaitingRoomStatus,
  startGame,
  findUserByUsername
};


