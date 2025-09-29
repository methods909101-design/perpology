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
                frequency_penalty: 0.1,
                tools: [
                    {
                        type: "function",
                        function: {
                            name: "search_crypto_prices",
                            description: "Search for live cryptocurrency prices and market data",
                            parameters: {
                                type: "object",
                                properties: {
                                    symbols: {
                                        type: "array",
                                        items: { type: "string" },
                                        description: "Array of cryptocurrency symbols to get prices for"
                                    }
                                },
                                required: ["symbols"]
                            }
                        }
                    }
                ],
                tool_choice: "auto"
            });

            let response;
            
            // Handle tool calls if present
            if (completion.choices[0].message.tool_calls) {
                // Add the assistant's message with tool calls to the conversation
                messages.push(completion.choices[0].message);

                // Process each tool call
                for (const toolCall of completion.choices[0].message.tool_calls) {
                    if (toolCall.function.name === 'search_crypto_prices') {
                        const args = JSON.parse(toolCall.arguments);
                        const priceData = await this.getLiveCryptoPrices(args.symbols);
                        
                        // Add the function response to the conversation
                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(priceData)
                        });
                    }
                }

                // Get the final response with the tool results
                const finalCompletion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    max_tokens: 1500,
                    temperature: 0.7,
                    presence_penalty: 0.1,
                    frequency_penalty: 0.1
                });

                response = finalCompletion.choices[0].message.content;
            } else {
                // No tool calls, use the original response
                response = completion.choices[0].message.content;
            }
            
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

    async getLiveCryptoPrices(symbols) {
        try {
            // Convert symbols to lowercase and join for CoinGecko API
            const symbolsString = symbols.map(s => {
                const symbolMap = {
                    'BTC': 'bitcoin',
                    'ETH': 'ethereum', 
                    'SOL': 'solana',
                    'ADA': 'cardano',
                    'DOT': 'polkadot',
                    'LINK': 'chainlink',
                    'UNI': 'uniswap',
                    'AAVE': 'aave',
                    'MATIC': 'matic-network',
                    'AVAX': 'avalanche-2',
                    'ATOM': 'cosmos',
                    'NEAR': 'near',
                    'FTM': 'fantom',
                    'ALGO': 'algorand',
                    'XRP': 'ripple',
                    'LTC': 'litecoin',
                    'DOGE': 'dogecoin'
                };
                return symbolMap[s.toUpperCase()] || s.toLowerCase();
            }).join(',');

            const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${symbolsString}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`);
            
            // Transform the response to match our expected format
            const priceData = {};
            Object.keys(response.data).forEach(coinId => {
                const symbolMap = {
                    'bitcoin': 'BTC',
                    'ethereum': 'ETH',
                    'solana': 'SOL',
                    'cardano': 'ADA',
                    'polkadot': 'DOT',
                    'chainlink': 'LINK',
                    'uniswap': 'UNI',
                    'aave': 'AAVE',
                    'matic-network': 'MATIC',
                    'avalanche-2': 'AVAX',
                    'cosmos': 'ATOM',
                    'near': 'NEAR',
                    'fantom': 'FTM',
                    'algorand': 'ALGO',
                    'ripple': 'XRP',
                    'litecoin': 'LTC',
                    'dogecoin': 'DOGE'
                };
                
                const symbol = symbolMap[coinId] || coinId.toUpperCase();
                const data = response.data[coinId];
                
                priceData[symbol] = {
                    price: data.usd,
                    change_24h: data.usd_24h_change,
                    market_cap: data.usd_market_cap,
                    volume_24h: data.usd_24h_vol,
                    timestamp: new Date().toISOString()
                };
            });

            return priceData;
        } catch (error) {
            console.error('Live crypto prices error:', error);
            // Return fallback data
            const fallbackData = {};
            symbols.forEach(symbol => {
                fallbackData[symbol] = {
                    price: 'N/A',
                    change_24h: 'N/A',
                    error: 'Failed to fetch live price data'
                };
            });
            return fallbackData;
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
