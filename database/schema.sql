-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    account_number TEXT UNIQUE NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Transactions table
CREATE TABLE transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    to_account_number TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Chat conversations table
CREATE TABLE chat_conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved')),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Chat messages table
CREATE TABLE chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'admin', 'bot')),
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'action')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Admin users table for bot/admin management
CREATE TABLE admin_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'support' CHECK (role IN ('admin', 'support', 'bot')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Chat conversations policies
CREATE POLICY "Users can view own conversations" ON chat_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON chat_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON chat_conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations" ON chat_conversations
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid() AND admin_users.is_active = true
    ));

-- Chat messages policies
CREATE POLICY "Users can view messages in own conversations" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE chat_conversations.id = chat_messages.conversation_id 
            AND chat_conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in own conversations" ON chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_conversations 
            WHERE chat_conversations.id = chat_messages.conversation_id 
            AND chat_conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all messages" ON chat_messages
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid() AND admin_users.is_active = true
    ));

CREATE POLICY "Admins can insert messages" ON chat_messages
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid() AND admin_users.is_active = true
    ));

-- Admin users policies (only admins can access)
CREATE POLICY "Only admins can access admin_users" ON admin_users
    FOR ALL USING (EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.id = auth.uid() AND admin_users.role = 'admin'
    ));

-- Indexes for better performance
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_account_number ON profiles(account_number);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_status ON chat_conversations(status);
CREATE INDEX idx_chat_conversations_last_message_at ON chat_conversations(last_message_at);
CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_messages_sender_type ON chat_messages(sender_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a default bot admin user
INSERT INTO admin_users (id, email, name, role, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'bot@ronstonebank.com', 'Ron Stone Bot', 'bot', true)
ON CONFLICT (id) DO NOTHING;

-- Function to handle new user signup (for future use with triggers)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, account_number, is_active)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'name',
        NEW.email,
        NEW.raw_user_meta_data->>'account_number',
        false
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;