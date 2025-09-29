const OpenAI = require('openai');
const axios = require('axios');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

class AIService {
    constructor() {
        this.systemPrompt = `You are Perpology AI, an advanced crypto trading assistant specialized in perpetual futures trading. You are branded as a professional, cutting-edge AI that provides:

1. Real-time crypto market analysis
2. Technical analysis with entry/exit points
3. Risk management strategies (stop loss, take profit)
4. Live market data interpretation
5. News and social sentiment analysis
6. TradingView chart integration

Your responses should be:
- Professional and authoritative
- Data-driven with specific numbers
- Include reasoning for all recommendations
- Focused on perpetual trading strategies
- Branded with Perpology's sophisticated approach
- NEVER use hashtag symbols (#) or markdown headers in your responses
- Format sections using plain text with clear paragraph breaks instead of headers

When providing trading advice, always include:
- Specific entry price
- Stop loss level with reasoning
- Take profit targets
- Risk/reward ratio
- Market context and reasoning

You have access to live market data, news, and social sentiment. Use this data to provide accurate, timely advice.

IMPORTANT: Do not use any hashtag symbols (#) or markdown headers (###, ##, #) in your responses. Use plain text formatting with clear section breaks instead.`;
    }

    async generateResponse(userMessage, chatHistory = [], cryptoData = null) {
        try {
            const messages = [
                { role: 'system', content: this.systemPrompt }
            ];

            // Add chat history
            if (chatHistory && chatHistory.length > 0) {
                chatHistory.slice(-10).forEach(msg => {
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    });
                });
            }

            // Add crypto data context if available
            if (cryptoData) {
                const contextMessage = `Current market data: ${JSON.stringify(cryptoData, null, 2)}`;
                messages.push({
                    role: 'system',
                    content: contextMessage
                });
            }

            // Add user message
            messages.push({
                role: 'user',
                content: userMessage
            });

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 1500,
                temperature: 0.7,
                presence_penalty: 0.1,
                frequency_penalty: 0.1
            });

            let response = completion.choices[0].message.content;
            
            // Ensure response is not null before processing
            if (!response || typeof response !== 'string') {
                response = "I'm here to help you with crypto trading analysis. What would you like to know about the markets today?";
            }

            // Comprehensive hashtag and markdown header removal
            // Remove all markdown headers (### Header, ## Header, # Header)
            response = response.replace(/^#{1,6}\s+.*$/gm, '');
            
            // Remove hashtags at the beginning of lines
            response = response.replace(/^#+\s*/gm, '');
            
            // Remove hashtags followed by text (like ### Risk Management)
            response = response.replace(/#{1,6}\s+([^\n\r]+)/g, '$1');
            
            // Remove standalone hashtags
            response = response.replace(/#+/g, '');
            
            // Remove hashtags in bold text
            response = response.replace(/\*\*#+.*?\*\*/g, '');
            
            // Clean up any remaining hashtag patterns
            response = response.replace(/#([A-Za-z0-9_\s]+)/g, '$1');
            response = response.replace(/\s+#\s+/g, ' ');
            
            // Remove multiple consecutive line breaks that might result from header removal
            response = response.replace(/\n{3,}/g, '\n\n');
            
            // Trim any leading/trailing whitespace
            response = response.trim();

            // Extract metadata for enhanced UI features
            const metadata = this.extractMetadata(response, userMessage);

            return {
                content: response,
                metadata: metadata
            };

        } catch (error) {
            console.error('OpenAI API error:', error);
            throw new Error('Failed to generate AI response');
        }
    }

    extractMetadata(response, userMessage) {
        const metadata = {
            hasChart: false,
            hasTradingSignal: false,
            cryptoSymbols: [],
            links: [],
            tradingData: null
        };

        // Extract crypto symbols mentioned in both response and user message
        const cryptoRegex = /\b(BTC|ETH|SOL|ADA|DOT|LINK|UNI|AAVE|MATIC|AVAX|ATOM|NEAR|FTM|ALGO|XRP|LTC|BCH|ETC|XLM|VET|THETA|HBAR|ICP|EGLD|FLOW|MANA|SAND|AXS|ENJ|CHZ|BAT|ZRX|COMP|MKR|SNX|YFI|CRV|SUSHI|1INCH|ALPHA|RUNE|LUNA|UST|DOGE|SHIB|PEPE|FLOKI)\b/gi;
        const responseSymbols = response.match(cryptoRegex) || [];
        const userSymbols = userMessage.match(cryptoRegex) || [];
        const allSymbols = [...responseSymbols, ...userSymbols];
        metadata.cryptoSymbols = [...new Set(allSymbols.map(s => s.toUpperCase()))];

        // Check for trading signals
        const tradingKeywords = /\b(entry|stop loss|take profit|long|short|buy|sell|target|resistance|support)\b/gi;
        metadata.hasTradingSignal = tradingKeywords.test(response);

        // Always show chart for ANY crypto symbol mentioned or crypto-related query
        metadata.hasChart = metadata.cryptoSymbols.length > 0;

        // Also check for explicit chart requests and general crypto queries
        const chartKeywords = /\b(chart|graph|technical analysis|candlestick|price action|trading view|tradingview|price|trading|crypto|bitcoin|ethereum|solana|analysis)\b/gi;
        if (chartKeywords.test(response) || chartKeywords.test(userMessage)) {
            metadata.hasChart = true;
            // If no specific symbol mentioned but crypto-related, default to BTC
            if (metadata.cryptoSymbols.length === 0) {
                metadata.cryptoSymbols = ['BTC'];
            }
        }

        // Extract URLs for link previews
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        metadata.links = response.match(urlRegex) || [];

        // Extract trading data if present
        if (metadata.hasTradingSignal) {
            metadata.tradingData = this.extractTradingData(response);
        }

        return metadata;
    }

    extractTradingData(response) {
        const tradingData = {
            entry: null,
            stopLoss: null,
            takeProfit: null,
            direction: null
        };

        // Extract entry price
        const entryMatch = response.match(/entry[:\s]*\$?([0-9,]+\.?[0-9]*)/i);
        if (entryMatch) {
            tradingData.entry = parseFloat(entryMatch[1].replace(/,/g, ''));
        }

        // Extract stop loss
        const stopLossMatch = response.match(/stop\s*loss[:\s]*\$?([0-9,]+\.?[0-9]*)/i);
        if (stopLossMatch) {
            tradingData.stopLoss = parseFloat(stopLossMatch[1].replace(/,/g, ''));
        }

        // Extract take profit
        const takeProfitMatch = response.match(/take\s*profit[:\s]*\$?([0-9,]+\.?[0-9]*)/i);
        if (takeProfitMatch) {
            tradingData.takeProfit = parseFloat(takeProfitMatch[1].replace(/,/g, ''));
        }

        // Extract direction
        if (/\b(long|buy)\b/i.test(response)) {
            tradingData.direction = 'long';
        } else if (/\b(short|sell)\b/i.test(response)) {
            tradingData.direction = 'short';
        }

        return tradingData;
    }

    async searchWeb(query) {
        try {
            // Using DuckDuckGo instant answer API for web search
            const response = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
            return response.data;
        } catch (error) {
            console.error('Web search error:', error);
            return null;
        }
    }

    async getNewsData(cryptoSymbol) {
        try {
            // Using CoinGecko API for crypto news (free tier)
            const response = await axios.get(`https://api.coingecko.com/api/v3/search/trending`);
            return response.data;
        } catch (error) {
            console.error('News data error:', error);
            return null;
        }
    }
}

module.exports = new AIService();
