// middleware/validation.mjs
import { body, param, query, validationResult } from 'express-validator';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Auth validation
export const validateSignup = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  handleValidationErrors
];

export const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Transaction validation
export const validateTransaction = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  
  body('type')
    .isIn(['credit', 'debit'])
    .withMessage('Type must be either credit or debit'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Description cannot exceed 255 characters'),
  
  handleValidationErrors
];



// Chat validation
export const validateConversation = [
  body('subject')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Subject must be between 5 and 100 characters'),
  
  body('initialMessage')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
  
  handleValidationErrors
];

export const validateMessage = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
  
  handleValidationErrors
];


export const validateWithdrawal = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('description').optional().isString().isLength({ max: 500 }),
  body('to_account_number').optional().isString().isLength({ max: 50 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }
    next();
  }
];

export const validateTransfer = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('to_account_number').notEmpty().withMessage('Recipient account number is required'),
  body('description').optional().isString().isLength({ max: 500 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }
    next();
  }
];

export const validateDeposit = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('description').optional().isString().isLength({ max: 500 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }
    next();
  }
];