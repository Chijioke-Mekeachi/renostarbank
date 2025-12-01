import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Admin UUID for bot messages
const BOT_USER_ID = '11111111-1111-1111-1111-111111111111';

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  const adminToken = req.headers['admin-token'] || req.headers['authorization'];
  
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({
      success: false,
      error: 'Admin access required'
    });
  }
  next();
};

// Apply admin middleware to all routes
router.use(requireAdmin);

// GET - Get all unique users who have sent messages with their usernames
router.get('/users', async (req, res) => {
  try {
    console.log('📋 Fetching all users with messages and usernames...');

    // First, get all unique user IDs from messages (excluding bot)
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('user_id')
      .neq('user_id', BOT_USER_ID)
      .order('created_at', { ascending: false });

    if (messagesError) throw messagesError;

    // Get unique users
    const uniqueUserIds = [...new Set(messagesData.map(item => item.user_id))];
    
    // Get user details and usernames for each user
    const usersWithDetails = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        try {
          // Get user profile from profiles table
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          let username = 'Unknown User';
          let email = 'No email';
          let full_name = 'Unknown';
          let is_active = false;
          let account_number = 'N/A';
          let balance = 0;
          let created_at = null;

          if (!userError && userData) {
            username = userData.username || userData.full_name || userData.email?.split('@')[0] || 'User';
            email = userData.email || 'No email';
            full_name = userData.full_name || 'Unknown';
            is_active = userData.is_active || false;
            account_number = userData.account_number || 'N/A';
            balance = userData.balance || 0;
            created_at = userData.created_at;
          } else {
            // Try auth users as fallback
            const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
            if (!authError && authData) {
              username = authData.user.email?.split('@')[0] || 'User';
              email = authData.user.email || 'No email';
              full_name = authData.user.user_metadata?.full_name || 'Unknown User';
            }
          }

          // Get last message from this user
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Count total messages from this user
          const { count: messageCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

          return {
            user_id: userId,
            username: username,
            email: email,
            full_name: full_name,
            is_active: is_active,
            account_number: account_number,
            balance: balance,
            last_message: lastMessage?.message || 'No messages',
            last_message_time: lastMessage?.created_at,
            message_count: messageCount || 0,
            is_online: Math.random() > 0.5, // Mock online status
            created_at: created_at
          };
        } catch (userError) {
          console.error(`Error fetching user ${userId}:`, userError);
          // Return basic user info if we can't get details
          return {
            user_id: userId,
            username: `User_${userId.slice(0, 8)}`,
            email: 'Unknown',
            full_name: 'Unknown User',
            is_active: false,
            account_number: 'N/A',
            balance: 0,
            last_message: 'No messages',
            last_message_time: null,
            message_count: 0,
            is_online: false,
            created_at: null
          };
        }
      })
    );

    console.log(`✅ Found ${usersWithDetails.length} users with messages`);

    res.json({
      success: true,
      data: usersWithDetails,
      count: usersWithDetails.length
    });

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// POST - Activate user account
router.post('/users/:userId/activate', async (req, res) => {
  try {
    const { userId } = req.params;
    const { initial_balance = 1000 } = req.body; // Default initial balance

    console.log(`🔓 Activating account for user: ${userId}`);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Generate account number if not exists
    const account_number = `RS${Date.now().toString().slice(-8)}`;

    // Update user profile to activate account
    const { data, error } = await supabase
      .from('profiles')
      .update({
        is_active: true,
        account_number: account_number,
        balance: initial_balance,
        activated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error activating account:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to activate account: ${error.message}`
      });
    }

    console.log(`✅ Account activated for user ${userId}`);

    res.json({
      success: true,
      message: 'Account activated successfully',
      data: {
        user_id: userId,
        is_active: true,
        account_number: account_number,
        balance: initial_balance,
        activated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error activating account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate account'
    });
  }
});

// POST - Deactivate user account
router.post('/users/:userId/deactivate', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`🔒 Deactivating account for user: ${userId}`);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Update user profile to deactivate account
    const { data, error } = await supabase
      .from('profiles')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error deactivating account:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to deactivate account: ${error.message}`
      });
    }

    console.log(`✅ Account deactivated for user ${userId}`);

    res.json({
      success: true,
      message: 'Account deactivated successfully',
      data: {
        user_id: userId,
        is_active: false,
        deactivated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error deactivating account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate account'
    });
  }
});

// GET - Get user account details
router.get('/users/:userId/account', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`👤 Fetching account details for user: ${userId}`);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ Error fetching account details:', error);
      return res.status(404).json({
        success: false,
        error: 'User account not found'
      });
    }

    res.json({
      success: true,
      data: {
        user_id: profile.id,
        username: profile.username,
        email: profile.email,
        full_name: profile.full_name,
        account_number: profile.account_number,
        balance: profile.balance,
        is_active: profile.is_active,
        created_at: profile.created_at,
        activated_at: profile.activated_at,
        deactivated_at: profile.deactivated_at
      }
    });

  } catch (error) {
    console.error('❌ Error fetching account details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch account details'
    });
  }
});

