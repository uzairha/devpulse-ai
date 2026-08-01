import { Router } from 'express';
import { body, param } from 'express-validator';
import requireAuth from '../middleware/requireAuth.js';
import validate from '../middleware/validate.js';
import { summarizePr, getHealthScore } from '../controllers/aiController.js';

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

export default router;
