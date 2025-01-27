// routes/userRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../schemas/User');

const router = express.Router();

// Ruta para registrar un nuevo usuario
router.post('/register', async (req, res) => {
  const { name, email, username, password } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    // Verificar si el correo electrónico o el nombre de usuario ya están registrados
    const emailExists = await User.where('email', '==', email).get();
    if (!emailExists.empty) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    const usernameExists = await User.where('username', '==', username).get();
    if (!usernameExists.empty) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
    }

    // Encriptar la contraseña antes de guardarla
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear un nuevo usuario
    const newUser = {
      name,
      email,
      username,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Guardar el usuario en Firestore (la colección "users" se creará automáticamente)
    const userRef = await User.add(newUser);
    res.status(201).json({ message: 'Usuario registrado con éxito', userId: userRef.id });
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
    // Buscar el usuario por su nombre de usuario
    const userSnapshot = await User.where('username', '==', username).get();
    if (userSnapshot.empty) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    const userDoc = userSnapshot.docs[0];
    const user = userDoc.data();

    // Verificar la contraseña utilizando bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Contraseña incorrecta' });
    }

    // Crear el JWT (con un tiempo de expiración de 1 hora)
    const token = jwt.sign(
      { userId: userDoc.id, username: user.username }, // Datos que queremos incluir en el token
      'secret_key', // Clave secreta para firmar el token (debes usar una clave segura)
      { expiresIn: '1h' } // Expiración del token en 1 hora
    );

    // Login exitoso, se envía el JWT al cliente
    res.status(200).json({ message: 'Inicio de sesión exitoso', token });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Hubo un problema al iniciar sesión' });
  }
});

module.exports = router;