const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const aiService = require('./services/aiService');
const cryptoService = require('./services/cryptoService');
const supabaseService = require('./services/supabaseService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Route for the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Routes
app.post('/api/chat', async (req, res) => {
    try {
        const { message, chatHistory, requireRealTimeData } = req.body;
        
        // Always get live crypto data for real-time responses
        const cryptoData = await cryptoService.getRelevantCryptoData(message);
        
        // Get additional market context for comprehensive analysis
        const marketOverview = await cryptoService.getMarketOverview();
        
        // Combine all real-time data
        const realTimeContext = {
            cryptoData,
            marketOverview,
            timestamp: new Date().toISOString(),
            requiresRealTimeData: requireRealTimeData || true
        };
        
        // Generate AI response with comprehensive real-time context
        const response = await aiService.generateResponse(message, chatHistory, realTimeContext);
        
        res.json({ 
            success: true, 
            response: response.content,
            metadata: response.metadata,
            realTimeData: true
        });
    } catch (error) {
        console.error('Chat API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to generate response' 
        });
    }
});

app.get('/api/crypto/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const data = await cryptoService.getCryptoData(symbol);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Crypto API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch crypto data' 
        });
    }
});

app.get('/api/tradingview/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const chartData = await cryptoService.getTradingViewData(symbol);
        res.json({ success: true, data: chartData });
    } catch (error) {
        console.error('TradingView API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch chart data' 
        });
    }
});

// Chat Management API Routes

// Get all chats for a wallet
app.get('/api/chats/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const result = await supabaseService.getChats(walletAddress);
        
        if (result.success) {
            res.json({ success: true, chats: result.chats });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Get chats API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch chats' 
        });
    }
});

// Create a new chat
app.post('/api/chats', async (req, res) => {
    try {
        const { walletAddress, title } = req.body;
        
        if (!walletAddress) {
            return res.status(400).json({ 
                success: false, 
                error: 'Wallet address is required' 
            });
        }
        
        const result = await supabaseService.createChat(walletAddress, title);
        
        if (result.success) {
            res.json({ success: true, chat: result.chat });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Create chat API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create chat' 
        });
    }
});

// Get a specific chat with messages
app.get('/api/chats/:walletAddress/:chatId', async (req, res) => {
    try {
        const { walletAddress, chatId } = req.params;
        const result = await supabaseService.getChat(chatId, walletAddress);
        
        if (result.success) {
            res.json({ success: true, chat: result.chat });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Get chat API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch chat' 
        });
    }
});

// Add a message to a chat
app.post('/api/chats/:walletAddress/:chatId/messages', async (req, res) => {
    try {
        const { walletAddress, chatId } = req.params;
        const { role, content, metadata } = req.body;
        
        if (!role || !content) {
            return res.status(400).json({ 
                success: false, 
                error: 'Role and content are required' 
            });
        }
        
        const result = await supabaseService.addMessage(chatId, walletAddress, role, content, metadata);
        
        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Add message API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to add message' 
        });
    }
});

// Update chat title
app.put('/api/chats/:walletAddress/:chatId', async (req, res) => {
    try {
        const { walletAddress, chatId } = req.params;
        const { title } = req.body;
        
        if (!title) {
            return res.status(400).json({ 
                success: false, 
                error: 'Title is required' 
            });
        }
        
        const result = await supabaseService.updateChatTitle(chatId, walletAddress, title);
        
        if (result.success) {
            res.json({ success: true, chat: result.chat });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Update chat API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update chat' 
        });
    }
});

// Delete a chat
app.delete('/api/chats/:walletAddress/:chatId', async (req, res) => {
    try {
        const { walletAddress, chatId } = req.params;
        const result = await supabaseService.deleteChat(chatId, walletAddress);
        
        if (result.success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Delete chat API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete chat' 
        });
    }
});

// Enhanced chat endpoint with persistence
app.post('/api/chat/persistent', async (req, res) => {
    try {
        const { message, chatId, walletAddress, isNewChat } = req.body;
        
        if (!walletAddress) {
            return res.status(400).json({ 
                success: false, 
                error: 'Wallet address is required' 
            });
        }
        
        let currentChatId = chatId;
        
        // Create new chat if needed
        if (isNewChat || !currentChatId) {
            const title = supabaseService.generateChatTitle(message);
            const createResult = await supabaseService.createChat(walletAddress, title);
            
            if (!createResult.success) {
                return res.status(500).json({ success: false, error: createResult.error });
            }
            
            currentChatId = createResult.chat.id;
        }
        
        // Add user message to database
        const userMessageResult = await supabaseService.addMessage(
            currentChatId, 
            walletAddress, 
            'user', 
            message
        );
        
        if (!userMessageResult.success) {
            return res.status(500).json({ success: false, error: userMessageResult.error });
        }
        
        // Get chat history for AI context
        const chatResult = await supabaseService.getChat(currentChatId, walletAddress);
        if (!chatResult.success) {
            return res.status(500).json({ success: false, error: chatResult.error });
        }
        
        const chatHistory = chatResult.chat.messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
        
        // Get live crypto data for real-time responses
        const cryptoData = await cryptoService.getRelevantCryptoData(message);
        const marketOverview = await cryptoService.getMarketOverview();
        
        const realTimeContext = {
            cryptoData,
            marketOverview,
            timestamp: new Date().toISOString(),
            requiresRealTimeData: true
        };
        
        // Generate AI response
        const response = await aiService.generateResponse(message, chatHistory, realTimeContext);
        
        // Add AI response to database
        const aiMessageResult = await supabaseService.addMessage(
            currentChatId, 
            walletAddress, 
            'assistant', 
            response.content,
            response.metadata
        );
        
        if (!aiMessageResult.success) {
            return res.status(500).json({ success: false, error: aiMessageResult.error });
        }
        
        res.json({ 
            success: true, 
            response: response.content,
            metadata: response.metadata,
            chatId: currentChatId,
            realTimeData: true
        });
        
    } catch (error) {
        console.error('Persistent chat API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process chat message' 
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Perpology server running at http://localhost:${PORT}`);
    console.log(`📊 AI-powered crypto analysis platform ready!`);
    console.log(`🤖 OpenAI integration: ${process.env.OPENAI_API_KEY ? 'Connected' : 'Not configured'}`);
});
