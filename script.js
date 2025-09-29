// Perpology - AI Crypto Trading Analysis Platform
// Enhanced Frontend with AI Integration

class PerpologyApp {
    constructor() {
        this.currentChat = null;
        this.currentChatId = null;
        this.chatHistory = [];
        this.isWalletConnected = false;
        this.walletAddress = null;
        this.isThinking = false;
        this.lastMessageTime = 0;
        this.rateLimitDuration = 20000; // 20 seconds
        this.isRateLimited = false;
        this.chats = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkWalletConnection();
        this.initializeAnimations();
    }

    initializeAnimations() {
        // Add CSS animations for professional effects
        const style = document.createElement('style');
        style.textContent = `
            .message-enter {
                animation: messageSlideIn 0.3s ease-out;
            }
            
            @keyframes messageSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .thinking-animation {
                animation: pulse 1.5s ease-in-out infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
            }
            
            .chart-container {
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                margin: 16px 0;
            }
            
            .trading-signal {
                background: rgba(255, 255, 255, 0.05);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 20px;
                margin: 16px 0;
                color: var(--text-primary);
                transition: all 0.3s ease;
            }
            
            .trading-signal:hover {
                box-shadow: 0 0 20px rgba(0, 255, 136, 0.1);
                border-color: rgba(0, 255, 136, 0.3);
            }
            
            .link-preview {
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                overflow: hidden;
                margin: 12px 0;
                transition: transform 0.2s ease;
            }
            
            .link-preview:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .crypto-price-widget {
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                border-radius: 12px;
                padding: 16px;
                margin: 12px 0;
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .price-change.positive {
                color: #4ade80;
            }
            
            .price-change.negative {
                color: #f87171;
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('homeBtn').addEventListener('click', () => this.showLandingPage());
        document.getElementById('homeBtnIcon').addEventListener('click', () => this.showLandingPage());
        document.getElementById('newChatBtn').addEventListener('click', () => this.startNewChat());
        document.getElementById('ctaConnectBtn').addEventListener('click', () => this.connectWallet());

        // Chat
        document.getElementById('sendButton').addEventListener('click', () => this.sendMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea and hide suggested messages on input
        document.getElementById('chatInput').addEventListener('input', (e) => {
            this.autoResizeTextarea(e);
            this.hideSuggestedMessages();
            // Pulse timer if user types during rate limit
            if (this.isRateLimited) {
                this.pulseTimer();
            }
        });

        // Suggested messages
        this.setupSuggestedMessages();

        // Wallet
        document.getElementById('connectWalletBtn').addEventListener('click', () => this.connectWallet());
        document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnectWallet());
    }

    showLandingPage() {
        document.getElementById('landingPage').classList.remove('hidden');
        document.getElementById('chatInterface').classList.add('hidden');
    }

    showChatInterface() {
        document.getElementById('landingPage').classList.add('hidden');
        document.getElementById('chatInterface').classList.remove('hidden');
    }

    async startNewChat() {
        if (!this.isWalletConnected) {
            alert('Please connect your wallet to start a new chat.');
            return;
        }

        this.currentChatId = null;
        this.chatHistory = [];
        this.clearChatMessages();
        this.showChatInterface();
        
        // Remove active class from all chat items
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Show suggested messages for new chat
        this.showSuggestedMessages();
    }

    generateChatId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;

        // Check if wallet is connected for persistent chats
        if (!this.isWalletConnected) {
            alert('Please connect your wallet to start chatting.');
            return;
        }

        // Check rate limit
        const now = Date.now();
        if (this.isRateLimited || (now - this.lastMessageTime < this.rateLimitDuration)) {
            this.showRateLimitAlert();
            return;
        }

        // Set rate limit
        this.lastMessageTime = now;
        this.isRateLimited = true;
        this.startRateLimitTimer();

        // Clear input and disable it
        input.value = '';
        input.disabled = true;
        document.getElementById('sendButton').disabled = true;
        this.autoResizeTextarea({ target: input });

        // Add user message to chat
        this.addMessageToChat('user', message);

        // Show thinking indicator
        this.showThinkingIndicator();

        try {
            // Use persistent chat endpoint
            const response = await fetch('/api/chat/persistent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    chatId: this.currentChatId,
                    walletAddress: this.walletAddress,
                    isNewChat: !this.currentChatId
                })
            });

            const data = await response.json();

            // Remove thinking indicator
            this.hideThinkingIndicator();

            if (data.success) {
                // Update current chat ID if this was a new chat
                if (!this.currentChatId) {
                    this.currentChatId = data.chatId;
                    this.updateChatTitle(message);
                }

                // Add AI response to chat with metadata
                this.addAIResponseToChat(data.response, data.metadata);
                
                // Refresh chat history in sidebar
                this.loadChatHistory();
            } else {
                this.addMessageToChat('assistant', 'I encountered an error processing your request. Please try again.');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideThinkingIndicator();
            this.addMessageToChat('assistant', 'I\'m having trouble connecting to my systems. Please check your connection and try again.');
        }
    }

    startRateLimitTimer() {
        const rateLimitCounter = document.getElementById('rateLimitCounter');
        const rateLimitText = document.getElementById('rateLimitText');
        const countdownTimer = document.getElementById('countdownTimer');
        
        // Show the timer with fade-in from bottom animation
        rateLimitCounter.classList.remove('hidden');
        rateLimitCounter.classList.add('timer-fade-in');
        
        let timeLeft = 20000; // 20 seconds in milliseconds
        let startTime = Date.now();
        
        const timer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            timeLeft = Math.max(0, 20000 - elapsed);
            
            this.updateCountdownDisplay(timeLeft);
            this.updateTimerColor(timeLeft);
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                this.isRateLimited = false;
                
                // Re-enable input
                const input = document.getElementById('chatInput');
                const sendButton = document.getElementById('sendButton');
                input.disabled = false;
                sendButton.disabled = false;
                
                // Fade out timer
                rateLimitCounter.classList.add('timer-fade-out');
                setTimeout(() => {
                    if (!this.isRateLimited) {
                        rateLimitCounter.classList.add('hidden');
                        rateLimitCounter.classList.remove('timer-fade-in', 'timer-fade-out', 'timer-red', 'timer-orange', 'timer-green');
                    }
                }, 500);
            }
        }, 50); // Update every 50ms for smooth millisecond display
    }

    updateCountdownDisplay(timeLeft) {
        const rateLimitText = document.getElementById('rateLimitText');
        const countdownTimer = document.getElementById('countdownTimer');
        
        if (timeLeft > 0) {
            const seconds = Math.floor(timeLeft / 1000);
            const milliseconds = Math.floor((timeLeft % 1000) / 10); // Get centiseconds (2 digits)
            const formattedTime = `${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
            
            rateLimitText.textContent = `Next message in:`;
            countdownTimer.textContent = formattedTime;
        } else {
            rateLimitText.textContent = 'Ready to send';
            countdownTimer.textContent = '00:00';
        }
    }

