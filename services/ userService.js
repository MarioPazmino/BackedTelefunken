// services/userService.js
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const User = require('../schemas/User'); // Importa el modelo de usuario

// Registrar un nuevo usuario
const registerUser = async (userData) => {
  const { name, email, username, password } = userData;

  // Verificar si el correo electrónico o el nombre de usuario ya están registrados
  const emailExists = await User.where('email', '==', email).get();
  if (!emailExists.empty) {
    throw new Error('El correo electrónico ya está registrado');
  }

  const usernameExists = await User.where('username', '==', username).get();
  if (!usernameExists.empty) {
    throw new Error('El nombre de usuario ya está registrado');
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

  // Guardar el usuario en Firestore
  const userRef = await User.add(newUser);
  return { userId: userRef.id, ...newUser };
};

// Buscar un usuario por su email
const findUserByEmail = async (email) => {
  const userSnapshot = await User.where('email', '==', email).get();
  if (userSnapshot.empty) {
    return null;
  }
  const userDoc = userSnapshot.docs[0];
  return { userId: userDoc.id, ...userDoc.data() };
};

// Buscar un usuario por su username
const findUserByUsername = async (username) => {
  const userSnapshot = await User.where('username', '==', username).get();
  if (userSnapshot.empty) {
    return null;
  }
  const userDoc = userSnapshot.docs[0];
  return { userId: userDoc.id, ...userDoc.data() };
};

// Actualizar la información de un usuario
const updateUser = async (userId, updateData) => {
  await User.doc(userId).update({
    ...updateData,
    updatedAt: new Date(),
  });
};

// Eliminar un usuario
const deleteUser = async (userId) => {
  await User.doc(userId).delete();
};

module.exports = {
  registerUser,
  findUserByEmail,
  findUserByUsername,
  updateUser,
  deleteUser,
};