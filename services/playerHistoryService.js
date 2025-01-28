const PlayerHistory = require('../schemas/PlayerHistory');

const addToHistory = async (historyData) => {
  await PlayerHistory.add({
    ...historyData,
    joinedAt: new Date(),
  });
};


// services/playerHistoryService.js
const getPlayerHistory = async (userId) => {
  try {
    console.log('Attempting to fetch history for userId:', userId);
    
    // Simplified query that doesn't require a composite index
    const snapshot = await PlayerHistory
      .where('userId', '==', userId)
      .get();

    // Sort the results in memory
    const results = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a, b) => b.joinedAt.toDate() - a.joinedAt.toDate());

    return results;
    
  } catch (error) {
    console.error('Detailed error in getPlayerHistory:', error);
    throw new Error(`Error al obtener el historial del jugador: ${error.message}`);
  }
};

const clearOldHistory = async (days) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const snapshot = await PlayerHistory.where('joinedAt', '<=', cutoffDate).get();

  const batch = PlayerHistory.firestore.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`${snapshot.size} entradas antiguas de historial eliminadas.`);
};

module.exports = {
  addToHistory,
  getPlayerHistory,
  clearOldHistory,
};
