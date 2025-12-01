import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Bot UUID constant
const BOT_USER_ID = '11111111-1111-1111-1111-111111111111';

// POST - Create a new message
router.post('/', async (req, res) => {
  try {
    const { userId, message } = req.body;

    console.log('📨 Received message request:', { userId, message });

    // Validate input
    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId and message are required'
      });
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message must be a non-empty string'
      });
    }

    if (typeof userId !== 'string' || userId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'User ID must be a non-empty string'
      });
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          user_id: userId.trim(),
          message: message.trim()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error:', error);
      return res.status(500).json({ 
        success: false,
        error: `Database error: ${error.message}` 
      });
    }

    console.log('✅ Message saved to Supabase:', data);

    res.status(201).json({
      success: true,
      message: 'Message created successfully',
      data: data
    });

  } catch (error) {
    console.error('💥 Server error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// GET - Retrieve messages for a specific user (including bot responses)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('📋 Fetching messages for user:', userId);

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID is required' 
      });
    }

    // Get both user messages AND bot messages
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`user_id.eq.${userId},user_id.eq.${BOT_USER_ID}`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Supabase error:', error);
      return res.status(500).json({ 
        success: false,
        error: `Database error: ${error.message}` 
      });
    }

    console.log(`✅ Found ${data?.length || 0} messages for user ${userId}`);

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('💥 Server error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// GET - Check if user has any messages
router.get('/:userId/exists', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID is required' 
      });
    }

    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    // If we get an error (like no rows), it means no messages exist
    const hasMessages = !error && data !== null;

    res.json({
      success: true,
      data: {
        hasMessages,
        userId
      }
    });

  } catch (error) {
    console.error('Error checking messages:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

export default router;