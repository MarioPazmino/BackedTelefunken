// services/gameService.js

const db = require('../ConexionFirebase/firebase');
const { v4: uuidv4 } = require('uuid'); // Para generar IDs únicos

// Crear una nueva partida
const createGame = async (userId, creatorType, isTemporary = false, gameCode = '') => {
  try {
    // Validar si el usuario existe en Firestore
    const userSnapshot = await db.collection('users').doc(userId).get();

    if (!userSnapshot.exists) {
      if (creatorType === 'registered') {
        throw new Error(`El usuario registrado con ID ${userId} no existe.`);
      }
    }

    let userName;
    if (creatorType === 'registered') {
      const userData = userSnapshot.data();
      userName = userData.email || 'Usuario Sin Email';
    } else {
      userName = `Invitado_${Math.floor(Math.random() * 10000)}`; // Generar un nombre temporal
    }

    // Código para generar partida (resto sin cambios)
    const code = gameCode || generateGameCode();
    const gameId = uuidv4();

    const newGame = {
      code,
      title: `Partida ${code}`,
      gameId,
      createdBy: userId,
      creatorType,
      isTemporary,
      players: [
        {
          id: userId,
          type: creatorType,
          name: userName, // Nombre asignado según el tipo de usuario
          joinedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
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
    // Buscar la partida por su código
    const gamesSnapshot = await db
      .collection('games')
      .where('code', '==', gameCode)
      .get();

    if (gamesSnapshot.empty) {
      throw new Error('Partida no encontrada');
    }

    const gameDoc = gamesSnapshot.docs[0];
    const gameData = gameDoc.data();

    // Verificar si el usuario ya está en la partida
    const playerExists = gameData.players.some((player) => player.id === userId);
    if (playerExists) {
      throw new Error('El usuario ya está en la partida');
    }

    // Añadir el nuevo jugador a la partida
    const newPlayer = {
      id: userId,
      type: playerType,
      name: playerName,
      joinedAt: new Date().toISOString(),
    };

    await db
      .collection('games')
      .doc(gameDoc.id)
      .update({
        players: [...gameData.players, newPlayer],
      });

    return { gameId: gameDoc.id, ...gameData };
  } catch (error) {
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

module.exports = {
  createGame,
  joinGame,
  getGameById,
};