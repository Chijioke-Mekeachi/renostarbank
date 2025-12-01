// controllers/chatController.mjs
import supabase from '../config/supabase.mjs';
import { generateBotResponse } from '../utils/helpers.mjs';

export const getConversations = async (req, res) => {
  try {
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', req.user.id)
      .order('last_message_at', { ascending: false });

    if (error) {
      return res.status(400).json({ 
        error: error.message,
        code: 'CONVERSATIONS_FETCH_FAILED'
      });
    }

    res.json({ conversations: conversations || [] });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch conversations',
      code: 'CONVERSATIONS_FETCH_FAILED'
    });
  }
};

export const createConversation = async (req, res) => {
  try {
    const { subject, initialMessage } = req.body;

    if (!subject || !initialMessage) {
      return res.status(400).json({ 
        error: 'Subject and initial message are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Create conversation
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .insert([
        {
          user_id: req.user.id,
          subject: subject,
          status: 'open'
        }
      ])
      .select()
      .single();

    if (convError) {
      return res.status(400).json({ 
        error: convError.message,
        code: 'CONVERSATION_CREATION_FAILED'
      });
    }

    // Add initial message
    const { data: message, error: msgError } = await supabase
      .from('chat_messages')
      .insert([
        {
          conversation_id: conversation.id,
          sender_type: 'user',
          message: initialMessage,
          message_type: 'text'
        }
      ])
      .select()
      .single();

    if (msgError) {
      // Rollback conversation if message creation fails
      await supabase.from('chat_conversations').delete().eq('id', conversation.id);
      return res.status(400).json({ 
        error: msgError.message,
        code: 'MESSAGE_CREATION_FAILED'
      });
    }

    // Generate automated bot response
    setTimeout(async () => {
      const botResponse = generateBotResponse(initialMessage);
      await supabase
        .from('chat_messages')
        .insert([
          {
            conversation_id: conversation.id,
            sender_type: 'bot',
            message: botResponse,
            message_type: 'text'
          }
        ]);

      // Update conversation last_message_at
      await supabase
        .from('chat_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);
    }, 2000);

    res.status(201).json({
      conversation: conversation,
      message: message
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ 
      error: 'Failed to create conversation',
      code: 'CONVERSATION_CREATION_FAILED'
    });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Verify user owns this conversation
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', req.user.id)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ 
        error: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({ 
        error: error.message,
        code: 'MESSAGES_FETCH_FAILED'
      });
    }

    res.json({ messages: messages || [] });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch messages',
      code: 'MESSAGES_FETCH_FAILED'
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required',
        code: 'MISSING_MESSAGE'
      });
    }

    // Verify user owns this conversation
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id, status')
      .eq('id', conversationId)
      .eq('user_id', req.user.id)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ 
        error: 'Conversation not found',
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    if (conversation.status === 'closed') {
      return res.status(400).json({ 
        error: 'Cannot send messages to a closed conversation',
        code: 'CONVERSATION_CLOSED'
      });
    }

    // Add message
    const { data: newMessage, error } = await supabase
      .from('chat_messages')
      .insert([
        {
          conversation_id: conversationId,
          sender_type: 'user',
          message: message,
          message_type: 'text'
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ 
        error: error.message,
        code: 'MESSAGE_SEND_FAILED'
      });
    }

    // Update conversation last_message_at
    await supabase
      .from('chat_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Generate bot response for certain messages
    setTimeout(async () => {
      const botResponse = generateBotResponse(message);
      await supabase
        .from('chat_messages')
        .insert([
          {
            conversation_id: conversationId,
            sender_type: 'bot',
            message: botResponse,
            message_type: 'text'
          }
        ]);

      // Update conversation again for bot response
      await supabase
        .from('chat_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }, 2000);

    res.status(201).json({ 
      message: 'Message sent successfully',
      data: newMessage 
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ 
      error: 'Failed to send message',
      code: 'MESSAGE_SEND_FAILED'
    });
  }
};

export const closeConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .update({ status: 'closed' })
      .eq('id', conversationId)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ 
        error: error.message,
        code: 'CONVERSATION_CLOSE_FAILED'
      });
    }

    res.json({ 
      message: 'Conversation closed successfully',
      conversation 
    });
  } catch (error) {
    console.error('Close conversation error:', error);
    res.status(500).json({ 
      error: 'Failed to close conversation',
      code: 'CONVERSATION_CLOSE_FAILED'
    });
  }
};