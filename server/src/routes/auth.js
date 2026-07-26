import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe, githubRedirect, githubCallback } from '../controllers/authController.js';
import validate from '../middleware/validate.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email').notEmpty().withMessage('Email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.get('/me', requireAuth, getMe);
router.get('/github', githubRedirect);
router.get('/github/callback', githubCallback);

export default router;
