import { Router } from 'express';
import { body, param } from 'express-validator';
import requireAuth from '../middleware/requireAuth.js';
import validate from '../middleware/validate.js';
import {
  listAvailableRepos,
  connectRepo,
  listRepos,
  triggerSync,
  getSyncStatus,
  disconnectRepo,
} from '../controllers/repoController.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  [body('githubRepoId').isInt({ min: 1 }).withMessage('githubRepoId must be a positive integer')],
  validate,
  connectRepo,
);

router.get('/available', listAvailableRepos);

router.get('/', listRepos);

router.post(
  '/:id/sync',
  [param('id').isUUID().withMessage('Invalid repository id')],
  validate,
  triggerSync,
);

router.get(
  '/:id/sync-status',
  [param('id').isUUID().withMessage('Invalid repository id')],
  validate,
  getSyncStatus,
);

router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid repository id')],
  validate,
  disconnectRepo,
);

export default router;
