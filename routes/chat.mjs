// routes/chat.mjs
import express from 'express';
import {
  getConversations,
  createConversation,
  getMessages,
  sendMessage,
  closeConversation
} from '../controllers/chatController.mjs';
import {
  validateConversation,
  validateMessage
} from '../middleware/validation.mjs';
import { authenticateToken } from '../middleware/auth.mjs';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/conversations', getConversations);
router.post('/conversations', validateConversation, createConversation);
router.get('/conversations/:conversationId/messages', getMessages);
router.post('/conversations/:conversationId/messages', validateMessage, sendMessage);
router.patch('/conversations/:conversationId/close', closeConversation);

export default router;