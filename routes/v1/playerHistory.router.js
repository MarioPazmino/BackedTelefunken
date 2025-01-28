// routes/v1/playerHistory.router.js
const express = require('express');
const router = express.Router();
const { getPlayerHistory } = require('../../services/playerHistoryService');

router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    console.log('Received request for userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'El parámetro userId es requerido.',
        details: 'Missing required query parameter: userId'
      });
    }

    const history = await getPlayerHistory(userId);
    res.json(history);
    
  } catch (error) {
    console.error('Detailed router error:', {
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;