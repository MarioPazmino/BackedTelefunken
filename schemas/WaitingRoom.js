
// schemas/WaitingRoom.js
const db = require('../ConexionFirebase/firebase');
const { v4: uuidv4 } = require('uuid');

class WaitingRoom {
  constructor(data) {
    if (!data || !data.gameCode) {
      throw new Error('Datos de sala de espera inválidos: faltan campos requeridos');
    }

    this.roomId = data.roomId || uuidv4();
    this.gameId = data.gameId;
    this.gameCode = data.gameCode;
    this.status = this.validateStatus(data.status || 'waiting');
    this.minPlayers = data.minPlayers || 2;
    this.maxPlayers = data.maxPlayers || 6;
    this.players = this.validatePlayers(data.players || []);
    this.activePlayers = this.countActivePlayers();
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  validateStatus(status) {
    const validStatuses = ['waiting', 'ready', 'started'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Estado inválido: ${status}`);
    }
    return status;
  }

  validatePlayers(players) {
    if (!Array.isArray(players)) {
      throw new Error('Los jugadores deben ser un array');
    }
    return players.map(player => ({
      id: player.username, // Usamos el username como identificador del jugador
      username: player.username, // Aseguramos que solo usamos el username
      status: player.status || 'active',
      joinedAt: player.joinedAt || new Date().toISOString()
    }));
  }

  countActivePlayers() {
    return this.players.filter(player => player.status === 'active').length;
  }

  isReadyToStart() {
    return this.activePlayers >= this.minPlayers;
  }

  toJSON() {
    return {
      roomId: this.roomId,
      gameId: this.gameId,
      gameCode: this.gameCode,
      status: this.status,
      minPlayers: this.minPlayers,
      maxPlayers: this.maxPlayers,
      players: this.players,
      activePlayers: this.activePlayers,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  async save() {
    try {
      await db.collection('waitingRooms').doc(this.roomId).set(this.toJSON());
      return this;
    } catch (error) {
      throw new Error(`Error al guardar la sala de espera: ${error.message}`);
    }
  }

  async update(updateData) {
    try {
      const updatedRoom = { ...this.toJSON(), ...updateData, updatedAt: new Date().toISOString() };
      await db.collection('waitingRooms').doc(this.roomId).update(updatedRoom);
      Object.assign(this, updatedRoom);
      return this;
    } catch (error) {
      throw new Error(`Error al actualizar la sala de espera: ${error.message}`);
    }
  }
}

module.exports = WaitingRoom;
