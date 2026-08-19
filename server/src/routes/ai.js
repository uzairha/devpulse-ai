import { Router } from 'express';
import { body, param } from 'express-validator';
import requireAuth from '../middleware/requireAuth.js';
import validate from '../middleware/validate.js';
import { summarizePr, getHealthScore, weeklyReport, weeklyReportHistory, chat } from '../controllers/aiController.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/pr-summary',
  [body('prId').isUUID().withMessage('prId must be a valid UUID')],
  validate,
  summarizePr,
);

router.get(
  '/health-score/:id',
  [param('id').isUUID().withMessage('Invalid repository id')],
  validate,
  getHealthScore,
);

router.post(
  '/weekly-report/:id',
  [param('id').isUUID().withMessage('Invalid repository id')],
  validate,
  weeklyReport,
);

router.get(
  '/weekly-report/:id/history',
  [param('id').isUUID().withMessage('Invalid repository id')],
  validate,
  weeklyReportHistory,
);

router.post(
  '/chat/:id',
  [
    param('id').isUUID().withMessage('Invalid repository id'),
    body('message').notEmpty().withMessage('message is required'),
    body('history').optional().isArray(),
  ],
  validate,
  chat,
);

export default router;
