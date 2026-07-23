import prisma from '../lib/prisma.js';
import { registerUser, loginUser, formatUser } from '../services/authService.js';

export const register = async (req, res, next) => {
  try {
    const { user, token } = await registerUser(req.body);
    res.status(201).json({ token, user: formatUser(user) });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { user, token } = await loginUser(req.body);
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(formatUser(user));
  } catch (err) {
    next(err);
  }
};
