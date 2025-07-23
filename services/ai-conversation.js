// Play.ht removed - now using HumeAI EVI

class AIConversationService {
    constructor() {
        this.activeConversations = new Map();
        this.conversationHistory = new Map();
        
        // Default conversation settings
        this.defaultSettings = {
            greeting: "Hello! I'm your AI voice assistant. How can I help you today?",
            fallback: "I'm sorry, I didn't understand that. Could you please repeat?",
            goodbye: "Thank you for calling! Have a great day!",
            maxConversationLength: 10, // Maximum number of exchanges
            responseTimeout: 30000, // 30 seconds
            silenceTimeout: 5000 // 5 seconds
        };
    }

    /**
     * Start a new conversation for a call
     * @param {string} callSid - Twilio call SID
     * @param {string} streamSid - Twilio stream SID
     * @param {Object} options - Conversation options
     */
    async startConversation(callSid, streamSid, options = {}) {
        const conversationId = `${callSid}_${streamSid}`;
        
        try {
            // Create Play.ht streaming connection
            const playHTStream = await playHTService.createStreamingConnection({
                output_format: 'mulaw',
                sample_rate: 8000,
                speed: 1.0,
                emotion: 'friendly'
            });

            const conversation = {
                id: conversationId,
                callSid: callSid,
                streamSid: streamSid,
                playHTStreamId: playHTStream.streamId,
                status: 'active',
                startTime: new Date(),
                messageCount: 0,
                lastActivity: new Date(),
                settings: { ...this.defaultSettings, ...options },
                context: {
                    userName: null,
                    topic: null,
                    intent: null,
                    sentiment: 'neutral'
                }
            };

            this.activeConversations.set(conversationId, conversation);
            this.conversationHistory.set(conversationId, []);

            console.log(`🤖 AI Conversation started: ${conversationId}`);

            // Send initial greeting
            await this.sendResponse(conversationId, conversation.settings.greeting);

            return conversation;

        } catch (error) {
            console.error('❌ Failed to start conversation:', error);
            throw error;
        }
    }

    /**
     * Process incoming audio/text from caller
     * @param {string} conversationId - Conversation ID
     * @param {string} userInput - User's message (from speech-to-text)
     */
    async processUserInput(conversationId, userInput) {
        const conversation = this.activeConversations.get(conversationId);
        
        if (!conversation || conversation.status !== 'active') {
            console.warn(`⚠️ Conversation ${conversationId} not active`);
            return;
        }

        try {
            // Update conversation activity
            conversation.lastActivity = new Date();
            conversation.messageCount++;

            // Add user message to history
            const history = this.conversationHistory.get(conversationId) || [];
            history.push({
                type: 'user',
                message: userInput,
                timestamp: new Date()
            });

            console.log(`👤 User input: "${userInput}"`);

            // Process with AI logic
            const aiResponse = await this.generateAIResponse(conversationId, userInput, history);

            // Send AI response
            await this.sendResponse(conversationId, aiResponse);

            // Add AI response to history
            history.push({
                type: 'assistant',
                message: aiResponse,
                timestamp: new Date()
            });

            this.conversationHistory.set(conversationId, history);

            // Check if conversation should end
            if (conversation.messageCount >= conversation.settings.maxConversationLength) {
                await this.endConversation(conversationId, 'max_length_reached');
            }

        } catch (error) {
            console.error('❌ Error processing user input:', error);
            await this.sendResponse(conversationId, conversation.settings.fallback);
        }
    }

