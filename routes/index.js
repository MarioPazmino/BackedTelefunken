// routes/index.js
const express = require('express');
const usersRouter = require('./v1/users.router');

function routerApi(app) {
  const router = express.Router();
  app.use('/api/v1', router);
  router.use('/users', usersRouter);
}

module.exports = routerApi;
