import { Router } from 'express';
import { body, param } from 'express-validator';
import requireAuth from '../middleware/requireAuth.js';
import validate from '../middleware/validate.js';
import {
  listAvailableRepos,
  connectRepo,
  listRepos,
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

router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid repository id')],
  validate,
  disconnectRepo,
);

export default router;
