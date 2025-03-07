// schemas/GameSession.js
const { admin, db, FieldValue } = require('./../ConexionFirebase/firebase');

class GameSession {
  constructor(data) {
    this.gameId = data.gameId;
    this.gameCode = data.gameCode;
    this.dealer = data.dealer;
    this.currentTurn = data.currentTurn;
    this.players = this.validatePlayers(data.players || []);
    this.status = data.status || 'in_progress';
    this.actions = data.actions || [];
    this.jokerUses = data.jokerUses || [];
    this.results = data.results || {};
    this.tokensUsed = data.tokensUsed || {};
    // Nuevos campos para el sistema de rondas y fichas

    this.rounds = data.rounds || [
      { 
        name: 'Trío', 
        status: 'pending', 
        winner: null, 
        points: {}, // Ahora almacenará objetos con detalles
        declarations: {},
        tokensUsed: {} // Para almacenar fichas usadas
      },
      { 
        name: 'Dos Tríos', 
        status: 'pending', 
        winner: null, 
        points: {},
        declarations: {},
        tokensUsed: {} // Para almacenar fichas usadas
      },
      { 
        name: 'Cuarteto', 
        status: 'pending', 
        winner: null, 
        points: {}, // Ahora almacenará objetos con detalles
        declarations: {}, // Para almacenar declaraciones temporales
        tokensUsed: {} // Para almacenar fichas usadas
      },
      { 
        name: 'Dos Cuartetos', 
        status: 'pending', 
        winner: null, 
        points: {},
        declarations: {},
        tokensUsed: {} // Para almacenar fichas usadas
      },
      { 
        name: 'Quinteto', 
        status: 'pending', 
        winner: null, 
        points: {}, // Ahora almacenará objetos con detalles
        declarations: {}, // Para almacenar declaraciones temporales
        tokensUsed: {} // Para almacenar fichas usadas
      },
      { 
        name: 'Dos Quinteto', 
        status: 'pending', 
        winner: null, 
        points: {},
        declarations: {},
        tokensUsed: {}
      },
      { 
        name: 'Escalera', 
        status: 'pending', 
        winner: null, 
        points: {},
        declarations: {},
        tokensUsed: {}
      },
    ];
    this.currentRound = data.currentRound || 0;
    this.tokensUsed = data.tokensUsed || {};
    
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  validatePlayers(players) {
    if (!Array.isArray(players)) {
      throw new Error('Players must be an array');
    }

    return players.map(player => ({
      username: player.username,
      status: player.status || 'active',
      joinedAt: player.joinedAt || new Date().toISOString()
    }));
  }

  toJSON() {
    return {
      gameId: this.gameId,
      gameCode: this.gameCode,
      dealer: this.dealer,
      currentTurn: this.currentTurn,
      players: this.players,
      status: this.status,
      actions: this.actions,
      jokerUses: this.jokerUses,
      results: this.results,
      rounds: this.rounds.map(round => ({ // Estructura detallada
        name: round.name,
        status: round.status,
        winner: round.winner,
        points: round.points,
        declarations: round.declarations
      })),
      currentRound: this.currentRound,
      tokensUsed: this.tokensUsed,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
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
      const updatedSession = { 
        ...this.toJSON(), 
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      
      await db.collection('gameSessions').doc(this.gameId).update(updatedSession);
      Object.assign(this, updatedSession);
      return this;
    } catch (error) {
      throw new Error(`Error updating game session: ${error.message}`);
    }
  }
}

module.exports = GameSession;