// middleware/authenticateJWT.js
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const User = require('../schemas/User');

const authenticateJWT = async (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, 'secret_key');
    
    // Buscar al usuario por username
    const userSnapshot = await User.where('username', '==', decoded.username).get();

    if (userSnapshot.empty) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const userDoc = userSnapshot.docs[0];
    req.user = userDoc.data(); // Solo pasamos los datos del usuario, sin userId
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token no válido' });
  }
};

module.exports = authenticateJWT;