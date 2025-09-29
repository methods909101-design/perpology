const axios = require('axios');
const cheerio = require('cheerio');

class CryptoService {
    constructor() {
        this.coinGeckoBaseUrl = 'https://api.coingecko.com/api/v3';
        this.binanceBaseUrl = 'https://api.binance.com/api/v3';
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds cache
    }

    async getRelevantCryptoData(message) {
        try {
            // Extract crypto symbols from the message
            const cryptoSymbols = this.extractCryptoSymbols(message);
            
            if (cryptoSymbols.length === 0) {
                return null;
            }

            const cryptoData = {};
            
            for (const symbol of cryptoSymbols.slice(0, 3)) { // Limit to 3 symbols to avoid rate limits
                const data = await this.getCryptoData(symbol);
                if (data) {
                    cryptoData[symbol] = data;
                }
            }

            // Get general market data
            const marketData = await this.getMarketOverview();
            if (marketData) {
                cryptoData.market = marketData;
            }

            return Object.keys(cryptoData).length > 0 ? cryptoData : null;
        } catch (error) {
            console.error('Error getting relevant crypto data:', error);
            return null;
        }
    }

    extractCryptoSymbols(text) {
        const cryptoRegex = /\b(BTC|ETH|SOL|ADA|DOT|LINK|UNI|AAVE|MATIC|AVAX|ATOM|NEAR|FTM|ALGO|XRP|LTC|BCH|ETC|XLM|VET|THETA|HBAR|ICP|EGLD|FLOW|MANA|SAND|AXS|ENJ|CHZ|BAT|ZRX|COMP|MKR|SNX|YFI|CRV|SUSHI|1INCH|ALPHA|RUNE|LUNA|UST|DOGE|SHIB|PEPE|FLOKI|BITCOIN|ETHEREUM|SOLANA|CARDANO|POLKADOT|CHAINLINK|UNISWAP|POLYGON|AVALANCHE|COSMOS|ALGORAND|RIPPLE|LITECOIN)\b/gi;
        const matches = text.match(cryptoRegex) || [];
        
        // Convert full names to symbols
        const symbolMap = {
            'BITCOIN': 'BTC',
            'ETHEREUM': 'ETH',
            'SOLANA': 'SOL',
            'CARDANO': 'ADA',
            'POLKADOT': 'DOT',
            'CHAINLINK': 'LINK',
            'UNISWAP': 'UNI',
            'POLYGON': 'MATIC',
            'AVALANCHE': 'AVAX',
            'COSMOS': 'ATOM',
            'ALGORAND': 'ALGO',
            'RIPPLE': 'XRP',
            'LITECOIN': 'LTC'
        };

        return [...new Set(matches.map(match => {
            const upper = match.toUpperCase();
            return symbolMap[upper] || upper;
        }))];
    }

