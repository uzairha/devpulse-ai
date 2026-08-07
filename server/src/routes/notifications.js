import { Router } from 'express';
import { param } from 'express-validator';
import requireAuth from '../middleware/requireAuth.js';
import validate from '../middleware/validate.js';
import { getNotifications, readNotification, readAll } from '../controllers/notificationController.js';

const router = Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.patch('/read-all', readAll);
router.patch('/:id/read', [param('id').isUUID()], validate, readNotification);

export default router;
