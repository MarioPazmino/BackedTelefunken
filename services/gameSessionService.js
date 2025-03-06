// services/gameSessionService.js
const GameSession = require('../schemas/GameSession');
const { admin, db, FieldValue } = require('./../ConexionFirebase/firebase');

const assignDealerAndStarter = (players) => {
  const dealerIndex = Math.floor(Math.random() * players.length);
  const starterIndex = (dealerIndex + 1) % players.length; // El siguiente al dealer comienza
  return {
    dealer: players[dealerIndex].username, // Cambiar id por username
    starter: players[starterIndex].username, // Cambiar id por username
  };
};

const assignGameChooser = (players) => {
  const chooserIndex = Math.floor(Math.random() * players.length);
  return players[chooserIndex].username; // Cambiar id por username
};

const recordCardPurchase = async (gameId, username, card, tokensUsed) => {
  await db.collection('gameSessions').doc(gameId).update({
    actions: FieldValue.arrayUnion({  // Ya no usa admin.firestore.FieldValue
      type: 'card_purchase',
      username,
      card,
      tokensUsed,
      timestamp: new Date().toISOString(),
    }),
  });
};

const recordCardDiscard = async (gameId, username, card) => {
  await db.collection('gameSessions').doc(gameId).update({
    actions: admin.firestore.FieldValue.arrayUnion({
      type: 'card_discard',
      username, // Cambiar playerId por username
      card,
      timestamp: new Date().toISOString(),
    }),
  });
};

const recordGamePlayed = async (gameId, username, gameType, cards) => {
  await db.collection('gameSessions').doc(gameId).update({
    actions: admin.firestore.FieldValue.arrayUnion({
      type: 'game_played',
      username, // Cambiar playerId por username
      gameType,
      cards,
      timestamp: new Date().toISOString(),
    }),
  });
};

const recordGameExtension = async (gameId, username, extendedGameType, cardsAdded) => {
  await db.collection('gameSessions').doc(gameId).update({
    actions: admin.firestore.FieldValue.arrayUnion({
      type: 'game_extension',
      username, // Cambiar playerId por username
      extendedGameType,
      cardsAdded,
      timestamp: new Date().toISOString(),
    }),
  });
};

const calculateGamePoints = (gameType, cards) => {
  // Lógica para calcular puntos según el tipo de juego y las cartas
  switch (gameType) {
    case 'trío':
      return 10; // Ejemplo: 10 puntos por un trío
    case 'cuarteto':
      return 20; // Ejemplo: 20 puntos por un cuarteto
    case 'escalera':
      return 30; // Ejemplo: 30 puntos por una escalera
    default:
      return 0;
  }
};

const recordTokensUsed = async (gameId, username, tokensUsed) => {
  await db.collection('gameSessions').doc(gameId).update({
    tokensUsed: admin.firestore.FieldValue.arrayUnion({
      username, // Cambiar playerId por username
      tokensUsed,
      timestamp: new Date().toISOString(),
    }),
  });
};

const recordEarthquake = async (gameId, username) => {
  await db.collection('gameSessions').doc(gameId).update({
    specialEvents: admin.firestore.FieldValue.arrayUnion({
      type: 'earthquake',
      username, // Cambiar playerId por username
      timestamp: new Date().toISOString(),
    }),
  });
};

const recordOutOfTokens = async (gameId, username) => {
  await db.collection('gameSessions').doc(gameId).update({
    specialEvents: admin.firestore.FieldValue.arrayUnion({
      type: 'out_of_tokens',
      username, // Cambiar playerId por username
      timestamp: new Date().toISOString(),
    }),
  });
};

const recordDeckReshuffle = async (gameId) => {
  await db.collection('gameSessions').doc(gameId).update({
    specialEvents: admin.firestore.FieldValue.arrayUnion({
      type: 'deck_reshuffle',
      timestamp: new Date().toISOString(),
    }),
  });
};

const recordPenalty = async (gameId, username, reason) => {
  await db.collection('gameSessions').doc(gameId).update({
    penalties: admin.firestore.FieldValue.arrayUnion({
      username, // Cambiar playerId por username
      reason,
      timestamp: new Date().toISOString(),
    }),
  });
};

