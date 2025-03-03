const express = require('express');
const usersRouter = require('./v1/users.router');
const gamesRouter = require('./v1/games.router');
const waitingRoomRouter = require('./v1/waitingRoom.router');
const gameSessionRouter = require('./v1/gameSession.router');

function routerApi(app, io) { // Aceptar `io` como parámetro
  const router = express.Router();
  app.use('/api/v1', router);

  // Pasar `io` a las rutas que lo necesiten
  router.use('/users', usersRouter);
  router.use('/games', gamesRouter);
  router.use('/waiting-room', waitingRoomRouter);
  router.use('/game-session', gameSessionRouter(io)); // Pasar `io` a gameSessionRouter
}

module.exports = routerApi;