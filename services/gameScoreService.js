// services/gameScoreService.js

const db = require('../ConexionFirebase/firebase');
const { v4: uuidv4 } = require('uuid');
const GameMatch = require('../schemas/GameMatch');

class GameScoreService {
    async initializeGameMatch(gameId, players) {
        try {
          // Utilizamos el esquema GameMatch
          const gameMatch = new GameMatch({ gameId, players });
          await gameMatch.save(); // Guarda automáticamente en Firebase
          return gameMatch.toJSON(); // Devuelve los datos como JSON
        } catch (error) {
          throw new Error(`Error initializing game match: ${error.message}`);
        }
      }

      async recordRoundScore(matchId, playerId, roundData) {
        try {
          console.log('Datos recibidos:', { matchId, playerId, roundData }); // <-- Agrega esto
          const matchRef = db.collection('gameMatches').doc(matchId);
          const match = await matchRef.get();
    
          if (!match.exists) {
            throw new Error('Match not found');
          }
    
          const matchData = match.data();
          const playerIndex = matchData.players.findIndex(p => p.playerId === playerId);
    
          if (playerIndex === -1) {
            throw new Error('Player not found in match');
          }
    
          // Validar reglas del Telefunken
          this.validateTelefunkenRules(roundData);
    
          // Actualizar puntuación del jugador
          const updatedPlayers = [...matchData.players];
          const player = updatedPlayers[playerIndex];
    
          player.rounds.push({
            roundNumber: matchData.currentRound,
            ...roundData,
            timestamp: new Date().toISOString()
          });
    
          // Actualizar totales
          player.totalScore += roundData.points;
          player.fichasGastadas += roundData.fichasUsadas || 0;
          if (roundData.telefunken) player.telefunkens += 1;
    
          // Verificar condiciones de victoria
          const gameStatus = this.checkGameStatus(updatedPlayers);
    
          await matchRef.update({
            players: updatedPlayers,
            currentRound: gameStatus === 'completed' ? matchData.currentRound : matchData.currentRound + 1,
            status: gameStatus,
            updatedAt: new Date().toISOString()
          });
    
          return {
            success: true,
            currentRound: matchData.currentRound,
            status: gameStatus,
            playerScore: player
          };
        } catch (error) {
           
          throw new Error(`Error recording round score: ${error.message}`);
        }
      }
    

      validateTelefunkenRules(roundData) {
        if (roundData.points < 0) {
          throw new Error('Los puntos no pueden ser negativos');
        }
        if (roundData.fichasUsadas < 0) {
          throw new Error('El número de fichas gastadas no puede ser negativo');
        }
        // Agregar más validaciones según las reglas del juego
      }

  checkGameStatus(players) {
    const maxScore = Math.max(...players.map(p => p.totalScore));
    if (maxScore >= 1000) { // Cambia el límite según tus reglas
      return 'completed';
    }
    return 'in_progress';
  }

  async getMatchStatus(matchId) {
    try {
      const matchDoc = await db.collection('gameMatches').doc(matchId).get();
      if (!matchDoc.exists) {
        throw new Error('Match not found');
      }
      return matchDoc.data();
    } catch (error) {
      throw new Error(`Error getting match status: ${error.message}`);
    }
  }
}

module.exports = new GameScoreService();