import { Router } from 'express';
import { param, query } from 'express-validator';
import requireAuth from '../middleware/requireAuth.js';
import validate from '../middleware/validate.js';
import { getRepoAnalytics, compareRepos, listPullRequests, listCommits, getContributor } from '../controllers/analyticsController.js';
import { MAX_TABLE_LIMIT } from '../lib/constants.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/compare',
  [query('days').optional().isInt({ min: 1, max: 365 }).withMessage('days must be 1–365')],
  validate,
  compareRepos,
);

router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid repository id'),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('days must be 1–365'),
  ],
  validate,
  getRepoAnalytics,
);

const paginationRules = (id) => [
  param(id).isUUID().withMessage('Invalid repository id'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: MAX_TABLE_LIMIT }),
];

router.get(
  '/:id/prs',
  [
    ...paginationRules('id'),
    query('state').optional().isIn(['open', 'closed', 'merged']),
    query('author').optional().isString().trim().notEmpty(),
  ],
  validate,
  listPullRequests,
);
router.get(
  '/:id/commits',
  [...paginationRules('id'), query('author').optional().isString().trim().notEmpty()],
  validate,
  listCommits,
);

router.get(
  '/:id/contributors/:login',
  [
    param('id').isUUID().withMessage('Invalid repository id'),
    param('login').isString().trim().notEmpty(),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('days must be 1–365'),
  ],
  validate,
  getContributor,
);

export default router;