    updateTimerColor(timeLeft) {
        const rateLimitCounter = document.getElementById('rateLimitCounter');
        const totalTime = 20000; // 20 seconds
        const progress = timeLeft / totalTime;
        
        // Remove existing color classes
        rateLimitCounter.classList.remove('timer-red', 'timer-orange', 'timer-green');
        
        // Inverted color phases - closer to 0 turns green
        if (progress > 0.6) {
            // Red phase (20s to 12s) - start of countdown
            rateLimitCounter.classList.add('timer-red');
        } else if (progress > 0.3) {
            // Orange phase (12s to 6s) - middle of countdown
            rateLimitCounter.classList.add('timer-orange');
        } else {
            // Green phase (6s to 0s) - approaching ready state
            rateLimitCounter.classList.add('timer-green');
        }
    }

    pulseTimer() {
        const rateLimitCounter = document.getElementById('rateLimitCounter');
        if (rateLimitCounter && !rateLimitCounter.classList.contains('hidden')) {
            rateLimitCounter.classList.add('timer-pulse');
            setTimeout(() => {
                rateLimitCounter.classList.remove('timer-pulse');
            }, 300);
        }
    }

    showRateLimitAlert() {
        const rateLimitCounter = document.getElementById('rateLimitCounter');
        rateLimitCounter.classList.remove('hidden');
        rateLimitCounter.classList.add('error');
        
        // Shake animation
        rateLimitCounter.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            rateLimitCounter.style.animation = '';
        }, 500);
    }

    addMessageToChat(role, content) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message message-enter`;

        if (role === 'user') {
            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="user-avatar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="8" r="3" stroke="currentColor" stroke-width="2"/>
                            <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </div>
                    <div class="message-text">
                        <p>${this.escapeHtml(content)}</p>
                    </div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="ai-avatar"></div>
                    <div class="message-text">
                        ${this.formatMessage(content)}
                    </div>
                </div>
            `;
        }

        chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addAIResponseToChat(content, metadata) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message message-enter';

        // Create initial message structure
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="ai-avatar"></div>
                <div class="message-text">
                    <div class="typing-content"></div>
                </div>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Start typing animation
        this.typeMessage(messageDiv, content, metadata);
    }

    async typeMessage(messageDiv, content, metadata) {
        const typingContent = messageDiv.querySelector('.typing-content');
        const formattedContent = this.formatMessage(content);
        
        // Instantly display the main content with sleek animation
        typingContent.innerHTML = formattedContent;
        typingContent.style.opacity = '0';
        typingContent.style.transform = 'translateY(10px)';
        
        // Animate in the content
        setTimeout(() => {
            typingContent.style.transition = 'all 0.3s ease-out';
            typingContent.style.opacity = '1';
            typingContent.style.transform = 'translateY(0)';
        }, 50);

        // Add enhanced content after a brief delay
        setTimeout(() => {
            let enhancedContent = '';

            // Add trading signal widget if trading data is present
            if (metadata && metadata.tradingData) {
                enhancedContent += this.createTradingSignalWidget(metadata.tradingData);
            }

            // Add TradingView chart if requested
            if (metadata && metadata.hasChart && metadata.cryptoSymbols && metadata.cryptoSymbols.length > 0) {
                enhancedContent += this.createTradingViewChart(metadata.cryptoSymbols[0]);
            }

            // Add source tags
            if (metadata && metadata.links && metadata.links.length > 0) {
                enhancedContent += this.createSourceTags(metadata.links);
            }

            if (enhancedContent) {
                const enhancedDiv = document.createElement('div');
                enhancedDiv.innerHTML = enhancedContent;
                enhancedDiv.style.opacity = '0';
                enhancedDiv.style.transform = 'translateY(10px)';
                typingContent.appendChild(enhancedDiv);
                
                // Animate in the enhanced content
                setTimeout(() => {
                    enhancedDiv.style.transition = 'all 0.3s ease-out';
                    enhancedDiv.style.opacity = '1';
                    enhancedDiv.style.transform = 'translateY(0)';
                }, 50);
            }

            // Load TradingView charts after DOM insertion
            if (metadata && metadata.hasChart && metadata.cryptoSymbols && metadata.cryptoSymbols.length > 0) {
                this.loadTradingViewChart(metadata.cryptoSymbols[0]);
            }

            this.scrollToBottom();
        }, 200);

        this.scrollToBottom();
    }

    createCryptoPriceWidgets(symbols) {
        return symbols.map(symbol => `
            <div class="crypto-price-widget" data-symbol="${symbol}">
                <div class="crypto-info">
                    <div class="crypto-symbol">${symbol}</div>
                    <div class="crypto-name">${this.getCryptoName(symbol)}</div>
                </div>
                <div class="crypto-price">
                    <div class="price-value">Loading...</div>
                    <div class="price-change">--</div>
                </div>
            </div>
        `).join('');
    }

    createTradingSignalWidget(tradingData) {
        const direction = tradingData.direction || 'neutral';
        const isLong = direction === 'long';
        const isShort = direction === 'short';
        const borderColor = isLong ? '#00ff88' : isShort ? '#ff4444' : '#6b7280';
        const textColor = isLong ? '#00ff88' : isShort ? '#ff4444' : '#6b7280';
        const titleBorderColor = isLong ? 'rgba(0, 255, 136, 0.3)' : isShort ? 'rgba(255, 68, 68, 0.3)' : 'rgba(107, 114, 128, 0.3)';
        const titleShadowColor = isLong ? 'rgba(0, 255, 136, 0.3)' : isShort ? 'rgba(255, 68, 68, 0.3)' : 'rgba(107, 114, 128, 0.3)';
        
        return `
            <div class="trading-signal" style="border-color: ${borderColor};">
                <div class="signal-header">
                    <h4 class="perpology-signal-title signal-${direction}" style="color: ${textColor}; border-color: ${titleBorderColor}; text-shadow: 0 0 10px ${titleShadowColor};">Perpology Signal</h4>
                    <span class="signal-direction ${direction}" style="color: ${textColor}; border-color: ${borderColor};">
                        ${direction.toUpperCase()}
                    </span>
                </div>
                <div class="signal-details">
                    ${tradingData.entry ? `<div class="signal-item"><strong>Entry:</strong> $${tradingData.entry.toLocaleString()}</div>` : ''}
                    ${tradingData.stopLoss ? `<div class="signal-item"><strong style="color: ${textColor};">Stop Loss:</strong> <span style="color: ${textColor};">$${tradingData.stopLoss.toLocaleString()}</span></div>` : ''}
                    ${tradingData.takeProfit ? `<div class="signal-item"><strong>Take Profit:</strong> $${tradingData.takeProfit.toLocaleString()}</div>` : ''}
                </div>
            </div>
        `;
    }

    createTradingViewChart(symbol) {
        const chartId = `tradingview_${Date.now()}`;
        return `
            <div class="chart-container">
                <div id="${chartId}" style="height: 400px; width: 100%;"></div>
            </div>
        `;
    }

    createLinkPreviews(links) {
        return links.map(link => `
            <div class="link-preview" onclick="window.open('${link}', '_blank')">
                <div class="link-preview-content">
                    <div class="link-title">External Link</div>
                    <div class="link-url">${link}</div>
                </div>
                <div class="link-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="2"/>
                        <polyline points="15,3 21,3 21,9" stroke="currentColor" stroke-width="2"/>
                        <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
            </div>
        `).join('');
    }

    createSourceTags(links) {
        if (!links || links.length === 0) return '';
        
        const sourceTags = links.map((link, index) => {
            const domain = this.extractDomain(link);
            return `
                <a href="${link}" target="_blank" class="source-tag">
                    <div class="source-tag-icon"></div>
                    ${domain || `Source ${index + 1}`}
                </a>
            `;
        }).join('');

        return `
            <div class="source-tags">
                ${sourceTags}
            </div>
        `;
    }

    extractDomain(url) {
        try {
            const domain = new URL(url).hostname;
            return domain.replace('www.', '');
        } catch {
            return 'External Link';
        }
    }

    async loadTradingViewChart(symbol) {
        // Fetch TradingView data from backend
        try {
            const response = await fetch(`/api/tradingview/${symbol}`);
            const data = await response.json();
            
            if (data.success && data.data.embedUrl) {
                const chartContainers = document.querySelectorAll('.chart-container div[id^="tradingview_"]');
                const chartId = chartContainers[chartContainers.length - 1]?.id; // Get the most recent chart container
                
                if (chartId) {
                    const iframe = document.createElement('iframe');
                    iframe.src = data.data.embedUrl;
                    iframe.style.width = '100%';
                    iframe.style.height = '400px';
                    iframe.style.border = 'none';
                    iframe.style.borderRadius = '12px';
                    
                    const container = document.getElementById(chartId);
                    container.innerHTML = ''; // Clear any existing content
                    container.appendChild(iframe);
                }
            }
        } catch (error) {
            console.error('Error loading TradingView chart:', error);
            // Fallback: show a message in the chart container
            const chartContainers = document.querySelectorAll('.chart-container div[id^="tradingview_"]');
            const chartId = chartContainers[chartContainers.length - 1]?.id;
            if (chartId) {
                const container = document.getElementById(chartId);
                container.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: var(--text-secondary); font-size: 14px;">
                        <div style="text-align: center;">
                            <div style="margin-bottom: 8px;">📊</div>
                            <div>TradingView chart for ${symbol}</div>
                            <div style="font-size: 12px; opacity: 0.7;">Chart loading temporarily unavailable</div>
                        </div>
                    </div>
                `;
            }
        }
    }

    getCryptoName(symbol) {
        const names = {
            'BTC': 'Bitcoin',
            'ETH': 'Ethereum',
            'SOL': 'Solana',
            'ADA': 'Cardano',
            'DOT': 'Polkadot',
            'LINK': 'Chainlink',
            'UNI': 'Uniswap',
            'AAVE': 'Aave',
            'MATIC': 'Polygon',
            'AVAX': 'Avalanche'
        };
        return names[symbol] || symbol;
    }

    formatMessage(content) {
        // Enhanced markdown-like formatting
        let formatted = this.escapeHtml(content);
        
        // Bold text
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic text
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Code blocks
        formatted = formatted.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
        
        // Inline code
        formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        // Highlight crypto symbols
        formatted = formatted.replace(/\b(BTC|ETH|SOL|ADA|DOT|LINK|UNI|AAVE|MATIC|AVAX|ATOM|NEAR|FTM|ALGO|XRP|LTC|DOGE)\b/g, '<span class="crypto-highlight">$1</span>');
        
        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showThinkingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message assistant-message thinking-indicator';
        thinkingDiv.id = 'thinkingIndicator';
        thinkingDiv.innerHTML = `
            <div class="message-content">
                <div class="ai-avatar thinking-animation"></div>
                <div class="thinking-text">
                    <div class="thinking-message">Analyzing market data...</div>
                    <div class="thinking-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;
        chatMessages.appendChild(thinkingDiv);
        this.scrollToBottom();
        this.isThinking = true;

        // Cycle through thinking messages
        this.cycleThinkingMessages();
    }

    cycleThinkingMessages() {
        // Generate contextual thinking messages based on user input
        const lastUserMessage = this.chatHistory[this.chatHistory.length - 1]?.content.toLowerCase() || '';
        
        let messages = [];
        
        if (lastUserMessage.includes('news') || lastUserMessage.includes('update')) {
            messages = [
                'Searching latest crypto news...',
                'Analyzing market sentiment...',
                'Gathering recent developments...',
                'Processing news sources...',
                'Compiling market updates...'
            ];
        } else if (lastUserMessage.includes('price') || lastUserMessage.includes('chart')) {
            messages = [
                'Fetching live price data...',
                'Analyzing price movements...',
                'Processing market data...',
                'Calculating price metrics...',
                'Generating price analysis...'
            ];
        } else if (lastUserMessage.includes('trade') || lastUserMessage.includes('strategy')) {
            messages = [
                'Analyzing trading opportunities...',
                'Calculating risk metrics...',
                'Evaluating market conditions...',
                'Processing technical indicators...',
                'Generating trading insights...'
            ];
        } else if (lastUserMessage.includes('technical') || lastUserMessage.includes('analysis')) {
            messages = [
                'Calculating technical indicators...',
                'Analyzing chart patterns...',
                'Processing price action...',
                'Evaluating support/resistance...',
                'Generating technical analysis...'
            ];
        } else {
            messages = [
                'Processing your request...',
                'Analyzing market context...',
                'Gathering relevant data...',
                'Generating insights...',
                'Preparing response...'
            ];
        }
        
        let index = 0;
        const thinkingInterval = setInterval(() => {
            const thinkingMessage = document.querySelector('.thinking-message');
            if (thinkingMessage && this.isThinking) {
                thinkingMessage.textContent = messages[index];
                index = (index + 1) % messages.length;
            } else {
                clearInterval(thinkingInterval);
            }
        }, 1500);
    }

    hideThinkingIndicator() {
        const thinkingIndicator = document.getElementById('thinkingIndicator');
        if (thinkingIndicator) {
            thinkingIndicator.remove();
        }
        this.isThinking = false;
    }

    clearChatMessages() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="message-content">
                    <h3>Ready when you are.</h3>
                    <p>Ask me anything about crypto markets, trading strategies, or perpetual futures.</p>
                </div>
            </div>
        `;
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    autoResizeTextarea(event) {
        const textarea = event.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    addChatToHistory(chatId) {
        const chatHistory = document.getElementById('chatHistory');
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item active';
        chatItem.innerHTML = `
            <div class="chat-title">New Chat</div>
            <div class="chat-time">${new Date().toLocaleTimeString()}</div>
        `;
        chatHistory.insertBefore(chatItem, chatHistory.firstChild);
    }

    async loadChatHistory() {
        if (!this.isWalletConnected) {
            return;
        }

        try {
            const response = await fetch(`/api/chats/${this.walletAddress}`);
            const data = await response.json();

            if (data.success) {
                this.chats = data.chats;
                this.renderChatHistory();
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    renderChatHistory() {
        const chatHistory = document.getElementById('chatHistory');
        chatHistory.innerHTML = '';

        if (this.chats.length === 0) {
            chatHistory.innerHTML = `
                <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;">
                    No chat history yet.<br>Start a new conversation!
                </div>
            `;
            return;
        }

        this.chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${chat.id === this.currentChatId ? 'active' : ''}`;
            chatItem.dataset.chatId = chat.id;
            
            const createdDate = new Date(chat.created_at);
            const timeString = createdDate.toLocaleDateString() === new Date().toLocaleDateString() 
                ? createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : createdDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

            chatItem.innerHTML = `
                <div class="chat-item-content">
                    <div class="chat-title">${this.escapeHtml(chat.title)}</div>
                    <div class="chat-preview">${timeString}</div>
                </div>
                <button class="delete-chat-btn" data-chat-id="${chat.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            `;

            // Add click event to load chat
            chatItem.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-chat-btn')) {
                    this.loadChat(chat.id);
                }
            });

            // Add delete event
            const deleteBtn = chatItem.querySelector('.delete-chat-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showDeleteConfirmation(chat.id, chat.title);
            });

            chatHistory.appendChild(chatItem);
        });
    }

    async loadChat(chatId) {
        try {
            const response = await fetch(`/api/chats/${this.walletAddress}/${chatId}`);
            const data = await response.json();

            if (data.success) {
                this.currentChatId = chatId;
                this.chatHistory = data.chat.messages || [];
                this.renderChatMessages(data.chat.messages);
                this.showChatInterface();
                
                // Update active chat in sidebar
                document.querySelectorAll('.chat-item').forEach(item => {
                    item.classList.remove('active');
                });
                document.querySelector(`[data-chat-id="${chatId}"]`)?.classList.add('active');
            }
        } catch (error) {
            console.error('Error loading chat:', error);
            alert('Failed to load chat. Please try again.');
        }
    }

    renderChatMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';

        if (!messages || messages.length === 0) {
            this.clearChatMessages();
            return;
        }

        messages.forEach(message => {
            this.addMessageToChat(message.role, message.content);
        });

        this.scrollToBottom();
    }

    async showDeleteConfirmation(chatId, chatTitle) {
        const confirmed = confirm(`Are you sure you want to delete "${chatTitle}"?\n\nThis action cannot be undone.`);
        
        if (confirmed) {
            await this.deleteChat(chatId);
        }
    }

    async deleteChat(chatId) {
        try {
            const response = await fetch(`/api/chats/${this.walletAddress}/${chatId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                // If we're deleting the current chat, start a new one
                if (this.currentChatId === chatId) {
                    this.startNewChat();
                }
                
                // Refresh chat history
                this.loadChatHistory();
            } else {
                alert('Failed to delete chat. Please try again.');
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert('Failed to delete chat. Please try again.');
        }
    }

    updateChatTitle(firstMessage) {
        // This will be called when a new chat gets its first message
        // The title is automatically generated on the backend
    }

    async connectWallet() {
        try {
            if (typeof window.solana !== 'undefined' && window.solana.isPhantom) {
                const response = await window.solana.connect();
                this.walletAddress = response.publicKey.toString();
                this.isWalletConnected = true;
                this.updateWalletUI();
                
                // Load chat history immediately after wallet connection
                await this.loadChatHistory();
                
                this.showChatInterface();
            } else {
                alert('Phantom wallet not found. Please install Phantom wallet extension.');
                window.open('https://phantom.app/', '_blank');
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            alert('Failed to connect wallet. Please try again.');
        }
    }

    disconnectWallet() {
        this.isWalletConnected = false;
        this.walletAddress = null;
        this.updateWalletUI();
        this.showLandingPage();
    }

    updateWalletUI() {
        const connectBtn = document.getElementById('connectWalletBtn');
        const walletInfo = document.getElementById('walletInfo');
        const walletAddress = document.getElementById('walletAddress');

        if (this.isWalletConnected) {
            connectBtn.classList.add('hidden');
            walletInfo.classList.remove('hidden');
            walletAddress.textContent = this.walletAddress.slice(0, 8) + '...' + this.walletAddress.slice(-8);
        } else {
            connectBtn.classList.remove('hidden');
            walletInfo.classList.add('hidden');
        }
    }

    setupSuggestedMessages() {
        // Add click event listeners to suggested messages
        const suggestedMessages = document.querySelectorAll('.suggested-message');
        suggestedMessages.forEach(messageElement => {
            messageElement.addEventListener('click', () => {
                const message = messageElement.getAttribute('data-message');
                const chatInput = document.getElementById('chatInput');
                chatInput.value = message;
                this.hideSuggestedMessages();
                // Auto-send the message
                this.sendMessage();
            });
        });
    }

    hideSuggestedMessages() {
        const suggestedMessages = document.getElementById('suggestedMessages');
        if (suggestedMessages && !suggestedMessages.classList.contains('hidden')) {
            suggestedMessages.classList.add('hidden');
        }
    }

    showSuggestedMessages() {
        const suggestedMessages = document.getElementById('suggestedMessages');
        if (suggestedMessages && suggestedMessages.classList.contains('hidden')) {
            suggestedMessages.classList.remove('hidden');
        }
    }

    async checkWalletConnection() {
        // Check if wallet was previously connected
        if (typeof window.solana !== 'undefined' && window.solana.isPhantom && window.solana.isConnected) {
            this.walletAddress = window.solana.publicKey.toString();
            this.isWalletConnected = true;
            this.updateWalletUI();
            
            // Load chat history for the connected wallet
            await this.loadChatHistory();
            
            // If there are existing chats, show the chat interface
            if (this.chats && this.chats.length > 0) {
                this.showChatInterface();
            }
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PerpologyApp();
});

// Add global styles for enhanced UI
const globalStyles = `
    .crypto-highlight {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: bold;
    }
    
    .quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
    }
    
    .quick-action-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        cursor: pointer;
        transition: transform 0.2s ease;
    }
    
    .quick-action-btn:hover {
        transform: translateY(-2px);
    }
    
    .thinking-dots {
        display: flex;
        gap: 4px;
        margin-top: 8px;
    }
    
    .thinking-dots span {
        width: 6px;
        height: 6px;
        background: #667eea;
        border-radius: 50%;
        animation: thinkingDot 1.4s ease-in-out infinite both;
    }
    
    .thinking-dots span:nth-child(1) { animation-delay: -0.32s; }
    .thinking-dots span:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes thinkingDot {
        0%, 80%, 100% {
            transform: scale(0);
        }
        40% {
            transform: scale(1);
        }
    }
`;

// Inject global styles
const styleSheet = document.createElement('style');
styleSheet.textContent = globalStyles;
document.head.appendChild(styleSheet);
