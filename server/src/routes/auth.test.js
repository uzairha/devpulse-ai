import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import prisma from '../lib/prisma.js';
import config from '../config/index.js';
import { createUser, createAuthedUser, TEST_PASSWORD } from '../test/factories.js';

describe('POST /api/auth/register', () => {
  it('creates a user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.devpulse.ai', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: 'new@test.devpulse.ai',
      weeklyReportEmail: true,
      syncNotifications: true,
    });

    const stored = await prisma.user.findUnique({ where: { email: 'new@test.devpulse.ai' } });
    expect(stored).not.toBeNull();
  });

  it('never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.devpulse.ai', password: 'password123' });

    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('$2');
  });

  it('stores the password hashed rather than in plain text', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.devpulse.ai', password: 'password123' });

    const stored = await prisma.user.findUnique({ where: { email: 'new@test.devpulse.ai' } });
    expect(stored.passwordHash).not.toBe('password123');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('issues a token carrying the new user id', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.devpulse.ai', password: 'password123' });

    const decoded = jwt.verify(res.body.token, config.jwtSecret);
    expect(decoded.id).toBe(res.body.user.id);
  });

  it('rejects a duplicate email with 409', async () => {
    await createUser({ email: 'taken@test.devpulse.ai' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'taken@test.devpulse.ai', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already in use');
  });

  it('rejects a malformed email with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe('Valid email is required');
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.devpulse.ai', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe('Password must be at least 8 characters');

    const stored = await prisma.user.findUnique({ where: { email: 'new@test.devpulse.ai' } });
    expect(stored).toBeNull();
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for correct credentials', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);

    const decoded = jwt.verify(res.body.token, config.jwtSecret);
    expect(decoded.id).toBe(user.id);
  });

  it('rejects a wrong password with 401', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('rejects an unknown email with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.devpulse.ai', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('rejects a GitHub-only account with no password with 401', async () => {
    // OAuth users have no passwordHash; login must not treat that as a match.
    const user = await createUser({ passwordHash: null, githubId: 'gh-1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('rejects a missing password with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'someone@test.devpulse.ai' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].msg).toBe('Password is required');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user', async () => {
    const { user, authHeader } = await createAuthedUser();

    const res = await request(app).get('/api/auth/me').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, email: user.email });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('githubAccessToken');
  });

  it('rejects a request with no Authorization header with 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('rejects a malformed Authorization header with 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'some-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('rejects a token signed with the wrong secret with 401', async () => {
    const forged = jwt.sign({ id: 'someone', email: 'x@test.devpulse.ai' }, 'not-the-real-secret');

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid token');
  });

  it('rejects an expired token with 401', async () => {
    const user = await createUser();
    const expired = jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, {
      expiresIn: '-1s',
    });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token expired');
  });

  it('returns 404 when the token is valid but the user is gone', async () => {
    const { user, authHeader } = await createAuthedUser();
    await prisma.user.delete({ where: { id: user.id } });

    const res = await request(app).get('/api/auth/me').set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});

describe('PATCH /api/auth/settings', () => {
  it('updates the notification toggles', async () => {
    const { user, authHeader } = await createAuthedUser();

    const res = await request(app)
      .patch('/api/auth/settings')
      .set('Authorization', authHeader)
      .send({ weeklyReportEmail: false, syncNotifications: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ weeklyReportEmail: false, syncNotifications: false });

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored.weeklyReportEmail).toBe(false);
    expect(stored.syncNotifications).toBe(false);
  });

  it('leaves omitted toggles untouched', async () => {
    const { user, authHeader } = await createAuthedUser();

    await request(app)
      .patch('/api/auth/settings')
      .set('Authorization', authHeader)
      .send({ weeklyReportEmail: false });

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored.weeklyReportEmail).toBe(false);
    expect(stored.syncNotifications).toBe(true);
  });

  it('ignores non-boolean values rather than writing them', async () => {
    const { user, authHeader } = await createAuthedUser();

    const res = await request(app)
      .patch('/api/auth/settings')
      .set('Authorization', authHeader)
      .send({ weeklyReportEmail: 'nope' });

    expect(res.status).toBe(200);
    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored.weeklyReportEmail).toBe(true);
  });

  it('does not let the request body change fields other than the toggles', async () => {
    const { user, authHeader } = await createAuthedUser();

    await request(app)
      .patch('/api/auth/settings')
      .set('Authorization', authHeader)
      .send({ email: 'hijacked@test.devpulse.ai', githubAccessToken: 'stolen' });

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored.email).toBe(user.email);
    expect(stored.githubAccessToken).toBeNull();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).patch('/api/auth/settings').send({ syncNotifications: false });

    expect(res.status).toBe(401);
  });
});
