import axios from 'axios';
import prisma from '../lib/prisma.js';
import config from '../config/index.js';
import { generateToken } from './authService.js';

export const getGithubAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: 'read:user user:email repo',
  });
  return `https://github.com/login/oauth/authorize?${params}`;
};

export const exchangeCodeForToken = async (code) => {
  const res = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code,
      redirect_uri: config.github.callbackUrl,
    },
    { headers: { Accept: 'application/json' } }
  );

  if (res.data.error) {
    throw new Error(`GitHub OAuth error: ${res.data.error_description}`);
  }

  return res.data.access_token;
};

export const getGithubUser = async (accessToken) => {
  const res = await axios.get('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
};

export const findOrCreateGithubUser = async (githubUser, accessToken) => {
  const existing = await prisma.user.findUnique({
    where: { githubId: String(githubUser.id) },
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { githubAccessToken: accessToken },
    });
    return { user: updated, token: generateToken(updated) };
  }

  const created = await prisma.user.create({
    data: {
      githubId: String(githubUser.id),
      githubUsername: githubUser.login,
      githubAvatarUrl: githubUser.avatar_url,
      githubAccessToken: accessToken,
      email: githubUser.email || null,
    },
  });

  return { user: created, token: generateToken(created) };
};
