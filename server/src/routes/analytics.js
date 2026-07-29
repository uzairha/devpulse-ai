import { Router } from 'express';
import { param, query } from 'express-validator';
import requireAuth from '../middleware/requireAuth.js';
import validate from '../middleware/validate.js';
import { getRepoAnalytics } from '../controllers/analyticsController.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid repository id'),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('days must be 1–365'),
  ],
  validate,
  getRepoAnalytics,
);

export default router;
