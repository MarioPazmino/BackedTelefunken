// routes/index.js
const express = require('express');
const usersRouter = require('./v1/users.router');
const gamesRouter = require('./v1/games.router');
const playerHistoryRouter = require('./v1/playerHistory.router'); // Importa el nuevo router

function routerApi(app) {
  const router = express.Router();
  app.use('/api/v1', router);
  router.use('/users', usersRouter);
  router.use('/games', gamesRouter);
  router.use('/player-history', playerHistoryRouter); // Registra la nueva ruta
}

module.exports = routerApi;
