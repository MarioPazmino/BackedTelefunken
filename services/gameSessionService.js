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


// Modificación en startGameSession
const startGameSession = async (gameId, players, gameCode) => {
  try {
    const { dealer, starter } = assignDealerAndStarter(players);

    const initialGameState = new GameSession({
      gameId,
      gameCode,
      dealer,
      currentTurn: starter,
      players,
      status: 'in_progress',
      actions: [],
      results: {},
      tokensUsed: players.reduce((acc, p) => ({...acc, [p.username]: 0}), {})
    });

    await initialGameState.save();
    return initialGameState.toJSON();
  } catch (error) {
    throw new Error(`Error iniciando partida: ${error.message}`);
  }
};


// Modificación en endGameSession
const endGameSession = async (gameId) => {
  try {
    const gameSessionDoc = await db.collection('gameSessions').doc(gameId).get();
    if (!gameSessionDoc.exists) throw new Error('Sesión no encontrada');

    const gameSession = new GameSession(gameSessionDoc.data());
    const totalPoints = {};

    // Inicializar puntos
    gameSession.players.forEach(p => totalPoints[p.username] = 0);

    // Acumular puntos de todas las rondas
    gameSession.rounds.forEach(round => {
      Object.entries(round.points || {}).forEach(([user, pointData]) => {
        totalPoints[user] += pointData.total || 0;
      });
    });

    const winner = determineWinner(totalPoints);
    const results = { 
      points: totalPoints, 
      winner, 
      endedAt: new Date().toISOString(),
      roundDetails: gameSession.rounds.map(r => ({
        name: r.name,
        points: r.points,
        winner: r.winner
      }))
    };

    await saveGameResults(gameId, results);
    return results;
  } catch (error) {
    throw new Error(`Error finalizando partida: ${error.message}`);
  }
}

const endTurn = async (gameId, nextPlayer) => {
  await db.collection('gameSessions').doc(gameId).update({
    currentTurn: nextPlayer,
    updatedAt: new Date().toISOString()
  });
};


// Reclamar una ronda
const claimRound = async (gameId, username, tokenCount) => {
  const gameSessionDoc = await db.collection('gameSessions').doc(gameId).get();
  const gameSession = new GameSession(gameSessionDoc.data());
  const currentRound = gameSession.rounds[gameSession.currentRound];

  if (currentRound.status !== 'pending') {
    throw new Error('Esta ronda ya ha sido finalizada');
  }

  if ((gameSession.tokensUsed[username] || 0) + tokenCount > 12) {
    throw new Error('Excediste el límite de fichas');
  }

  await db.collection('gameSessions').doc(gameId).update({
    [`tokensUsed.${username}`]: FieldValue.increment(tokenCount),
    [`rounds.${gameSession.currentRound}.claimedBy`]: username
  });
}

// Aprobar/Rechazar un reclamo
// Modificar función approveRound
const approveRound = async (gameId, approver, approved) => {
  const gameSessionDoc = await db.collection('gameSessions').doc(gameId).get();
  const gameSession = new GameSession(gameSessionDoc.data());
  const currentRound = gameSession.rounds[gameSession.currentRound];

  if (!currentRound.claimedBy) {
    throw new Error('Ningún jugador ha reclamado esta ronda');
  }

  if (approver === currentRound.claimedBy) {
    throw new Error('El reclamante no puede validar su propia jugada');
  }

  const updateData = {};
  const points = {};

  if (approved) {
    // Asignar 0 puntos al reclamante
    points[currentRound.claimedBy] = {
      total: 0,
      declarations: {},
      penalty: 0
    };

    // Calcular puntos para otros jugadores
    gameSession.players.forEach(player => {
      if (player.username !== currentRound.claimedBy) {
        const declarations = currentRound.declarations?.[player.username] || {};
        points[player.username] = {
          total: calculatePoints(declarations),
          declarations,
          penalty: 0
        };
      }
    });
    
    updateData[`rounds.${gameSession.currentRound}.status`] = 'completed';
    updateData[`rounds.${gameSession.currentRound}.winner`] = currentRound.claimedBy;
  } else {
    // Penalizar al reclamante
    points[currentRound.claimedBy] = {
      total: 50,
      declarations: currentRound.declarations?.[currentRound.claimedBy] || {},
      penalty: 50
    };

    // Calcular puntos para otros jugadores
    gameSession.players.forEach(player => {
      if (player.username !== currentRound.claimedBy) {
        const declarations = currentRound.declarations?.[player.username] || {};
        points[player.username] = {
          total: calculatePoints(declarations),
          declarations,
          penalty: 0
        };
      }
    });
    
    updateData[`rounds.${gameSession.currentRound}.status`] = 'penalized';
  }

  updateData[`rounds.${gameSession.currentRound}.points`] = points;

  // Actualizar estado de ronda
  await db.collection('gameSessions').doc(gameId).update(updateData);

  // Pasar a siguiente ronda o finalizar juego
  if (gameSession.currentRound < 6) {
    await db.collection('gameSessions').doc(gameId).update({
      currentRound: gameSession.currentRound + 1,
      currentTurn: gameSession.dealer // El dealer siempre inicia la siguiente ronda
    });
  } else {
    await endGameSession(gameId);
  }
}

// Declarar cartas
const declareCards = async (gameId, username, declarations) => {
  const gameSessionDoc = await db.collection('gameSessions').doc(gameId).get();
  const gameSession = new GameSession(gameSessionDoc.data());
  const currentRound = gameSession.rounds[gameSession.currentRound];

  if (currentRound.status !== 'pending') {
    throw new Error('Esta ronda ya ha sido finalizada');
  }

  if (currentRound.claimedBy === username) {
    throw new Error('El reclamante no puede declarar cartas');
  }

  await db.collection('gameSessions').doc(gameId).update({
    [`rounds.${gameSession.currentRound}.declarations.${username}`]: declarations
  });
}

// Calcular puntos basados en declaraciones
const calculatePoints = (declarations) => {
  let total = 0;
  for (const [card, count] of Object.entries(declarations)) {
    switch(card) {
      case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
        total += count * 5;
        break;
      case '10': case 'J': case 'Q': case 'K':
        total += count * 10;
        break;
      case 'A':
        total += count * 15;
        break;
      case 'Joker':
        total += count * 50;
        break;
      default:
        throw new Error(`Carta no válida: ${card}`);
    }
  }
  return total;
}




module.exports = {
  assignDealerAndStarter,
  nextTurn,
  recordAction,
  determineWinner,
  saveGameResults,
  startGameSession,
  endGameSession,
  assignGameChooser,
  endTurn,
  claimRound,
  approveRound,
  declareCards,
  calculatePoints
};
