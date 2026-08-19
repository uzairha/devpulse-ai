import prisma from '../lib/prisma.js';

export const createNotification = async (userId, { type, title, body, link }) => {
  return prisma.notification.create({ data: { userId, type, title, body, link } });
};

export const listNotifications = async (userId, { limit = 20 } = {}) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

export const markRead = async (id, userId) => {
  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif || notif.userId !== userId) return null;
  return prisma.notification.update({ where: { id }, data: { read: true } });
};

export const markAllRead = async (userId) => {
  return prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
};

export const unreadCount = async (userId) => {
  return prisma.notification.count({ where: { userId, read: false } });
};
