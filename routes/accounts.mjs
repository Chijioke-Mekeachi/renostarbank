// routes/accounts.mjs
import express from 'express';
import {
  getBalance,
  transfer,
  getAccountInfo
} from '../controllers/accountController.mjs';
import {
  validateTransfer
} from '../middleware/validation.mjs';
import { 
  authenticateToken, 
  requireActiveAccount 
} from '../middleware/auth.mjs';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/balance', getBalance);
router.get('/info', getAccountInfo);
router.post('/transfer', requireActiveAccount, validateTransfer, transfer);

export default router;