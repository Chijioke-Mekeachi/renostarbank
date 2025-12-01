// routes/auth.mjs
import express from 'express';
import {
  signup,
  login,
  getProfile,
  refreshToken,
  activateAccount
} from '../controllers/authController.mjs';
import {
  validateSignup,
  validateLogin
} from '../middleware/validation.mjs';
import { authenticateToken } from '../middleware/auth.mjs';

const router = express.Router();

router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);
router.post('/refresh-token', refreshToken);
router.get('/me', authenticateToken, getProfile);

// Admin route to activate accounts
router.patch('/activate/:userId', authenticateToken, activateAccount);

export default router;