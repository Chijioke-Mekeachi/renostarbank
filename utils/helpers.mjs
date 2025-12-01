// Generate random account number
export const generateAccountNumber = () => {
  const prefix = 'RS';
  const randomNumber = Math.random().toString().slice(2, 12);
  return prefix + randomNumber;
};

// Format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

// Generate bot response based on user message
export const generateBotResponse = (userMessage) => {
  const message = userMessage.toLowerCase();
  
  const responses = {
    balance: "I can help you check your account balance. Please go to the Dashboard to view your current balance and transaction history.",
    money: "I can help you check your account balance. Please go to the Dashboard to view your current balance and transaction history.",
    transfer: "You can transfer money to other accounts using the Transfer feature in your dashboard. Make sure you have the recipient's account number ready.",
    'send money': "You can transfer money to other accounts using the Transfer feature in your dashboard. Make sure you have the recipient's account number ready.",
    card: "For debit card inquiries, including lost or stolen cards, please contact our card services department at 1-800-RON-STONE.",
    debit: "For debit card inquiries, including lost or stolen cards, please contact our card services department at 1-800-RON-STONE.",
    loan: "We offer various loan options. You can apply for a loan through our online portal or visit your nearest branch for personalized assistance.",
    credit: "We offer various loan options. You can apply for a loan through our online portal or visit your nearest branch for personalized assistance.",
    fee: "You can view all account fees and charges in the Fees Schedule section of our website or mobile app.",
    charge: "You can view all account fees and charges in the Fees Schedule section of our website or mobile app.",
    active: "Account activation typically takes 24-48 hours after verification. Our team will notify you once your account is active.",
    activate: "Account activation typically takes 24-48 hours after verification. Our team will notify you once your account is active.",
    default: "Thank you for your message. Our support team will get back to you shortly. For immediate assistance, you can call our customer service at 1-800-RON-STONE."
  };

  for (const [keyword, response] of Object.entries(responses)) {
    if (message.includes(keyword)) {
      return response;
    }
  }

  return responses.default;
};

// Validate email format
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate random ID
export const generateId = (length = 8) => {
  return Math.random().toString(36).substr(2, length);
};

// Calculate new balance after transaction
// Format date for display
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
// utils/helpers.mjs
export const calculateNewBalance = (currentBalance, amount, type) => {
  if (type === 'credit') {
    return currentBalance + amount;
  } else if (type === 'debit') {
    return currentBalance - amount;
  }
  return currentBalance;
};

export const generateReference = (type) => {
  const prefix = type.toUpperCase().substring(0, 3);
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
};