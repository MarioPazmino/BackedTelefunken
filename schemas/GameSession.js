// schemas/GameSession.js
const { admin, db, FieldValue } = require('./../ConexionFirebase/firebase');

// schemas/GameSession.js

class GameSession {
  constructor(data) {
    this.gameId = data.gameId;
    this.gameCode = data.gameCode; // Agregar gameCode
    this.dealer = data.dealer;
    this.currentTurn = data.currentTurn;
    this.players = this.validatePlayers(data.players || []);
    this.status = data.status || 'in_progress';
    this.actions = data.actions || [];
    this.jokerUses = data.jokerUses || [];
    this.results = data.results || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  // Función para validar y formatear los jugadores
  validatePlayers(players) {
    if (!Array.isArray(players)) {
      throw new Error('Players must be an array');
    }

    return players.map(player => ({
      username: player.username, // Usar username como identificador principal
      status: player.status || 'active', // Estado del jugador (activo por defecto)
      joinedAt: player.joinedAt || new Date().toISOString(), // Fecha de unión
    }));
  }

  toJSON() {
    return {
      gameId: this.gameId,
      gameCode: this.gameCode, // Incluir gameCode en el JSON
      dealer: this.dealer,
      currentTurn: this.currentTurn,
      players: this.players,
      status: this.status,
      actions: this.actions,
      jokerUses: this.jokerUses,
      results: this.results,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  async save() {
    try {
      await db.collection('gameSessions').doc(this.gameId).set(this.toJSON());
      return this;
    } catch (error) {
      throw new Error(`Error saving game session: ${error.message}`);
    }
  }

  async update(updateData) {
    try {
      const updatedSession = { ...this.toJSON(), ...updateData, updatedAt: new Date().toISOString() };
      await db.collection('gameSessions').doc(this.gameId).update(updatedSession);
      Object.assign(this, updatedSession);
      return this;
    } catch (error) {
      throw new Error(`Error updating game session: ${error.message}`);
    }
  }
}

module.exports = GameSession;