// routes/transactions.mjs
import express from 'express';
import {
  getTransactions,
  createTransaction,
  createWithdrawal,
  createTransfer,
  createDeposit,
  getTransactionById,
  getTransactionStats
} from '../controllers/transactionController.mjs';
import {
  validateTransaction,
  validateWithdrawal,
  validateTransfer,
  validateDeposit
} from '../middleware/validation.mjs';
import { 
  authenticateToken, 
  requireActiveAccount 
} from '../middleware/auth.mjs';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET routes
router.get('/', getTransactions);
router.get('/stats', getTransactionStats);
router.get('/:id', getTransactionById);

// POST routes for different transaction types
router.post('/', requireActiveAccount, validateTransaction, createTransaction);
router.post('/withdraw', requireActiveAccount, validateWithdrawal, createWithdrawal);
router.post('/transfer', requireActiveAccount, validateTransfer, createTransfer);
router.post('/deposit', requireActiveAccount, validateDeposit, createDeposit);

export default router;