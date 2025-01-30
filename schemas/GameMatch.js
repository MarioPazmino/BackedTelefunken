// schemas/GameMatch.js
const db = require('../ConexionFirebase/firebase');
const { v4: uuidv4 } = require('uuid');

class GameMatch {
  constructor({ gameId, players, matchId = null, status = 'in_progress', currentRound = 1, startedAt = null, updatedAt = null }) {
    if (!gameId || !Array.isArray(players)) {
      throw new Error('Datos insuficientes: se requiere gameId y array de jugadores.');
    }

    this.matchId = matchId || uuidv4();
    this.gameId = gameId;
    this.status = status;
    this.currentRound = currentRound;
    this.players = Array.isArray(players) && players[0]?.playerId ? 
      players : 
      this.initializePlayers(players);
    this.startedAt = startedAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();
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
      const docRef = db.collection('gameMatches').doc(this.matchId);
      await docRef.set(this.toJSON());
      console.log(`Match saved with ID: ${this.matchId}`);
      return this;
    } catch (error) {
      console.error('Error saving match:', error);
      throw new Error(`Error saving match: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      // First try to find by matchId
      let docRef = db.collection('gameMatches').doc(id);
      let doc = await docRef.get();

      if (!doc.exists) {
        // If not found, try to find by gameId
        const snapshot = await db.collection('gameMatches')
          .where('gameId', '==', id)
          .limit(1)
          .get();

        if (snapshot.empty) {
          throw new Error(`Match no encontrado con ID: ${id}`);
        }

        doc = snapshot.docs[0];
      }

      const data = doc.data();
      return new GameMatch({
        gameId: data.gameId,
        players: data.players,
        matchId: data.matchId,
        status: data.status,
        currentRound: data.currentRound,
        startedAt: data.startedAt,
        updatedAt: data.updatedAt
      });
    } catch (error) {
      console.error('Error finding match:', error);
      throw new Error(`Error al buscar el match: ${error.message}`);
    }
  }
  static async findByGameId(gameId) {
    try {
      const snapshot = await db.collection('gameMatches')
        .where('gameId', '==', gameId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error(`Match no encontrado con gameId: ${gameId}`);
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      
      return new GameMatch({
        gameId: data.gameId,
        players: data.players,
        matchId: data.matchId,
        status: data.status,
        currentRound: data.currentRound,
        startedAt: data.startedAt,
        updatedAt: data.updatedAt
      });
    } catch (error) {
      console.error('Error finding match by gameId:', error);
      throw new Error(`Error al buscar el match por gameId: ${error.message}`);
    }
  }
}

module.exports = GameMatch;