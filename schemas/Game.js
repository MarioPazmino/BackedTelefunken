// schemas/Game.js

const db = require('../ConexionFirebase/firebase');

// Esquema de la colección "games"
class Game {
  constructor(data) {
    this.code = data.code;
    this.title = data.title;
    this.gameId = data.gameId;
    this.createdBy = data.createdBy;
    this.creatorType = data.creatorType;
    this.isTemporary = data.isTemporary || false;
    this.players = data.players || [];
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  // Guardar la partida en Firestore
  async save() {
    const gameRef = db.collection('games').doc(this.gameId);
    await gameRef.set(this);
    return this;
  }

  // Actualizar la partida en Firestore
  async update(updateData) {
    const gameRef = db.collection('games').doc(this.gameId);
    await gameRef.update(updateData);
    return this;
  }
}

module.exports = Game;