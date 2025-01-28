// routes/v1/games.router.js

const express = require('express');
const router = express.Router();
const gameService = require('../../services/gameService');

// Crear una nueva partida
// Crear una nueva partida
router.post('/create', async (req, res) => {
  try {
    const { userId, creatorType, isTemporary, gameCode } = req.body; // Asegúrate de recibir gameCode
    const newGame = await gameService.createGame(userId, creatorType, isTemporary, gameCode); // Pasar el gameCode
    res.status(201).json(newGame);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// Unirse a una partida existente
router.post('/join', async (req, res) => {
  try {
    const { gameCode, userId, playerType, playerName } = req.body;
    const game = await gameService.joinGame(gameCode, userId, playerType, playerName);
    res.status(200).json(game);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Obtener una partida por su ID
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await gameService.getGameById(gameId);
    res.status(200).json(game);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;