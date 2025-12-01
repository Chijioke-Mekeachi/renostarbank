// controllers/accountController.mjs
import supabase from '../config/supabase.mjs';
import { ACCOUNT_STATUS, ERROR_CODES, SUCCESS_MESSAGES } from '../utils/constants.mjs';

export const getBalance = async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('balance, account_number')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ 
        error: 'Account not found',
        code: ERROR_CODES.ACCOUNT_NOT_FOUND
      });
    }

    res.json({
      balance: profile.balance,
      account_number: profile.account_number
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch balance',
      code: 'BALANCE_FETCH_FAILED'
    });
  }
};

export const transfer = async (req, res) => {
  const client = supabase;
  
  try {
    // Check if account is active
    if (!req.user.is_active) {
      return res.status(403).json({ 
        error: 'Account is not active. Please wait for activation to perform transfers.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    const { to_account_number, amount, description } = req.body;

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({ 
        error: 'Amount must be positive',
        code: 'INVALID_AMOUNT'
      });
    }

    // Check if recipient exists and is active
    const { data: recipient, error: recipientError } = await client
      .from('profiles')
      .select('id, name, balance, is_active')
      .eq('account_number', to_account_number)
      .single();

    if (recipientError || !recipient) {
      return res.status(400).json({ 
        error: 'Recipient account not found',
        code: ERROR_CODES.ACCOUNT_NOT_FOUND
      });
    }

    if (!recipient.is_active) {
      return res.status(400).json({ 
        error: 'Recipient account is not active',
        code: 'RECIPIENT_INACTIVE'
      });
    }

    if (recipient.id === req.user.id) {
      return res.status(400).json({ 
        error: 'Cannot transfer to your own account',
        code: 'SELF_TRANSFER'
      });
    }

    // Get sender's current balance
    const { data: senderProfile, error: senderError } = await client
      .from('profiles')
      .select('balance, account_number')
      .eq('id', req.user.id)
      .single();

    if (senderError) {
      return res.status(400).json({ 
        error: 'Failed to fetch sender account',
        code: ERROR_CODES.ACCOUNT_NOT_FOUND
      });
    }

    if (senderProfile.balance < amount) {
      return res.status(400).json({ 
        error: 'Insufficient funds',
        code: ERROR_CODES.INSUFFICIENT_FUNDS
      });
    }

    // Perform transfer within a transaction
    const { data: debitTransaction, error: debitError } = await client
      .from('transactions')
      .insert([
        {
          user_id: req.user.id,
          type: 'debit',
          amount: amount,
          description: description || `Transfer to ${to_account_number}`,
          to_account_number: to_account_number,
          status: 'completed'
        }
      ])
      .select()
      .single();

    if (debitError) {
      return res.status(400).json({ 
        error: 'Failed to create debit transaction',
        code: ERROR_CODES.TRANSACTION_FAILED
      });
    }

    // Create credit transaction for recipient
    const { data: creditTransaction, error: creditError } = await client
      .from('transactions')
      .insert([
        {
          user_id: recipient.id,
          type: 'credit',
          amount: amount,
          description: description || `Transfer from ${senderProfile.account_number}`,
          to_account_number: senderProfile.account_number,
          status: 'completed'
        }
      ])
      .select()
      .single();

    if (creditError) {
      // Rollback debit transaction
      await client.from('transactions').delete().eq('id', debitTransaction.id);
      return res.status(400).json({ 
        error: 'Failed to create credit transaction',
        code: ERROR_CODES.TRANSACTION_FAILED
      });
    }

    // Update sender balance
    const { error: updateSenderError } = await client
      .from('profiles')
      .update({ balance: senderProfile.balance - amount })
      .eq('id', req.user.id);

    if (updateSenderError) {
      // Rollback both transactions
      await client.from('transactions').delete().eq('id', debitTransaction.id);
      await client.from('transactions').delete().eq('id', creditTransaction.id);
      return res.status(400).json({ 
        error: 'Failed to update sender balance',
        code: ERROR_CODES.TRANSACTION_FAILED
      });
    }

    // Update recipient balance
    const { error: updateRecipientError } = await client
      .from('profiles')
      .update({ balance: recipient.balance + amount })
      .eq('id', recipient.id);

    if (updateRecipientError) {
      // Rollback everything
      await client.from('transactions').delete().eq('id', debitTransaction.id);
      await client.from('transactions').delete().eq('id', creditTransaction.id);
      await client.from('profiles')
        .update({ balance: senderProfile.balance })
        .eq('id', req.user.id);
      return res.status(400).json({ 
        error: 'Failed to update recipient balance',
        code: ERROR_CODES.TRANSACTION_FAILED
      });
    }

    res.json({
      message: SUCCESS_MESSAGES.TRANSFER_SUCCESS,
      transaction: debitTransaction,
      new_balance: senderProfile.balance - amount
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ 
      error: 'Transfer failed',
      code: ERROR_CODES.TRANSACTION_FAILED
    });
  }
};

export const getAccountInfo = async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ 
        error: 'Account not found',
        code: ERROR_CODES.ACCOUNT_NOT_FOUND
      });
    }

    res.json({
      account: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        account_number: profile.account_number,
        balance: profile.balance,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      }
    });
  } catch (error) {
    console.error('Get account info error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch account information',
      code: 'ACCOUNT_INFO_FETCH_FAILED'
    });
  }
};