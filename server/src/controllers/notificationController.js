import { listNotifications, markRead, markAllRead, unreadCount } from '../services/notificationService.js';

export const getNotifications = async (req, res, next) => {
  try {
    const [notifications, count] = await Promise.all([
      listNotifications(req.user.id),
      unreadCount(req.user.id),
    ]);
    res.json({ notifications, unreadCount: count });
  } catch (err) {
    next(err);
  }
};

export const readNotification = async (req, res, next) => {
  try {
    const notif = await markRead(req.params.id, req.user.id);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    res.json(notif);
  } catch (err) {
    next(err);
  }
};

export const readAll = async (req, res, next) => {
  try {
    await markAllRead(req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
