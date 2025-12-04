// controllers/authController.mjs
import supabase from '../config/supabase.mjs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateAccountNumber } from '../utils/helpers.mjs';
import { ACCOUNT_STATUS, SUCCESS_MESSAGES } from '../utils/constants.mjs';

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log('Signup request received for email:', email);

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate account number
    const accountNumber = generateAccountNumber();

    // Create user in profiles table
    const { data: newUser, error: userError } = await supabase
      .from('profiles')
      .insert([
        {
          name: name,
          email: email,
          password_hash: passwordHash,
          account_number: accountNumber,
          balance: 100000.00,
          is_active: ACCOUNT_STATUS.INACTIVE
        }
      ])
      .select()
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      return res.status(400).json({ 
        error: 'Failed to create user account: ' + userError.message,
        code: 'USER_CREATION_FAILED'
      });
    }

    // Generate JWT token
    const token = generateToken(newUser.id);

    res.status(201).json({
      message: SUCCESS_MESSAGES.SIGNUP_SUCCESS,
      access_token: token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        account_number: newUser.account_number,
        balance: newUser.balance,
        is_active: newUser.is_active
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      error: 'Signup failed. Please try again.',
      code: 'SIGNUP_FAILED'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.log('User not found for email:', email);
      return res.status(400).json({ 
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      console.log('Invalid password for email:', email);
      return res.status(400).json({ 
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    console.log('Login successful for email:', email);
    res.json({
      message: user.is_active ? SUCCESS_MESSAGES.LOGIN_SUCCESS : 'Login successful. Account pending activation.',
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        account_number: user.account_number,
        balance: user.balance,
        is_active: user.is_active
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed. Please try again.',
      code: 'LOGIN_FAILED'
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, name, email, account_number, balance, is_active, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        account_number: user.account_number,
        balance: user.balance,
        is_active: user.is_active,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Failed to get user profile',
      code: 'PROFILE_FETCH_FAILED'
    });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify current token
    const decoded = verifyToken(token);
    
    // Generate new token
    const newToken = generateToken(decoded.userId);

    res.json({
      access_token: newToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(403).json({ 
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Admin function to activate user account
export const activateAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error } = await supabase
      .from('profiles')
      .update({ is_active: true })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      message: 'Account activated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_active: user.is_active
      }
    });
  } catch (error) {
    console.error('Activate account error:', error);
    res.status(500).json({ 
      error: 'Failed to activate account',
      code: 'ACTIVATION_FAILED'
    });
  }
};
