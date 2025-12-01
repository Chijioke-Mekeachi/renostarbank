// middleware/auth.mjs
import { verifyToken } from '../controllers/authController.mjs';
import supabase from '../config/supabase.mjs';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify JWT token
    const decoded = verifyToken(token);

    // Get user from profiles table
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, name, email, account_number, balance, is_active')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      console.log('User not found for token, userId:', decoded.userId);
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(403).json({ 
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
};

export const requireActiveAccount = (req, res, next) => {
  if (!req.user.is_active) {
    return res.status(403).json({ 
      error: 'Account is not active. Please wait for activation.',
      code: 'ACCOUNT_INACTIVE'
    });
  }
  next();
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      const { data: user } = await supabase
        .from('profiles')
        .select('id, name, email, account_number, balance, is_active')
        .eq('id', decoded.userId)
        .single();

      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional routes
    next();
  }
};