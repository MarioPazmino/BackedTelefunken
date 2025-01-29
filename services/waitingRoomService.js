
//services/waitingRoomService.js

const db = require('../ConexionFirebase/firebase');
const { v4: uuidv4 } = require('uuid');
const WaitingRoom = require('../schemas/WaitingRoom');

const generateGuestId = () => `guest_${uuidv4()}`;

const createWaitingRoom = async (gameId, gameCode, initialPlayers = []) => {
  try {
    console.log('Creating waiting room for:', { gameId, gameCode, initialPlayers });
    
    const waitingRoom = new WaitingRoom({
      gameId,
      gameCode,
      players: initialPlayers
    });

    await waitingRoom.save();
    
    console.log('Waiting room created successfully:', waitingRoom.toJSON());
    return waitingRoom.toJSON();
  } catch (error) {
    console.error('Error creating waiting room:', error);
    throw new Error(`Failed to create waiting room: ${error.message}`);
  }
};

const joinWaitingRoom = async (gameCode, userId, playerType, playerName) => {
  try {
    const gameSnapshot = await db.collection('games').where('code', '==', gameCode).get();
    if (gameSnapshot.empty) throw new Error('Partida no encontrada');

    const gameDoc = gameSnapshot.docs[0];
    const gameData = gameDoc.data();

    const roomsSnapshot = await db.collection('waitingRooms').where('gameCode', '==', gameCode).where('status', '!=', 'started').get();
    if (roomsSnapshot.empty) throw new Error('Sala de espera no encontrada');

    const roomDoc = roomsSnapshot.docs[0];
    const roomData = roomDoc.data();

    if (roomData.activePlayers >= roomData.maxPlayers) throw new Error('La sala está llena');

    const guestId = playerType === 'guest' ? generateGuestId() : userId;
    const finalPlayerName = playerName || `Invitado_${Math.floor(Math.random() * 10000)}`;

    const existingPlayer = roomData.players.find(p => p.id === guestId);
    let updatedPlayers = [...roomData.players];
    
    if (!existingPlayer) {
      const newPlayer = {
        id: guestId,
        type: playerType,
        name: finalPlayerName,
        status: 'active',
        joinedAt: new Date().toISOString()
      };
      updatedPlayers.push(newPlayer);
      await gameDoc.ref.update({ players: updatedPlayers });
    } else if (existingPlayer.status !== 'active') {
      updatedPlayers = updatedPlayers.map(p => p.id === guestId ? { ...p, status: 'active', rejoinedAt: new Date().toISOString() } : p);
    }

    const activeCount = updatedPlayers.filter(p => p.status === 'active').length;
    const newStatus = activeCount >= roomData.minPlayers ? 'ready' : 'waiting';

    await roomDoc.ref.update({
      players: updatedPlayers,
      activePlayers: activeCount,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    return {
      ...roomData,
      players: updatedPlayers,
      activePlayers: activeCount,
      status: newStatus
    };
  } catch (error) {
    console.error('Error en joinWaitingRoom:', error);
    throw new Error(`Error al unirse a la sala de espera: ${error.message}`);
  }
};


const leaveWaitingRoom = async (gameCode, userId) => {
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
      p.id === userId 
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

    await waitingRoom.update({ status: 'started' });
    return waitingRoom.toJSON();
  } catch (error) {
    throw new Error(`Error al iniciar el juego: ${error.message}`);
  }
};

module.exports = {
  createWaitingRoom,
  joinWaitingRoom,
  leaveWaitingRoom,
  getWaitingRoomStatus,
  startGame
};