    /**
     * Generate AI response based on user input and context
     * @param {string} conversationId - Conversation ID
     * @param {string} userInput - User's message
     * @param {Array} history - Conversation history
     */
    async generateAIResponse(conversationId, userInput, history) {
        const conversation = this.activeConversations.get(conversationId);
        
        // Simple rule-based AI for POC (can be replaced with OpenAI/Claude later)
        const input = userInput.toLowerCase().trim();
        
        // Greeting patterns
        if (input.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
            return "Hello! It's great to hear from you. What can I help you with today?";
        }
        
        // Question patterns
        if (input.match(/\?(.*)|what|how|when|where|why|who/)) {
            return "That's a great question! I'd be happy to help you with that. Could you provide a bit more detail?";
        }
        
        // Goodbye patterns
        if (input.match(/^(bye|goodbye|thanks|thank you|see you|have a good)/)) {
            await this.endConversation(conversationId, 'user_goodbye');
            return "Thank you for calling! It was great talking with you. Have a wonderful day!";
        }
        
        // Numbers or DTMF
        if (input.match(/^[0-9*#]+$/)) {
            return `I heard you press ${input}. Is there something specific you'd like me to help you with?`;
        }
        
        // Default responses based on conversation context
        const responses = [
            "I understand. Could you tell me more about that?",
            "That sounds interesting. How can I assist you with that?",
            "I'm here to help. What would you like to know more about?",
            "Let me help you with that. Can you provide some more details?",
            "I see. Is there a specific way I can help you today?"
        ];
        
        // Pick a response based on message count to add variety
        const responseIndex = conversation.messageCount % responses.length;
        return responses[responseIndex];
    }

    /**
     * Send AI response via Play.ht TTS
     * @param {string} conversationId - Conversation ID
     * @param {string} response - AI response text
     */
    async sendResponse(conversationId, response) {
        const conversation = this.activeConversations.get(conversationId);
        
        if (!conversation || conversation.status !== 'active') {
            console.warn(`⚠️ Cannot send response to inactive conversation: ${conversationId}`);
            return;
        }

        try {
            console.log(`🤖 AI Response: "${response}"`);
            
            // Send text to Play.ht for TTS
            await playHTService.streamText(conversation.playHTStreamId, response);
            
            // The audio will be handled by the Play.ht service and forwarded to Twilio
            
        } catch (error) {
            console.error('❌ Failed to send AI response:', error);
            throw error;
        }
    }

    /**
     * Handle DTMF input during conversation
     * @param {string} conversationId - Conversation ID
     * @param {string} digit - DTMF digit
     */
    async handleDTMF(conversationId, digit) {
        const conversation = this.activeConversations.get(conversationId);
        
        if (!conversation || conversation.status !== 'active') {
            return;
        }

        console.log(`🔢 DTMF received in conversation: ${digit}`);
        
        // Handle special DTMF commands
        switch (digit) {
            case '*':
                await this.sendResponse(conversationId, "You pressed star. Would you like to speak to a human agent?");
                break;
            case '#':
                await this.endConversation(conversationId, 'user_hangup');
                break;
            case '0':
                await this.sendResponse(conversationId, "You pressed zero. Let me connect you to our support team.");
                break;
            default:
                await this.processUserInput(conversationId, `I pressed ${digit}`);
        }
    }

    /**
     * End conversation and cleanup
     * @param {string} conversationId - Conversation ID
     * @param {string} reason - Reason for ending
     */
    async endConversation(conversationId, reason) {
        const conversation = this.activeConversations.get(conversationId);
        
        if (!conversation) {
            return;
        }

        try {
            console.log(`🔚 Ending conversation: ${conversationId} - Reason: ${reason}`);
            
            // Send goodbye message if appropriate
            if (reason !== 'user_goodbye') {
                await this.sendResponse(conversationId, conversation.settings.goodbye);
            }
            
            // Close Play.ht stream
            playHTService.closeStream(conversation.playHTStreamId);
            
            // Update conversation status
            conversation.status = 'ended';
            conversation.endTime = new Date();
            conversation.endReason = reason;
            
            // Keep in map for a short time for cleanup, then remove
            setTimeout(() => {
                this.activeConversations.delete(conversationId);
                console.log(`🗑️ Conversation ${conversationId} cleaned up`);
            }, 30000); // 30 seconds
            
        } catch (error) {
            console.error('❌ Error ending conversation:', error);
        }
    }

    /**
     * Get conversation statistics
     */
    getConversationStats() {
        const active = Array.from(this.activeConversations.values());
        const activeCount = active.filter(c => c.status === 'active').length;
        
        return {
            totalActiveConversations: activeCount,
            totalConversations: this.activeConversations.size,
            conversations: active.map(conv => ({
                id: conv.id,
                callSid: conv.callSid,
                status: conv.status,
                startTime: conv.startTime,
                duration: new Date() - conv.startTime,
                messageCount: conv.messageCount,
                lastActivity: conv.lastActivity
            }))
        };
    }

    /**
     * Get conversation history
     * @param {string} conversationId - Conversation ID
     */
    getConversationHistory(conversationId) {
        return this.conversationHistory.get(conversationId) || [];
    }

    /**
     * Close all active conversations
     */
    closeAllConversations() {
        console.log(`🔚 Closing ${this.activeConversations.size} active conversations`);
        
        for (const [conversationId, conversation] of this.activeConversations) {
            this.endConversation(conversationId, 'system_shutdown');
        }
    }
}

module.exports = new AIConversationService(); 