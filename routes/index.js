// routes/index.js
const express = require('express');
const usersRouter = require('./v1/users.router');
const gamesRouter = require('./v1/games.router');
const waitingRoomRouter = require('./v1/waitingRoom.router');
const gameScoreRouter = require('./v1/gameScore.router');

function routerApi(app) {
  const router = express.Router();
  app.use('/api/v1', router);
  router.use('/users', usersRouter);
  router.use('/games', gamesRouter);
  router.use('/waiting-room', waitingRoomRouter);
  router.use('/game-score', gameScoreRouter);
}


module.exports = routerApi;
