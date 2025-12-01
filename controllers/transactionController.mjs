// controllers/transactionController.mjs
import supabase from '../config/supabase.mjs';
import { calculateNewBalance, generateReference } from '../utils/helpers.mjs';
import { ERROR_CODES, SUCCESS_MESSAGES } from '../utils/constants.mjs';

export const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, status, transaction_type } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (transaction_type && transaction_type !== 'all') {
      query = query.eq('transaction_type', transaction_type);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      return res.status(400).json({ 
        error: error.message,
        code: 'TRANSACTIONS_FETCH_FAILED'
      });
    }

    res.json({
      transactions: transactions || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transactions',
      code: 'TRANSACTIONS_FETCH_FAILED'
    });
  }
};

export const createTransaction = async (req, res) => {
  try {
    const { type, amount, description, to_account_number, transaction_type = 'transfer' } = req.body;

    // Check if account is active
    if (!req.user.is_active) {
      return res.status(403).json({ 
        error: 'Account is not active. Please wait for activation to perform transactions.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Validate transaction type
    if (!['credit', 'debit'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid transaction type',
        code: 'INVALID_TRANSACTION_TYPE'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ 
        error: 'Amount must be positive',
        code: 'INVALID_AMOUNT'
      });
    }

    // Validate transaction_type
    const validTransactionTypes = ['transfer', 'withdrawal', 'deposit', 'payment', 'refund'];
    if (!validTransactionTypes.includes(transaction_type)) {
      return res.status(400).json({ 
        error: 'Invalid transaction type',
        code: 'INVALID_TRANSACTION_CATEGORY'
      });
    }

    // Get user's current balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', req.user.id)
      .single();

    if (profileError) {
      return res.status(400).json({ 
        error: 'Failed to fetch account balance',
        code: ERROR_CODES.ACCOUNT_NOT_FOUND
      });
    }

    // Check for sufficient funds for debit transactions
    if (type === 'debit' && profile.balance < amount) {
      return res.status(400).json({ 
        error: 'Insufficient funds',
        code: ERROR_CODES.INSUFFICIENT_FUNDS
      });
    }

    // Generate unique reference
    const reference = generateReference(transaction_type);

    // Create transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: req.user.id,
          type,
          amount,
          description,
          to_account_number,
          transaction_type,
          reference,
          status: 'completed'
        }
      ])
      .select()
      .single();

    if (transactionError) {
      return res.status(400).json({ 
        error: transactionError.message,
        code: ERROR_CODES.TRANSACTION_FAILED
      });
    }

    // Update user balance
    const newBalance = calculateNewBalance(profile.balance, amount, type);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', req.user.id);

    if (updateError) {
      // Rollback transaction if balance update fails
      await supabase.from('transactions').delete().eq('id', transaction.id);
      return res.status(400).json({ 
        error: 'Transaction failed',
        code: ERROR_CODES.TRANSACTION_FAILED
      });
    }

    res.status(201).json({
      message: SUCCESS_MESSAGES.TRANSACTION_SUCCESS,
      transaction: {
        ...transaction,
        new_balance: newBalance
      }
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ 
      error: 'Transaction failed',
      code: ERROR_CODES.TRANSACTION_FAILED
    });
  }
};

// New endpoint for specific transaction types
export const createWithdrawal = async (req, res) => {
  try {
    const { amount, description, to_account_number } = req.body;
    
    // Use the main createTransaction logic but with withdrawal type
    req.body.type = 'debit';
    req.body.transaction_type = 'withdrawal';
    req.body.description = description || `Withdrawal${to_account_number ? ` to ${to_account_number}` : ''}`;
    
    return createTransaction(req, res);
  } catch (error) {
    console.error('Create withdrawal error:', error);
    res.status(500).json({ 
      error: 'Withdrawal failed',
      code: ERROR_CODES.TRANSACTION_FAILED
    });
  }
};

export const createTransfer = async (req, res) => {
  try {
    const { amount, description, to_account_number } = req.body;
    
    if (!to_account_number) {
      return res.status(400).json({ 
        error: 'Recipient account number is required for transfers',
        code: 'MISSING_RECIPIENT'
      });
    }
    
    // Use the main createTransaction logic but with transfer type
    req.body.type = 'debit';
    req.body.transaction_type = 'transfer';
    req.body.description = description || `Transfer to ${to_account_number}`;
    
    return createTransaction(req, res);
  } catch (error) {
    console.error('Create transfer error:', error);
    res.status(500).json({ 
      error: 'Transfer failed',
      code: ERROR_CODES.TRANSACTION_FAILED
    });
  }
};

export const createDeposit = async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    // Use the main createTransaction logic but with deposit type
    req.body.type = 'credit';
    req.body.transaction_type = 'deposit';
    req.body.description = description || 'Deposit';
    
    return createTransaction(req, res);
  } catch (error) {
    console.error('Create deposit error:', error);
    res.status(500).json({ 
      error: 'Deposit failed',
      code: ERROR_CODES.TRANSACTION_FAILED
    });
  }
};

export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: transaction, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ 
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND'
      });
    }

    res.json({ transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transaction',
      code: 'TRANSACTION_FETCH_FAILED'
    });
  }
};

export const getTransactionStats = async (req, res) => {
  try {
    const { data: stats, error } = await supabase
      .from('transactions')
      .select('type, amount, transaction_type')
      .eq('user_id', req.user.id)
      .eq('status', 'completed');

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch transaction stats',
        code: 'STATS_FETCH_FAILED'
      });
    }

    const totalCredits = stats
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = stats
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    // Breakdown by transaction type
    const typeBreakdown = stats.reduce((acc, transaction) => {
      const type = transaction.transaction_type || 'transfer';
      if (!acc[type]) {
        acc[type] = { count: 0, amount: 0 };
      }
      acc[type].count += 1;
      acc[type].amount += transaction.amount;
      return acc;
    }, {});

    res.json({
      total_transactions: stats.length,
      total_credits: totalCredits,
      total_debits: totalDebits,
      net_flow: totalCredits - totalDebits,
      type_breakdown: typeBreakdown
    });
  } catch (error) {
    console.error('Get transaction stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transaction statistics',
      code: 'STATS_FETCH_FAILED'
    });
  }
};