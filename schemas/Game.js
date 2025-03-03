





// schemas/Game.js
const db = require('../ConexionFirebase/firebase');

class Game {
  constructor(data) {
    this.code = data.code;
    this.title = data.title;
    this.gameId = data.gameId;
    this.createdBy = data.createdBy; // Usamos el username en lugar de userId
    this.creatorType = data.creatorType;
    this.isTemporary = data.isTemporary || false;
    this.players = this.validatePlayers(data.players || []);
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  validatePlayers(players) {
    if (!Array.isArray(players)) {
      throw new Error('Players must be an array');
    }
    return players.map(player => ({
      id: player.username, // Usamos el username como identificador del jugador
      username: player.username, // Aseguramos que solo usamos el username
      status: player.status || 'active',
      joinedAt: player.joinedAt || new Date().toISOString()
    }));
  }

  async save() {
    const gameRef = db.collection('games').doc(this.gameId);
    await gameRef.set(this);
    return this;
  }

  async update(updateData) {
    const gameRef = db.collection('games').doc(this.gameId);
    await gameRef.update(updateData);
    return this;
  }
}
module.exports = Game;