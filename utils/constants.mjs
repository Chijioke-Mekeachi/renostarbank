export const TRANSACTION_TYPES = {
  CREDIT: 'credit',
  DEBIT: 'debit'
};

export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export const CONVERSATION_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  RESOLVED: 'resolved'
};

export const SENDER_TYPES = {
  USER: 'user',
  ADMIN: 'admin',
  BOT: 'bot'
};

export const MESSAGE_TYPES = {
  TEXT: 'text',
  SYSTEM: 'system',
  ACTION: 'action'
};

export const ACCOUNT_STATUS = {
  ACTIVE: true,
  INACTIVE: false
};

export const ERROR_CODES = {
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
};

export const SUCCESS_MESSAGES = {
  SIGNUP_SUCCESS: 'Account created successfully. Please wait for activation.',
  LOGIN_SUCCESS: 'Login successful',
  TRANSFER_SUCCESS: 'Transfer completed successfully',
  TRANSACTION_SUCCESS: 'Transaction completed successfully',
  MESSAGE_SENT: 'Message sent successfully'
};