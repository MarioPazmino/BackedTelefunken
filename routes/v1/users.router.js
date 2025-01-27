// routes/v1/users.router.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../ConexionFirebase/firebase');

// Ruta para registrar un nuevo usuario
router.post('/register', async (req, res) => {
  const { name, email, username, password } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    // Verificar si el email ya existe
    const emailSnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();

    if (!emailSnapshot.empty) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    // Verificar si el username ya existe
    const usernameSnapshot = await db.collection('users')
      .where('username', '==', username)
      .get();

    if (!usernameSnapshot.empty) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
    }

    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el nuevo usuario
    const newUser = {
      name,
      email,
      username,
      password: hashedPassword,
      createdAt: new Date()
    };

    // Guardar en Firebase
    await db.collection('users').add(newUser);

    res.status(201).json({ message: 'Usuario registrado con éxito' });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Hubo un problema al registrar el usuario' });
  }
});

// Ruta para iniciar sesión
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    // Buscar usuario por username
    const userSnapshot = await db.collection('users')
      .where('username', '==', username)
      .get();

    if (userSnapshot.empty) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Contraseña incorrecta' });
    }

    // Crear token
    const token = jwt.sign(
      { 
        userId: userDoc.id, 
        username: userData.username 
      },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '1h' }
    );

    res.status(200).json({ 
      message: 'Inicio de sesión exitoso', 
      token,
      user: {
        id: userDoc.id,
        name: userData.name,
        email: userData.email,
        username: userData.username
      }
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Hubo un problema al iniciar sesión' });
  }
});

module.exports = router;