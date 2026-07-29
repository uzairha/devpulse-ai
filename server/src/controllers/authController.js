import prisma from '../lib/prisma.js';
import { registerUser, loginUser, formatUser } from '../services/authService.js';
import {
  getGithubAuthUrl,
  exchangeCodeForToken,
  getGithubUser,
  findOrCreateGithubUser,
} from '../services/githubOAuthService.js';
import config from '../config/index.js';

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

export const updateSettings = async (req, res, next) => {
  try {
    const { weeklyReportEmail, syncNotifications } = req.body;
    const data = {};
    if (typeof weeklyReportEmail === 'boolean') data.weeklyReportEmail = weeklyReportEmail;
    if (typeof syncNotifications === 'boolean') data.syncNotifications = syncNotifications;

    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json(formatUser(user));
  } catch (err) {
    next(err);
  }
};

export const githubRedirect = (_req, res) => {
  res.redirect(getGithubAuthUrl());
};

export const githubCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect(`${config.clientUrl}/login?error=missing_code`);

    const accessToken = await exchangeCodeForToken(code);
    const githubUser = await getGithubUser(accessToken);
    const { token } = await findOrCreateGithubUser(githubUser, accessToken);

    res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
  } catch (err) {
    next(err);
  }
};