    async getCryptoData(symbol) {
        const cacheKey = `crypto_${symbol}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            // Get price data from Binance (faster and more reliable)
            const priceData = await this.getBinancePrice(symbol);
            
            // Get additional data from CoinGecko
            const geckoData = await this.getCoinGeckoData(symbol);
            
            const combinedData = {
                symbol: symbol,
                price: priceData?.price || geckoData?.current_price,
                change24h: priceData?.priceChangePercent || geckoData?.price_change_percentage_24h,
                volume24h: priceData?.volume || geckoData?.total_volume,
                marketCap: geckoData?.market_cap,
                high24h: priceData?.highPrice || geckoData?.high_24h,
                low24h: priceData?.lowPrice || geckoData?.low_24h,
                timestamp: Date.now(),
                technicalIndicators: await this.getTechnicalIndicators(symbol)
            };

            this.setCache(cacheKey, combinedData);
            return combinedData;
        } catch (error) {
            console.error(`Error fetching data for ${symbol}:`, error);
            return null;
        }
    }

    async getBinancePrice(symbol) {
        try {
            const response = await axios.get(`${this.binanceBaseUrl}/ticker/24hr?symbol=${symbol}USDT`, {
                timeout: 5000
            });
            
            return {
                price: parseFloat(response.data.lastPrice),
                priceChangePercent: parseFloat(response.data.priceChangePercent),
                volume: parseFloat(response.data.volume),
                highPrice: parseFloat(response.data.highPrice),
                lowPrice: parseFloat(response.data.lowPrice)
            };
        } catch (error) {
            // Handle geographic restrictions (status 451) and other errors gracefully
            if (error.response && error.response.status === 451) {
                console.warn(`Binance API restricted for ${symbol} - falling back to CoinGecko only`);
            } else {
                console.error(`Binance API error for ${symbol}:`, error.message);
            }
            return null;
        }
    }

    async getCoinGeckoData(symbol) {
        try {
            const coinId = this.getCoinGeckoId(symbol);
            if (!coinId) return null;

            const response = await axios.get(`${this.coinGeckoBaseUrl}/simple/price`, {
                params: {
                    ids: coinId,
                    vs_currencies: 'usd',
                    include_24hr_change: true,
                    include_24hr_vol: true,
                    include_market_cap: true
                },
                timeout: 5000
            });

            const data = response.data[coinId];
            if (!data) return null;

            return {
                current_price: data.usd,
                price_change_percentage_24h: data.usd_24h_change,
                total_volume: data.usd_24h_vol,
                market_cap: data.usd_market_cap
            };
        } catch (error) {
            console.error(`CoinGecko API error for ${symbol}:`, error.message);
            return null;
        }
    }

    getCoinGeckoId(symbol) {
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
        return symbolMap[symbol.toUpperCase()];
    }

    async getTechnicalIndicators(symbol) {
        try {
            // Simple technical analysis based on price action
            const klineData = await this.getKlineData(symbol);
            if (!klineData || klineData.length < 20) return null;

            const closes = klineData.map(k => parseFloat(k[4]));
            const highs = klineData.map(k => parseFloat(k[2]));
            const lows = klineData.map(k => parseFloat(k[3]));

            return {
                sma20: this.calculateSMA(closes, 20),
                sma50: this.calculateSMA(closes, 50),
                rsi: this.calculateRSI(closes, 14),
                support: Math.min(...lows.slice(-20)),
                resistance: Math.max(...highs.slice(-20)),
                trend: this.determineTrend(closes)
            };
        } catch (error) {
            console.error(`Technical indicators error for ${symbol}:`, error);
            return null;
        }
    }

    async getKlineData(symbol) {
        try {
            const response = await axios.get(`${this.binanceBaseUrl}/klines`, {
                params: {
                    symbol: `${symbol}USDT`,
                    interval: '1h',
                    limit: 100
                },
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            // Handle geographic restrictions (status 451) and other errors gracefully
            if (error.response && error.response.status === 451) {
                console.warn(`Binance kline data restricted for ${symbol} - technical indicators unavailable`);
            } else {
                console.error(`Kline data error for ${symbol}:`, error);
            }
            return null;
        }
    }

    calculateSMA(prices, period) {
        if (prices.length < period) return null;
        const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return null;
        
        let gains = 0;
        let losses = 0;
        
        for (let i = prices.length - period; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) {
                gains += change;
            } else {
                losses -= change;
            }
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    determineTrend(prices) {
        if (prices.length < 10) return 'neutral';
        
        const recent = prices.slice(-10);
        const older = prices.slice(-20, -10);
        
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        
        if (change > 2) return 'bullish';
        if (change < -2) return 'bearish';
        return 'neutral';
    }

    async getMarketOverview() {
        const cacheKey = 'market_overview';
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const response = await axios.get(`${this.coinGeckoBaseUrl}/global`, {
                timeout: 5000
            });
            
            const data = {
                totalMarketCap: response.data.data.total_market_cap.usd,
                totalVolume: response.data.data.total_volume.usd,
                btcDominance: response.data.data.market_cap_percentage.btc,
                ethDominance: response.data.data.market_cap_percentage.eth,
                fearGreedIndex: await this.getFearGreedIndex()
            };

            this.setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('Market overview error:', error);
            return null;
        }
    }

    async getFearGreedIndex() {
        try {
            const response = await axios.get('https://api.alternative.me/fng/', {
                timeout: 5000
            });
            return {
                value: parseInt(response.data.data[0].value),
                classification: response.data.data[0].value_classification
            };
        } catch (error) {
            console.error('Fear & Greed Index error:', error);
            return null;
        }
    }

    async getTradingViewData(symbol) {
        try {
            // Generate TradingView embed URL
            const tradingViewUrl = `https://www.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=BINANCE:${symbol}USDT&interval=1H&hidesidetoolbar=1&hidetoptoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&hideideas=1&theme=dark&style=1&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=BINANCE:${symbol}USDT`;
            
            return {
                embedUrl: tradingViewUrl,
                symbol: symbol,
                exchange: 'BINANCE',
                interval: '1H'
            };
        } catch (error) {
            console.error('TradingView data error:', error);
            return null;
        }
    }

    async getNewsData(symbol) {
        try {
            // Scrape crypto news from CoinDesk or similar
            const response = await axios.get(`https://www.coindesk.com/search?s=${symbol}`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            const articles = [];

            $('.articleTextSection').each((i, element) => {
                if (i < 5) { // Limit to 5 articles
                    const title = $(element).find('h4 a').text().trim();
                    const link = $(element).find('h4 a').attr('href');
                    const summary = $(element).find('.excerpt').text().trim();
                    
                    if (title && link) {
                        articles.push({
                            title,
                            link: link.startsWith('http') ? link : `https://www.coindesk.com${link}`,
                            summary
                        });
                    }
                }
            });

            return articles;
        } catch (error) {
            console.error('News scraping error:', error);
            return [];
        }
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
}

module.exports = new CryptoService();
