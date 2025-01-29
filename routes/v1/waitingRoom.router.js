// routes/v1/waitingRoom.router.js


const express = require('express');
const router = express.Router();
const db = require('../../ConexionFirebase/firebase'); // Add this import
const waitingRoomService = require('../../services/waitingRoomService');
const WaitingRoom = require('../../schemas/WaitingRoom');
router.get('/status/:gameCode', async (req, res) => {
  try {
    const { gameCode } = req.params;
    console.log('Fetching status for game code:', gameCode);
    
    // Validate gameCode format
    if (!gameCode || gameCode.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Invalid game code format',
        gameCode
      });
    }
    
    // First check games collection to ensure game exists
    const gameSnapshot = await db
      .collection('games')
      .where('code', '==', gameCode)
      .get();

    if (gameSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'Game not found',
        gameCode
      });
    }

    // Then check waiting rooms
    const waitingRoomSnapshot = await db
      .collection('waitingRooms')
      .where('gameCode', '==', gameCode)
      .get();
    
    console.log('Waiting room query result:', {
      empty: waitingRoomSnapshot.empty,
      size: waitingRoomSnapshot.size
    });

    // If no waiting room exists, try to create one
    if (waitingRoomSnapshot.empty) {
      const gameData = gameSnapshot.docs[0].data();
      try {
        console.log('Creating new waiting room for game:', gameCode);
        const newWaitingRoom = await waitingRoomService.createWaitingRoom(
          gameData.gameId,
          gameCode,
          gameData.players || []
        );
        return res.status(200).json(newWaitingRoom);
      } catch (createError) {
        console.error('Error creating waiting room:', createError);
        return res.status(500).json({
          success: false,
          message: 'Failed to create waiting room',
          error: createError.message
        });
      }
    }

    // Return existing waiting room
    const roomDoc = waitingRoomSnapshot.docs[0];
    const waitingRoom = new WaitingRoom(roomDoc.data());
    console.log('Retrieved waiting room:', waitingRoom.toJSON());
    
    return res.status(200).json(waitingRoom.toJSON());
  } catch (error) {
    console.error('Error in /status/:gameCode:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Other routes remain the same...
router.post('/create', async (req, res) => {
  try {
    const { gameId, gameCode, players } = req.body;
    const waitingRoom = await waitingRoomService.createWaitingRoom(gameId, gameCode, players);
    res.status(201).json(waitingRoom);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});




// Crear sala de espera
router.post('/create', async (req, res) => {
  try {
    const { gameId, gameCode } = req.body;
    const waitingRoom = await waitingRoomService.createWaitingRoom(gameId, gameCode);
    res.status(201).json(waitingRoom);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/join', async (req, res) => {
  try {
    const { gameCode, userId, playerType, playerName } = req.body;
    const waitingRoom = await waitingRoomService.joinWaitingRoom(
      gameCode,
      userId,
      playerType,
      playerName
    );
    res.status(200).json(waitingRoom);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/leave', async (req, res) => {
  try {
    const { gameCode, userId } = req.body;
    const result = await waitingRoomService.leaveWaitingRoom(gameCode, userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/start', async (req, res) => {
  try {
    const { gameCode } = req.body;
    const result = await waitingRoomService.startGame(gameCode);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;