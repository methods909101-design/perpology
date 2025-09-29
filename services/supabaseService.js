const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
    }

    // Create a new chat session
    async createChat(walletAddress, title = 'New Chat') {
        try {
            const { data, error } = await this.supabase
                .from('chats')
                .insert([
                    {
                        wallet_address: walletAddress,
                        title: title,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
                .select()
                .single();

            if (error) throw error;
            return { success: true, chat: data };
        } catch (error) {
            console.error('Error creating chat:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all chats for a wallet address
    async getChats(walletAddress) {
        try {
            const { data, error } = await this.supabase
                .from('chats')
                .select('*')
                .eq('wallet_address', walletAddress)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            return { success: true, chats: data };
        } catch (error) {
            console.error('Error fetching chats:', error);
            return { success: false, error: error.message };
        }
    }

    // Get a specific chat with its messages
    async getChat(chatId, walletAddress) {
        try {
            // First verify the chat belongs to the wallet
            const { data: chat, error: chatError } = await this.supabase
                .from('chats')
                .select('*')
                .eq('id', chatId)
                .eq('wallet_address', walletAddress)
                .single();

            if (chatError) throw chatError;

            // Get messages for this chat
            const { data: messages, error: messagesError } = await this.supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true });

            if (messagesError) throw messagesError;

            return { 
                success: true, 
                chat: {
                    ...chat,
                    messages: messages || []
                }
            };
        } catch (error) {
            console.error('Error fetching chat:', error);
            return { success: false, error: error.message };
        }
    }

    // Add a message to a chat
    async addMessage(chatId, walletAddress, role, content, metadata = null) {
        try {
            // First verify the chat belongs to the wallet
            const { data: chat, error: chatError } = await this.supabase
                .from('chats')
                .select('id')
                .eq('id', chatId)
                .eq('wallet_address', walletAddress)
                .single();

            if (chatError) throw chatError;

            // Add the message
            const { data, error } = await this.supabase
                .from('messages')
                .insert([
                    {
                        chat_id: chatId,
                        role: role, // 'user' or 'assistant'
                        content: content,
                        metadata: metadata,
                        created_at: new Date().toISOString()
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            // Update chat's updated_at timestamp
            await this.supabase
                .from('chats')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', chatId);

            return { success: true, message: data };
        } catch (error) {
            console.error('Error adding message:', error);
            return { success: false, error: error.message };
        }
    }

    // Update chat title
    async updateChatTitle(chatId, walletAddress, title) {
        try {
            const { data, error } = await this.supabase
                .from('chats')
                .update({ 
                    title: title,
                    updated_at: new Date().toISOString()
                })
                .eq('id', chatId)
                .eq('wallet_address', walletAddress)
                .select()
                .single();

            if (error) throw error;
            return { success: true, chat: data };
        } catch (error) {
            console.error('Error updating chat title:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete a chat and all its messages
    async deleteChat(chatId, walletAddress) {
        try {
            // First verify the chat belongs to the wallet
            const { data: chat, error: chatError } = await this.supabase
                .from('chats')
                .select('id')
                .eq('id', chatId)
                .eq('wallet_address', walletAddress)
                .single();

            if (chatError) throw chatError;

            // Delete all messages first (due to foreign key constraint)
            const { error: messagesError } = await this.supabase
                .from('messages')
                .delete()
                .eq('chat_id', chatId);

            if (messagesError) throw messagesError;

            // Delete the chat
            const { error: deleteChatError } = await this.supabase
                .from('chats')
                .delete()
                .eq('id', chatId)
                .eq('wallet_address', walletAddress);

            if (deleteChatError) throw deleteChatError;

            return { success: true };
        } catch (error) {
            console.error('Error deleting chat:', error);
            return { success: false, error: error.message };
        }
    }

    // Generate a chat title from the first message
    generateChatTitle(firstMessage) {
        if (!firstMessage) return 'New Chat';
        
        // Take first 50 characters and add ellipsis if longer
        const title = firstMessage.length > 50 
            ? firstMessage.substring(0, 50) + '...'
            : firstMessage;
        
        return title;
    }
}

module.exports = new SupabaseService();
