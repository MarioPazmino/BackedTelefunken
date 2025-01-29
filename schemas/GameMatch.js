//schemas/GameMatch.js
const db = require('../ConexionFirebase/firebase');
const { v4: uuidv4 } = require('uuid');

class GameMatch {
  constructor({ gameId, players }) {
    if (!gameId || !Array.isArray(players) || players.length === 0) {
      throw new Error('Datos insuficientes: se requiere gameId y al menos un jugador.');
    }

    this.matchId = uuidv4();
    this.gameId = gameId;
    this.status = 'in_progress';
    this.currentRound = 1;
    this.players = this.initializePlayers(players);
    this.startedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  initializePlayers(players) {
    return players.map(player => ({
      playerId: player.id,
      playerName: player.name,
      rounds: [],
      totalScore: 0,
      fichasGastadas: 0,
      telefunkens: 0,
      status: 'active'
    }));
  }

  toJSON() {
    return {
      matchId: this.matchId,
      gameId: this.gameId,
      status: this.status,
      currentRound: this.currentRound,
      players: this.players,
      startedAt: this.startedAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    try {
      await db.collection('gameMatches').doc(this.matchId).set(this.toJSON());
      console.log(`Match creado con ID: ${this.matchId}`);
      return this;
    } catch (error) {
      throw new Error(`Error al guardar el match: ${error.message}`);
    }
  }
}

module.exports = GameMatch;
