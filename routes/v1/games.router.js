

// routes/v1/games.router.js

const express = require('express');
const router = express.Router();
const gameService = require('../../services/gameService');
const gameSessionService = require('../../services/gameSessionService'); 

// Crear una nueva partida
router.post('/create', async (req, res) => {
  try {
    const { username, creatorType, isTemporary, gameCode } = req.body; // Recibimos username en lugar de userId
    const newGame = await gameService.createGame(username, creatorType, isTemporary, gameCode);
    res.status(201).json(newGame);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Unirse a una partida existente
router.post('/join', async (req, res) => {
  try {
    const { gameCode, username } = req.body; // Recibimos username en lugar de userId
    const game = await gameService.joinGame(gameCode, username);
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

