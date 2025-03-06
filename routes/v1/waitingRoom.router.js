
// routes/v1/waitingRoom.router.js
const express = require('express');
const router = express.Router();
const { admin, db, FieldValue } = require('./../../ConexionFirebase/firebase');
const waitingRoomService = require('../../services/waitingRoomService');
const WaitingRoom = require('../../schemas/WaitingRoom');

// Obtener el estado de una sala de espera
router.get('/status/:gameCode', async (req, res) => {
  try {
    const { gameCode } = req.params;
    console.log('Fetching status for game code:', gameCode);

    // Validar el formato del código del juego
    if (!gameCode || gameCode.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Formato de código de juego inválido',
        gameCode
      });
    }

    // Verificar si el juego existe
    const gameSnapshot = await db
      .collection('games')
      .where('code', '==', gameCode)
      .get();

    if (gameSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'Juego no encontrado',
        gameCode
      });
    }

    // Verificar si la sala de espera existe
    const waitingRoomSnapshot = await db
      .collection('waitingRooms')
      .where('gameCode', '==', gameCode)
      .get();

    console.log('Resultado de la consulta de la sala de espera:', {
      empty: waitingRoomSnapshot.empty,
      size: waitingRoomSnapshot.size
    });

    // Si no existe la sala de espera, intentar crear una nueva
    if (waitingRoomSnapshot.empty) {
      const gameData = gameSnapshot.docs[0].data();
      try {
        console.log('Creando nueva sala de espera para el juego:', gameCode);
        const newWaitingRoom = await waitingRoomService.createWaitingRoom(
          gameData.gameId,
          gameCode,
          gameData.players || []
        );
        return res.status(200).json(newWaitingRoom);
      } catch (createError) {
        console.error('Error al crear la sala de espera:', createError);
        return res.status(500).json({
          success: false,
          message: 'Error al crear la sala de espera',
          error: createError.message
        });
      }
    }

    // Devolver la sala de espera existente
    const roomDoc = waitingRoomSnapshot.docs[0];
    const waitingRoom = new WaitingRoom(roomDoc.data());
    console.log('Sala de espera recuperada:', waitingRoom.toJSON());

    return res.status(200).json(waitingRoom.toJSON());
  } catch (error) {
    console.error('Error en /status/:gameCode:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
});

// Crear una sala de espera
router.post('/create', async (req, res) => {
  try {
    const { gameId, gameCode, players } = req.body;
    const waitingRoom = await waitingRoomService.createWaitingRoom(gameId, gameCode, players);
    res.status(201).json(waitingRoom);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Unirse a una sala de espera
// Unirse a una sala de espera
router.post('/join', async (req, res) => {
  try {
    const { gameCode, username, playerType } = req.body;

    const waitingRoom = await waitingRoomService.joinWaitingRoom(gameCode, username, playerType);
    res.status(200).json(waitingRoom);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Salir de una sala de espera
router.post('/leave', async (req, res) => {
  try {
    const { gameCode, username } = req.body;

    const result = await waitingRoomService.leaveWaitingRoom(gameCode, username);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
// Iniciar el juego desde la sala de espera
router.post('/start', async (req, res) => {
  try {
    const { gameCode } = req.body;

    if (!gameCode) {
      return res.status(400).json({ success: false, message: 'Game code is required' });
    }

    const result = await waitingRoomService.startGame(gameCode);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
module.exports = router;