const updateTournamentScores = async (tournamentId, username, points) => {
  const tournamentRef = db.collection('tournaments').doc(tournamentId);
  await tournamentRef.update({
    [`scores.${username}`]: admin.firestore.FieldValue.increment(points), // Cambiar playerId por username
  });
};

const nextTurn = (currentTurn, players) => {
  const currentIndex = players.findIndex(player => player.username === currentTurn); // Cambiar id por username
  return players[(currentIndex + 1) % players.length].username; // Cambiar id por username
};

const recordAction = async (gameId, username, action) => {
  const gameSessionRef = db.collection('gameSessions').doc(gameId);
  await gameSessionRef.update({
    actions: admin.firestore.FieldValue.arrayUnion({
      username, // Ya se usa username, no es necesario modificar
      action,
      timestamp: new Date().toISOString(),
    }),
  });
};

const calculatePoints = (actions) => {
  const points = {};
  actions.forEach(action => {
    if (action.type === 'game_played') {
      // Calcular puntos según el tipo de juego y las cartas
      const gamePoints = calculateGamePoints(action.gameType, action.cards);
      points[action.username] = (points[action.username] || 0) + gamePoints; // Cambiar playerId por username
    }
  });
  return points;
};

// Determinar el ganador basado en las puntuaciones
const determineWinner = (points) => {
  let minPoints = Infinity;
  let winner = null;
  Object.keys(points).forEach(username => {
    if (points[username] < minPoints) {
      minPoints = points[username];
      winner = username; // Cambiar playerId por username
    }
  });
  return winner;
};

// Guardar los resultados de la partida
const saveGameResults = async (gameId, results) => {
  const gameSessionRef = db.collection('gameSessions').doc(gameId);
  await gameSessionRef.update({ results });
};

const recordJokerUse = async (gameId, username, jokerCard, context) => {
  await db.collection('gameSessions').doc(gameId).update({
    jokerUses: admin.firestore.FieldValue.arrayUnion({
      username, // Cambiar playerId por username
      jokerCard,
      context,
      timestamp: new Date().toISOString(),
    }),
  });
};

// Iniciar la partida (asignar dealer, jugador que comienza, etc.)
const startGameSession = async (gameId, players, gameCode) => { // Agregar gameCode como parámetro
  try {
    const { dealer, starter } = assignDealerAndStarter(players);

    const initialGameState = new GameSession({
      gameId,
      gameCode, // Incluir gameCode aquí
      dealer,
      currentTurn: starter,
      players,
      status: 'in_progress',
      actions: [],
      jokerUses: [],
      results: {},
    });

    await initialGameState.save();
    return initialGameState.toJSON();
  } catch (error) {
    throw new Error(`Error al iniciar la partida: ${error.message}`);
  }
};

// Finalizar la partida (calcular puntuaciones, determinar ganador, etc.)
const endGameSession = async (gameId) => {
  try {
    // Obtener la sesión de juego
    const gameSessionDoc = await db.collection('gameSessions').doc(gameId).get();
    if (!gameSessionDoc.exists) {
      throw new Error('Sesión de juego no encontrada');
    }

    const gameSessionData = gameSessionDoc.data();

    // Calcular puntuaciones
    const points = calculatePoints(gameSessionData.actions);

    // Determinar el ganador
    const winner = determineWinner(points);

    // Guardar los resultados finales
    const results = {
      points,
      winner,
      endedAt: new Date().toISOString(),
    };

    await saveGameResults(gameId, results);

    return results;
  } catch (error) {
    throw new Error(`Error al finalizar la partida: ${error.message}`);
  }
};

const endTurn = async (gameId, nextPlayer) => {
  await db.collection('gameSessions').doc(gameId).update({
    currentTurn: nextPlayer,
    updatedAt: new Date().toISOString()
  });
};

module.exports = {
  assignDealerAndStarter,
  nextTurn,
  recordAction,
  calculatePoints,
  determineWinner,
  saveGameResults,
  recordJokerUse,
  startGameSession,
  endGameSession,
  recordCardPurchase,
  assignGameChooser,
  recordCardDiscard,
  recordGamePlayed,
  recordGameExtension,
  recordTokensUsed,
  recordEarthquake,
  recordOutOfTokens,
  recordDeckReshuffle,
  recordPenalty,
  updateTournamentScores,
  calculateGamePoints,
  endTurn
};