// POST - Update user balance
router.post('/users/:userId/balance', async (req, res) => {
  try {
    const { userId } = req.params;
    const { balance, operation = 'set' } = req.body; // operation: 'set', 'add', 'subtract'

    console.log(`💰 Updating balance for user ${userId}:`, { balance, operation });

    if (!userId || balance === undefined) {
      return res.status(400).json({
        success: false,
        error: 'User ID and balance are required'
      });
    }

    // Get current balance
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (fetchError) {
      return res.status(404).json({
        success: false,
        error: 'User account not found'
      });
    }

    let newBalance;
    switch (operation) {
      case 'add':
        newBalance = (currentProfile.balance || 0) + Number(balance);
        break;
      case 'subtract':
        newBalance = Math.max(0, (currentProfile.balance || 0) - Number(balance));
        break;
      case 'set':
      default:
        newBalance = Number(balance);
        break;
    }

    // Update balance
    const { data, error } = await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating balance:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to update balance: ${error.message}`
      });
    }

    console.log(`✅ Balance updated for user ${userId}: ${newBalance}`);

    res.json({
      success: true,
      message: 'Balance updated successfully',
      data: {
        user_id: userId,
        previous_balance: currentProfile.balance,
        new_balance: newBalance,
        operation: operation
      }
    });

  } catch (error) {
    console.error('❌ Error updating balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update balance'
    });
  }
});

// GET - Get conversation with a specific user including usernames
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`💬 Fetching conversation with user: ${userId}`);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`user_id.eq.${userId},user_id.eq.${BOT_USER_ID}`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Get user details for display
    let userDetails = {
      username: `User_${userId.slice(0, 8)}`,
      email: 'Unknown',
      full_name: 'Unknown User',
      is_active: false,
      account_number: 'N/A',
      balance: 0
    };

    try {
      const { data: userData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (userData) {
        userDetails = {
          username: userData.username || userData.full_name || userData.email?.split('@')[0] || 'User',
          email: userData.email || 'Unknown',
          full_name: userData.full_name || 'Unknown User',
          is_active: userData.is_active || false,
          account_number: userData.account_number || 'N/A',
          balance: userData.balance || 0
        };
      }
    } catch (userError) {
      console.log(`Could not fetch user details for ${userId}`);
    }

    console.log(`✅ Found ${data?.length || 0} messages in conversation`);

    res.json({
      success: true,
      data: data || [],
      user_id: userId,
      user_details: userDetails,
      count: data?.length || 0
    });

  } catch (error) {
    console.error('❌ Error fetching conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation'
    });
  }
});

// POST - Send message as bot to a user
router.post('/conversations/:userId/messages', async (req, res) => {
  try {
    const { userId } = req.params;
    const { message } = req.body;

    console.log('🤖 Sending message as bot:', { userId, message });

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        error: 'User ID and message are required'
      });
    }

    // Insert bot message
    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          user_id: BOT_USER_ID,
          message: message.trim()
        }
      ])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Bot message sent successfully');

    res.json({
      success: true,
      data: data,
      message: 'Message sent as bot'
    });

  } catch (error) {
    console.error('❌ Error sending bot message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message as bot'
    });
  }
});

// GET - Get user details by ID
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`👤 Fetching user details for: ${userId}`);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    let userDetails = {
      user_id: userId,
      username: `User_${userId.slice(0, 8)}`,
      email: 'Unknown',
      full_name: 'Unknown User',
      is_active: false,
      account_number: 'N/A',
      balance: 0,
      created_at: null
    };

    try {
      // Try to get from profiles table first
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profileError && profileData) {
        userDetails = {
          user_id: userId,
          username: profileData.username || profileData.full_name || profileData.email?.split('@')[0] || 'User',
          email: profileData.email || 'Unknown',
          full_name: profileData.full_name || 'Unknown User',
          is_active: profileData.is_active || false,
          account_number: profileData.account_number || 'N/A',
          balance: profileData.balance || 0,
          created_at: profileData.created_at,
          avatar_url: profileData.avatar_url
        };
      } else {
        // Try auth users as fallback
        const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
        if (!authError && authData) {
          userDetails = {
            user_id: userId,
            username: authData.user.email?.split('@')[0] || 'User',
            email: authData.user.email || 'Unknown',
            full_name: authData.user.user_metadata?.full_name || 'Unknown User',
            is_active: false,
            account_number: 'N/A',
            balance: 0,
            created_at: authData.user.created_at
          };
        }
      }
    } catch (userError) {
      console.error('Error fetching user details:', userError);
    }

    res.json({
      success: true,
      data: userDetails
    });

  } catch (error) {
    console.error('❌ Error fetching user details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user details'
    });
  }
});

// GET - Get statistics with user counts
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching admin statistics...');

    // Total messages
    const { count: totalMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    // Total unique users (excluding bot)
    const { data: usersData } = await supabase
      .from('messages')
      .select('user_id')
      .neq('user_id', BOT_USER_ID);

    const uniqueUsers = [...new Set(usersData?.map(item => item.user_id) || [])];

    // Messages today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: messagesToday } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Bot messages count
    const { count: botMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', BOT_USER_ID);

    // Get active users (users with messages in last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: activeUsersData } = await supabase
      .from('messages')
      .select('user_id')
      .neq('user_id', BOT_USER_ID)
      .gte('created_at', yesterday.toISOString());

    const activeUsers = [...new Set(activeUsersData?.map(item => item.user_id) || [])];

    // Get account statistics
    const { data: accountStats } = await supabase
      .from('profiles')
      .select('is_active');

    const totalAccounts = accountStats?.length || 0;
    const activeAccounts = accountStats?.filter(acc => acc.is_active)?.length || 0;
    const inactiveAccounts = totalAccounts - activeAccounts;

    console.log('✅ Statistics fetched successfully');

    res.json({
      success: true,
      data: {
        total_messages: totalMessages || 0,
        total_users: uniqueUsers.length,
        active_users: activeUsers.length,
        messages_today: messagesToday || 0,
        bot_messages: botMessages || 0,
        user_messages: (totalMessages || 0) - (botMessages || 0),
        total_accounts: totalAccounts,
        active_accounts: activeAccounts,
        inactive_accounts: inactiveAccounts
      }
    });

  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

export default router;