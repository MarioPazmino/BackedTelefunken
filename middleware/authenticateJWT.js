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
    const userSnapshot = await User.doc(decoded.userId).get();

    if (!userSnapshot.exists) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    req.user = userSnapshot.data();
    req.user.userId = userSnapshot.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token no válido' });
  }
};

module.exports = authenticateJWT;