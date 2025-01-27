const playerHistoryConverter = {
    toFirestore: (history) => {
      return {
        userId: history.userId,
        gameCode: history.gameCode,
        gameType: history.gameType,
        joinedAt: history.joinedAt || new Date(),
        performance: history.performance || {},
        completedAt: history.completedAt,
        createdAt: history.createdAt || new Date(),
        updatedAt: new Date()
      };
    },
    fromFirestore: (snapshot, options) => {
      const data = snapshot.data(options);
      return {
        id: snapshot.id,
        ...data,
        joinedAt: data.joinedAt.toDate(),
        completedAt: data.completedAt?.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      };
    }
  };
  
  module.exports = playerHistoryConverter;