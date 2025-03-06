// routes/v1/users.router.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { admin, db, FieldValue } = require('./../../ConexionFirebase/firebase');
const userService = require('../../services/userService');

// Ruta para registrar un nuevo usuario
router.post('/register', async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    // Verificar si el email ya existe
    const emailExists = await db.collection('users')
      .where('email', '==', email)
      .get();

    if (!emailExists.empty) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    // Verificar si el username ya existe
    const usernameExists = await db.collection('users')
      .where('username', '==', username)
      .get();

    if (!usernameExists.empty) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
    }

    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el nuevo usuario
    const newUser = {
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
      { username: userData.username }, // Solo incluimos el username en el token
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '1h' }
    );

    res.status(200).json({ 
      message: 'Inicio de sesión exitoso', 
      token,
      user: {
        email: userData.email,
        username: userData.username
      }
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Hubo un problema al iniciar sesión' });
  }
});

// Ruta para verificar si un nombre de usuario existe
router.get('/check-username', async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'El nombre de usuario es requerido' });
  }

  try {
    const { exists, suggestions } = await userService.checkUsernameExistsWithSuggestions(username);
    return res.status(200).json({ exists, suggestions });
  } catch (error) {
    console.error('Error al verificar el nombre de usuario:', error);
    res.status(500).json({ error: 'Error al verificar el nombre de usuario' });
  }
});

// Ruta para verificar si un correo electrónico ya está registrado
router.get('/check-email', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'El correo electrónico es requerido' });
  }

  try {
    // Verificar si el email ya existe en la base de datos
    const emailSnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();

    if (!emailSnapshot.empty) {
      return res.status(200).json({ exists: true }); // El correo ya existe
    } else {
      return res.status(200).json({ exists: false }); // El correo no existe
    }
  } catch (error) {
    console.error('Error al verificar el correo electrónico:', error);
    res.status(500).json({ error: 'Hubo un problema al verificar el correo electrónico' });
  }
});

// Ruta para registrar un usuario invitado
router.post('/guest-register', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'El nombre de usuario es obligatorio' });
  }

  try {
    // Verificar si el username ya existe
    const usernameSnapshot = await db.collection('users')
      .where('username', '==', username)
      .get();

    if (!usernameSnapshot.empty) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
    }

    // Crear el nuevo usuario invitado
    const newGuestUser = {
      username,
      isGuest: true,
      createdAt: new Date()
    };

    // Guardar en Firebase
    await db.collection('users').add(newGuestUser);

    // Crear token con duración de 5 días
    const token = jwt.sign(
      { username: newGuestUser.username }, // Solo incluimos el username en el token
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '5d' }
    );

    res.status(201).json({ message: 'Usuario invitado registrado con éxito', token });
  } catch (error) {
    console.error('Error al registrar usuario invitado:', error);
    res.status(500).json({ error: 'Hubo un problema al registrar el usuario invitado' });
  }
});

// Ruta para migrar un usuario invitado a usuario registrado
router.post('/migrate-guest', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    // Buscar al usuario por username
    const userSnapshot = await db.collection('users')
      .where('username', '==', username)
      .get();

    if (userSnapshot.empty || !userSnapshot.docs[0].data().isGuest) {
      return res.status(400).json({ error: 'Usuario invitado no encontrado' });
    }

    const userDoc = userSnapshot.docs[0];

    // Verificar si el email ya existe
    const emailSnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();

    if (!emailSnapshot.empty) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Actualizar el usuario invitado a usuario registrado
    await userDoc.ref.update({
      email,
      password: hashedPassword,
      isGuest: false,
      updatedAt: new Date()
    });

    res.status(200).json({ message: 'Usuario migrado con éxito' });
  } catch (error) {
    console.error('Error al migrar usuario invitado:', error);
    res.status(500).json({ error: 'Hubo un problema al migrar el usuario invitado' });
  }
});

module.exports = router;