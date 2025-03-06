

//routes/v1/gameSession.router.js
const express = require('express');
const router = express.Router();
const { admin, db, FieldValue } = require('./../../ConexionFirebase/firebase');
const gameSessionService = require('../../services/gameSessionService');

module.exports = (io) => { // Aceptar `io` como parámetro
  // Iniciar la partida
  router.post('/:gameId/:gameCode/start', async (req, res) => {
    try {
      const { gameId, gameCode } = req.params;
      const { players } = req.body;

      // Validar que el gameCode coincida con el gameId
      const waitingRoomSnapshot = await db
        .collection('waitingRooms')
        .where('gameCode', '==', gameCode)
        .where('gameId', '==', gameId)
        .get();

      if (waitingRoomSnapshot.empty) {
        return res.status(404).json({ message: 'Sala de espera no encontrada o código de juego inválido' });
      }

      const gameState = await gameSessionService.startGameSession(gameId, players);

      // Emitir evento a todos los clientes en la sala (gameCode)
      io.to(gameCode).emit('gameStarted', gameState);

      res.status(200).json(gameState);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Registrar una acción en la partida
  router.post('/:gameId/:gameCode/action', async (req, res) => {
    try {
      const { gameId, gameCode } = req.params;
      const { playerId, action } = req.body;

      // Validar que el gameCode coincida con el gameId
      const waitingRoomSnapshot = await db
        .collection('waitingRooms')
        .where('gameCode', '==', gameCode)
        .where('gameId', '==', gameId)
        .get();

      if (waitingRoomSnapshot.empty) {
        return res.status(404).json({ message: 'Sala de espera no encontrada o código de juego inválido' });
      }

      await gameSessionService.recordAction(gameId, playerId, action);

      // Emitir evento a todos los clientes en la sala (gameCode)
      io.to(gameCode).emit('actionRecorded', { playerId, action });

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Finalizar la partida
  router.post('/:gameId/:gameCode/end', async (req, res) => {
    try {
      const { gameId, gameCode } = req.params;

      // Validar que el gameCode coincida con el gameId
      const waitingRoomSnapshot = await db
        .collection('waitingRooms')
        .where('gameCode', '==', gameCode)
        .where('gameId', '==', gameId)
        .get();

      if (waitingRoomSnapshot.empty) {
        return res.status(404).json({ message: 'Sala de espera no encontrada o código de juego inválido' });
      }

      const results = await gameSessionService.endGameSession(gameId);

      // Emitir evento a todos los clientes en la sala (gameCode)
      io.to(gameCode).emit('gameEnded', results);

      res.status(200).json(results);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Registrar una compra de carta
  router.post('/:gameId/record-purchase', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { playerId, card, tokensUsed } = req.body;

      await gameSessionService.recordCardPurchase(gameId, playerId, card, tokensUsed);

      // Emitir evento a todos los clientes en la sala (gameId)
      io.to(gameId).emit('cardPurchased', { playerId, card, tokensUsed });

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Registrar un descarte de carta
  router.post('/:gameId/record-discard', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { playerId, card } = req.body;

      await gameSessionService.recordCardDiscard(gameId, playerId, card);

      // Emitir evento a todos los clientes en la sala (gameId)
      io.to(gameId).emit('cardDiscarded', { playerId, card });

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Registrar un juego completado
  router.post('/:gameId/record-game-played', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { playerId, gameType, cards } = req.body;

      await gameSessionService.recordGamePlayed(gameId, playerId, gameType, cards);

      // Emitir evento a todos los clientes en la sala (gameId)
      io.to(gameId).emit('gamePlayed', { playerId, gameType, cards });

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  return router; // Exportar el router una sola vez
};
