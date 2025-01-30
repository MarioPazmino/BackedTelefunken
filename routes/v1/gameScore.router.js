// routes/v1/gameScore.router.js
const express = require('express');
const router = express.Router();
const gameScoreService = require('../../services/gameScoreService');

// Inicializar un nuevo juego
router.post('/initialize', async (req, res) => {
  try {
      console.log('Initialize request body:', req.body);
      const { gameId, players } = req.body;

if (!gameId || !players) {
    return res.status(400).json({ 
        success: false, 
        message: 'gameId and players are required' 
    });
}
console.log('Initialize request body:', req.body);


      const gameMatch = await gameScoreService.initializeGameMatch(gameId, players);
      res.status(201).json(gameMatch);
  } catch (error) {
      console.error('Initialize error:', error);
      res.status(400).json({ 
          success: false, 
          message: error.message,
          details: error.stack
      });
  }
});

// Registrar puntuación de una ronda
router.post('/record-score', async (req, res) => {
  try {
    const { matchId, playerId, roundData } = req.body;
    const result = await gameScoreService.recordRoundScore(matchId, playerId, roundData);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Obtener estado actual del juego
// Add this to your router
router.get('/game/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const matchStatus = await GameMatch.findByGameId(gameId);
    res.status(200).json(matchStatus);
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

module.exports = router;