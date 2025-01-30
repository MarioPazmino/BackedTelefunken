// services/gameScoreService.js
const db = require('../ConexionFirebase/firebase');
const { v4: uuidv4 } = require('uuid');
const GameMatch = require('../schemas/GameMatch');

class GameScoreService {


    async initializeGameMatch(gameId, players) {
        try {
            if (!gameId || !players || !Array.isArray(players)) {
                throw new Error('Invalid parameters for game initialization');
            }

            // Create new game match instance
            const gameMatch = new GameMatch({
                gameId,
                players,
                status: 'in_progress',
                currentRound: 1
            });

            // Save to database
            await gameMatch.save();

            return gameMatch.toJSON();
        } catch (error) {
            console.error('Error in initializeGameMatch:', error);
            throw new Error(`Failed to initialize game match: ${error.message}`);
        }
    }
    async getMatchStatus(matchId) {
        try {
            const match = await GameMatch.findById(matchId);
            return match.toJSON();
        } catch (error) {
            console.error('Error in getMatchStatus:', error);
            throw error;
        }
    }

    async recordRoundScore(matchId, playerId, roundData) {
        try {
            if (!matchId || !playerId || !roundData) {
                throw new Error('Missing required parameters');
            }

            const match = await GameMatch.findById(matchId);
            if (!match) {
                throw new Error(`Match not found with ID: ${matchId}`);
            }

            const playerIndex = match.players.findIndex(p => p.playerId === playerId);
            if (playerIndex === -1) {
                throw new Error(`Player ${playerId} not found in match ${matchId}`);
            }

            // Update player data
            match.players[playerIndex].rounds.push({
                roundNumber: match.currentRound,
                ...roundData,
                timestamp: new Date().toISOString()
            });

            // Update statistics
            match.players[playerIndex].totalScore = (match.players[playerIndex].totalScore || 0) + (roundData.points || 0);
            match.players[playerIndex].fichasGastadas = (match.players[playerIndex].fichasGastadas || 0) + (roundData.fichasUsadas || 0);
            match.players[playerIndex].telefunkens = (match.players[playerIndex].telefunkens || 0) + (roundData.telefunken ? 1 : 0);

            match.status = 'in_progress';
            match.currentRound = match.currentRound + 1;
            match.updatedAt = new Date().toISOString();

            // Save the updated match
            await match.save();

            return {
                success: true,
                currentRound: match.currentRound,
                status: match.status,
                playerScore: match.players[playerIndex]
            };
        } catch (error) {
            console.error('Error in recordRoundScore:', error);
            throw new Error(`Failed to record round score: ${error.message}`);
        }
    }
}
module.exports = new GameScoreService();