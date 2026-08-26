import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { default as app } from '../app.js';
import { createAuthedUser, createNotification } from '../test/factories.js';

describe('GET /api/notifications', () => {
  it('returns only the calling user’s notifications, newest first, with an unread count', async () => {
    const { user, authHeader } = await createAuthedUser();
    const other = await createAuthedUser();

    const older = await createNotification(user.id, { title: 'older' });
    // createdAt has no default ordering guarantee within the same millisecond,
    // so force a visible ordering explicitly rather than relying on insert order.
    const newer = await createNotification(user.id, {
      title: 'newer',
      createdAt: new Date(older.createdAt.getTime() + 1000),
    });
    await createNotification(other.user.id, { title: 'theirs' });

    const res = await request(app).get('/api/notifications').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.notifications.map((n) => n.id)).toEqual([newer.id, older.id]);
    expect(res.body.unreadCount).toBe(2);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks the calling user’s notification read', async () => {
    const { user, authHeader } = await createAuthedUser();
    const notif = await createNotification(user.id);

    const res = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.read).toBe(true);
  });

  it('returns 404 rather than 403 for another user’s notification, so existence is not leaked', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirs = await createNotification(other.user.id);

    const res = await request(app)
      .patch(`/api/notifications/${theirs.id}/read`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);

    // And it must actually not have been mutated.
    const stillUnread = await request(app)
      .get('/api/notifications')
      .set('Authorization', other.authHeader);
    expect(stillUnread.body.notifications[0].read).toBe(false);
  });

  it('rejects a malformed id with 400', async () => {
    const { authHeader } = await createAuthedUser();

    const res = await request(app)
      .patch('/api/notifications/not-a-uuid/read')
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/notifications/read-all', () => {
  it('marks every one of the calling user’s notifications read and leaves other users’ untouched', async () => {
    const { user, authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    await createNotification(user.id);
    await createNotification(user.id);
    await createNotification(other.user.id);

    const res = await request(app).patch('/api/notifications/read-all').set('Authorization', authHeader);
    expect(res.status).toBe(204);

    const mine = await request(app).get('/api/notifications').set('Authorization', authHeader);
    expect(mine.body.unreadCount).toBe(0);

    const theirs = await request(app).get('/api/notifications').set('Authorization', other.authHeader);
    expect(theirs.body.unreadCount).toBe(1);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).patch('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });
});
