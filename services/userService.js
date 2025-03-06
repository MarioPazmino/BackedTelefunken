// services/userService.js
const bcrypt = require('bcryptjs');
const User = require('../schemas/User'); // Importa el modelo de usuario
const jwt = require('jsonwebtoken');
const { admin, db, FieldValue } = require('./../ConexionFirebase/firebase');

const registerUser = async (userData) => {
  const { email, username, password } = userData;

  // Verificar si el correo electrónico o el nombre de usuario ya están registrados
  const emailExists = await User.where('email', '==', email).get();
  if (!emailExists.empty) {
    throw new Error('El correo electrónico ya está registrado');
  }

  const { exists: usernameExists } = await checkUsernameExistsWithSuggestions(username);
  if (usernameExists) {
    throw new Error('El nombre de usuario ya está registrado');
  }

  // Encriptar la contraseña antes de guardarla
  const hashedPassword = await bcrypt.hash(password, 10);

  // Crear un nuevo usuario
  const newUser = {
    email,
    username,
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Guardar el usuario en Firestore
  await User.add(newUser);
  return newUser; // Devolvemos solo los datos del usuario, sin userId
};

// Registrar un usuario invitado
const registerGuestUser = async (username) => {
  // Verificar si el nombre de usuario ya está registrado
  const { exists: usernameExists } = await checkUsernameExistsWithSuggestions(username);
  if (usernameExists) {
    throw new Error('El nombre de usuario ya está registrado');
  }

  // Crear un nuevo usuario invitado
  const newGuestUser = {
    username,
    isGuest: true,
    createdAt: new Date(),
  };

  // Guardar el usuario en Firestore
  await User.add(newGuestUser);

  // Crear token con duración de 5 días
  const token = jwt.sign(
    { username: newGuestUser.username }, // Solo incluimos el username en el token
    process.env.JWT_SECRET || 'secret_key',
    { expiresIn: '5d' }
  );

  return { token };
};

// Migrar un usuario invitado a usuario registrado
const migrateGuestUser = async (username, email, password) => {
  // Buscar al usuario por username
  const userSnapshot = await User.where('username', '==', username).get();

  if (userSnapshot.empty || !userSnapshot.docs[0].data().isGuest) {
    throw new Error('Usuario invitado no encontrado');
  }

  const userDoc = userSnapshot.docs[0];

  // Verificar si el correo electrónico ya está registrado
  const emailExists = await User.where('email', '==', email).get();
  if (!emailExists.empty) {
    throw new Error('El correo electrónico ya está registrado');
  }

  // Encriptar la contraseña antes de guardarla
  const hashedPassword = await bcrypt.hash(password, 10);

  // Actualizar el usuario invitado a usuario registrado
  await userDoc.ref.update({
    email,
    password: hashedPassword,
    isGuest: false,
    updatedAt: new Date(),
  });

  return { username, email }; // Devolvemos solo el username y el email
};

// Buscar un usuario por su email
const findUserByEmail = async (email) => {
  const userSnapshot = await User.where('email', '==', email).get();
  if (userSnapshot.empty) {
    return null;
  }
  const userDoc = userSnapshot.docs[0];
  return userDoc.data(); // Devolvemos solo los datos del usuario, sin userId
};

// Buscar un usuario por su username
const findUserByUsername = async (username) => {
  const userSnapshot = await User.where('username', '==', username).get();
  if (userSnapshot.empty) {
    return null;
  }
  const userDoc = userSnapshot.docs[0];
  return userDoc.data(); // Devolvemos solo los datos del usuario, sin userId
};

// Actualizar la información de un usuario
const updateUser = async (username, updateData) => {
  const userSnapshot = await User.where('username', '==', username).get();
  if (userSnapshot.empty) {
    throw new Error('Usuario no encontrado');
  }

  const userDoc = userSnapshot.docs[0];
  await userDoc.ref.update({
    ...updateData,
    updatedAt: new Date(),
  });
};

// Eliminar un usuario
const deleteUser = async (username) => {
  const userSnapshot = await User.where('username', '==', username).get();
  if (userSnapshot.empty) {
    throw new Error('Usuario no encontrado');
  }

  const userDoc = userSnapshot.docs[0];
  await userDoc.ref.delete();
};

// Función para generar sugerencias de nombres de usuario
const generateUsernameSuggestions = (username) => {
  const suggestions = [];
  const randomNum = () => Math.floor(Math.random() * 1000);
  
  // Añadir números aleatorios
  suggestions.push(`${username}${randomNum()}`);
  suggestions.push(`${username}${randomNum()}`);
  
  // Añadir prefijos o sufijos más largos
  suggestions.push(`${username}_user_${randomNum()}`);
  suggestions.push(`user_${username}_${randomNum()}`);
  suggestions.push(`the_${username}_${randomNum()}`);
  
  // Añadir combinaciones de letras y números
  suggestions.push(`${username}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}${randomNum()}`);
  suggestions.push(`${username}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}_${randomNum()}`);
  
  return suggestions;
};

// Verificar si un nombre de usuario existe y generar sugerencias
const checkUsernameExistsWithSuggestions = async (username) => {
  const usernameSnapshot = await User.where('username', '==', username).get();
  const exists = !usernameSnapshot.empty;
  
  let suggestions = [];
  if (exists) {
    // Generar sugerencias
    suggestions = generateUsernameSuggestions(username);
    
    // Verificar que las sugerencias no existan ya en la base de datos
    const filteredSuggestions = [];
    for (const suggestion of suggestions) {
      const suggestionSnapshot = await User.where('username', '==', suggestion).get();
      if (suggestionSnapshot.empty) {
        filteredSuggestions.push(suggestion);
      }
    }
    
    // Si necesitamos más sugerencias porque algunas ya existían
    while (filteredSuggestions.length < 5) { // Aumentamos el número de sugerencias a 5
      const newSuggestion = `${username}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 9999)}`;
      const suggestionSnapshot = await User.where('username', '==', newSuggestion).get();
      if (suggestionSnapshot.empty) {
        filteredSuggestions.push(newSuggestion);
      }
    }
    
    suggestions = filteredSuggestions;
  }
  
  return { exists, suggestions };
};

module.exports = {
  registerUser,
  registerGuestUser,
  migrateGuestUser,
  findUserByEmail,
  findUserByUsername,
  updateUser,
  deleteUser,
  generateUsernameSuggestions,
  checkUsernameExistsWithSuggestions,
};