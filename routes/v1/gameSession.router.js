

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
  const detailedResults = {
    ...results,
    roundDetails: gameSession.rounds.map(round => ({
      name: round.name,
      points: round.points,
      winner: round.winner
    }))
  };
      // Emitir evento a todos los clientes en la sala (gameCode)
      io.to(gameCode).emit('gameEnded', results, detailedResults);

      res.status(200).json(results);
      res.status(200).json(detailedResults);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Nuevo endpoint para reclamar una ronda
  router.post('/:gameId/:gameCode/claim-round', async (req, res) => {
    try {
      const { gameId, gameCode } = req.params;
      const { username, tokenCount } = req.body;

      // Validar sala
      const waitingRoomSnapshot = await db
        .collection('waitingRooms')
        .where('gameCode', '==', gameCode)
        .where('gameId', '==', gameId)
        .get();

      if (waitingRoomSnapshot.empty) {
        return res.status(404).json({ message: 'Sala no encontrada' });
      }

      // Ejecutar lógica de reclamo
      await gameSessionService.claimRound(gameId, username, tokenCount);

      // Obtener datos actualizados de la ronda
      const gameSessionDoc = await db.collection('gameSessions').doc(gameId).get();
      const currentRound = gameSessionDoc.data().rounds[gameSessionDoc.data().currentRound];

      // Emitir evento
      io.to(gameCode).emit('roundClaimed', {
        username,
        round: currentRound.name,
        remainingTokens: 12 - (gameSessionDoc.data().tokensUsed[username] || 0)
      });

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Nuevo endpoint para aprobar/rechazar un reclamo
  router.post('/:gameId/:gameCode/approve-round', async (req, res) => {
    try {
      const { gameId, gameCode } = req.params;
      const { approver, approved } = req.body;

      // Validar sala
      const waitingRoomSnapshot = await db
        .collection('waitingRooms')
        .where('gameCode', '==', gameCode)
        .where('gameId', '==', gameId)
        .get();

      if (waitingRoomSnapshot.empty) {
        return res.status(404).json({ message: 'Sala no encontrada' });
      }

      // Ejecutar lógica de aprobación
      await gameSessionService.approveRound(gameId, approver, approved);

      // Obtener datos actualizados
      const gameSessionDoc = await db.collection('gameSessions').doc(gameId).get();
      const currentRoundIndex = gameSessionDoc.data().currentRound;
      const currentRound = gameSessionDoc.data().rounds[currentRoundIndex];

      // Emitir evento
      io.to(gameCode).emit('roundApproved', {
        approved,
        round: currentRound.name,
        points: currentRound.points,
        nextRound: gameSessionDoc.data().rounds[currentRoundIndex + 1]?.name || 'Finalizada'
      });

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Nuevo endpoint para declarar cartas
  router.post('/:gameId/:gameCode/declare-cards', async (req, res) => {
    try {
      const { gameId, gameCode } = req.params;
      const { username, declarations } = req.body;

      // Validar sala
      const waitingRoomSnapshot = await db
        .collection('waitingRooms')
        .where('gameCode', '==', gameCode)
        .where('gameId', '==', gameId)
        .get();

      if (waitingRoomSnapshot.empty) {
        return res.status(404).json({ message: 'Sala no encontrada' });
      }

      // Ejecutar declaración
      await gameSessionService.declareCards(gameId, username, declarations);

      // Emitir evento
      io.to(gameCode).emit('cardsDeclared', {
        username,
        declarations,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
  // Add this route
router.get('/:gameId/state', async (req, res) => {
  try {
    const gameSessionDoc = await db.collection('gameSessions').doc(req.params.gameId).get();
    if (!gameSessionDoc.exists) {
      return res.status(404).json({ message: 'Game not found' });
    }
    res.status(200).json(gameSessionDoc.data());
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
// routes/v1/gameSession.router.js
router.get('/:gameId/:gameCode/round-history', async (req, res) => { 
  try {
    const gameSessionDoc = await db.collection('gameSessions').doc(req.params.gameId).get();
    const rounds = gameSessionDoc.data().rounds.map(round => ({
      name: round.name,
      status: round.status,
      points: round.points,
      winner: round.winner
    }));
    
    res.status(200).json({ rounds });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
  return router; // Exportar el router una sola vez
};
