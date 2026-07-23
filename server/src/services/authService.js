import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import config from '../config/index.js';

export const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: '7d',
  });
};

export const registerUser = async ({ email, password }) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const error = new Error('Email already in use');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash },
  });

  return { user, token: generateToken(user) };
};

export const loginUser = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }

  return { user, token: generateToken(user) };
};

export const formatUser = (user) => ({
  id: user.id,
  email: user.email,
  githubUsername: user.githubUsername,
  githubAvatarUrl: user.githubAvatarUrl,
  createdAt: user.createdAt,
});
