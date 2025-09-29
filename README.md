# Perpology - AI Crypto Trading Analysis Platform

A sophisticated AI-powered crypto trading analysis platform with persistent chat functionality using Supabase for data storage.

## Features

- 🤖 **AI-Powered Analysis**: Advanced AI algorithms for crypto market analysis and trading signals
- 💬 **Persistent Chats**: Wallet-based chat history stored in Supabase
- 🔗 **Phantom Wallet Integration**: Secure wallet connection for personalized experience
- 📊 **Real-time Data**: Live crypto market data and price analysis
- 📈 **Trading Signals**: AI-generated trading recommendations with entry/exit points
- 🎨 **Modern UI**: Glassmorphism design with smooth animations

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT API
- **Wallet**: Phantom Wallet Integration
- **Styling**: Custom CSS with glassmorphism effects

## Setup Instructions

### 1. Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account
- OpenAI API key
- Phantom wallet (for testing)

### 2. Clone and Install

```bash
git clone <repository-url>
cd perpology
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3000

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Supabase Setup

#### 4.1 Create a Supabase Project

1. Go to [Supabase](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key to the `.env` file

#### 4.2 Set Up Database Schema

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL script from `database/schema.sql`:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chats_wallet_address ON chats(wallet_address);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own chats" ON chats FOR SELECT USING (true);
CREATE POLICY "Users can insert their own chats" ON chats FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own chats" ON chats FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own chats" ON chats FOR DELETE USING (true);

CREATE POLICY "Users can view messages from their chats" ON messages
    FOR SELECT USING (EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id));
CREATE POLICY "Users can insert messages to their chats" ON messages
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id));
CREATE POLICY "Users can update messages in their chats" ON messages
    FOR UPDATE USING (EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id));
CREATE POLICY "Users can delete messages from their chats" ON messages
    FOR DELETE USING (EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id));

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chats_updated_at 
    BEFORE UPDATE ON chats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chats SET updated_at = NOW() WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_on_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_timestamp();
```

### 5. OpenAI API Setup

1. Get your OpenAI API key from [OpenAI Platform](https://platform.openai.com)
2. Add it to your `.env` file
3. Ensure you have sufficient credits for API usage

### 6. Run the Application

```bash
npm run dev
# or
npm start
```

The application will be available at `http://localhost:3000`

## API Endpoints

### Chat Management

- `GET /api/chats/:walletAddress` - Get all chats for a wallet
- `POST /api/chats` - Create a new chat
- `GET /api/chats/:walletAddress/:chatId` - Get specific chat with messages
- `PUT /api/chats/:walletAddress/:chatId` - Update chat title
- `DELETE /api/chats/:walletAddress/:chatId` - Delete a chat
- `POST /api/chats/:walletAddress/:chatId/messages` - Add message to chat

### AI Chat

- `POST /api/chat` - Send message (non-persistent)
- `POST /api/chat/persistent` - Send message with persistence

### Crypto Data

- `GET /api/crypto/:symbol` - Get crypto data for symbol
- `GET /api/tradingview/:symbol` - Get TradingView chart data

## Database Schema

### Chats Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| wallet_address | TEXT | Phantom wallet address |
| title | TEXT | Chat title (auto-generated) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### Messages Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| chat_id | UUID | Foreign key to chats table |
| role | TEXT | 'user' or 'assistant' |
| content | TEXT | Message content |
| metadata | JSONB | Additional message metadata |
| created_at | TIMESTAMP | Creation timestamp |

## Features in Detail

### Wallet Integration

- Connect with Phantom wallet
- Wallet-based chat persistence
- Secure user identification

### AI Chat System

- Real-time crypto market analysis
- Trading signal generation
- Contextual conversation history
- Rate limiting (20-second cooldown)

### Chat Management

- Create new chats
- Load previous conversations
- Delete unwanted chats
- Auto-generated chat titles

### UI/UX Features

- Glassmorphism design
- Smooth animations
- Responsive layout
- Real-time typing indicators
- Interactive trading signals

## Development

### Project Structure

```
perpology/
├── index.html              # Main HTML file
├── script.js               # Frontend JavaScript
├── styles.css              # CSS styles
├── server.js               # Express server
├── package.json            # Dependencies
├── .env                    # Environment variables
├── database/
│   └── schema.sql          # Database schema
└── services/
    ├── supabaseService.js  # Supabase integration
    ├── aiService.js        # OpenAI integration
    └── cryptoService.js    # Crypto data service
```

### Adding New Features

1. **Backend**: Add new routes in `server.js`
2. **Database**: Update schema in `database/schema.sql`
3. **Frontend**: Update `script.js` and `styles.css`
4. **Services**: Add new services in the `services/` directory

## Troubleshooting

### Common Issues

1. **Supabase Connection Error**
   - Verify SUPABASE_URL and SUPABASE_ANON_KEY in `.env`
   - Check if database schema is properly set up

2. **OpenAI API Error**
   - Verify OPENAI_API_KEY in `.env`
   - Check API usage limits and billing

3. **Phantom Wallet Not Detected**
   - Install Phantom wallet extension
   - Refresh the page after installation

4. **Chat History Not Loading**
   - Check browser console for errors
   - Verify wallet connection
   - Check Supabase database permissions

### Debug Mode

Enable debug logging by adding to `.env`:

```env
DEBUG=true
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Check the troubleshooting section
- Review the API documentation
- Open an issue on GitHub
