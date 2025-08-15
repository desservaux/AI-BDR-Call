const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiAnalysisService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = 'gemini-2.0-flash-exp'; // Using the latest model
        this.genAI = null;
        this.initialized = false;
        
        // Environment-configurable batch rate limiting
        const parsedBatchSize = parseInt(process.env.GEMINI_BATCH_SIZE || '', 10);
        const parsedBatchInterval = parseInt(process.env.GEMINI_BATCH_INTERVAL_MS || '', 10);
        const batchSize = Number.isFinite(parsedBatchSize) && parsedBatchSize > 0 ? parsedBatchSize : 10;
        const batchIntervalMs = Number.isFinite(parsedBatchInterval) && parsedBatchInterval >= 1000 ? parsedBatchInterval : 60000;

        this.rateLimit = {
            maxBatchSize: batchSize,
            batchIntervalMs: batchIntervalMs,
            queue: [],
            processing: false
        };

        // Retry configuration
        const parsedMaxRetries = parseInt(process.env.GEMINI_MAX_RETRIES || '', 10);
        const parsedRetryBaseMs = parseInt(process.env.GEMINI_RETRY_BASE_MS || '', 10);
        this.retryConfig = {
            maxRetries: Number.isFinite(parsedMaxRetries) && parsedMaxRetries >= 0 ? parsedMaxRetries : 3,
            baseDelayMs: Number.isFinite(parsedRetryBaseMs) && parsedRetryBaseMs >= 100 ? parsedRetryBaseMs : 1000
        };

        // Metrics
        this.metrics = {
            processedCount: 0,
            failedCount: 0,
            retryCount: 0,
            lastBatchAt: null,
            lastErrorCode: null,
            lastErrorAt: null
        };
    }

    /**
     * Initialize the Gemini service
     * @returns {Promise<boolean>} True if initialization is successful
     */
    async initialize() {
        try {
            if (!this.apiKey) {
                throw new Error('GEMINI_API_KEY environment variable is required');
            }

            this.genAI = new GoogleGenerativeAI(this.apiKey);
            
            // Test the connection by making a simple request
            const model = this.genAI.getGenerativeModel({ model: this.model });
            const result = await model.generateContent('Hello');
            await result.response;
            
            console.log(`✅ Gemini service initialized successfully with model: ${this.model}`);
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Gemini service:', error.message);
            return false;
        }
    }

    // Removed checkRateLimit; batching enforces limits

    /**
     * Get current rate limit status
     * @returns {Object} Rate limit information
     */
    getRateLimitStatus() {
        return {
            maxBatchSize: this.rateLimit.maxBatchSize,
            batchIntervalMs: this.rateLimit.batchIntervalMs,
            batchIntervalSeconds: Math.ceil(this.rateLimit.batchIntervalMs / 1000),
            queueLength: this.rateLimit.queue.length,
            isProcessing: this.rateLimit.processing,
            processedCount: this.metrics.processedCount,
            failedCount: this.metrics.failedCount,
            retryCount: this.metrics.retryCount,
            lastBatchAt: this.metrics.lastBatchAt,
            lastErrorCode: this.metrics.lastErrorCode,
            lastErrorAt: this.metrics.lastErrorAt
        };
    }

    /**
     * Process the rate limit queue
     */
    async processQueue() {
        if (this.rateLimit.processing || this.rateLimit.queue.length === 0) {
            return;
        }
        
        this.rateLimit.processing = true;
        
        while (this.rateLimit.queue.length > 0) {
            // Process up to maxBatchSize requests each interval
            const batchSize = Math.min(this.rateLimit.maxBatchSize, this.rateLimit.queue.length);
            const batch = this.rateLimit.queue.splice(0, batchSize);
            
            console.log(`🚀 Processing batch of ${batchSize} Gemini requests...`);
            this.metrics.lastBatchAt = new Date().toISOString();
            
            // Process batch in parallel
            const promises = batch.map(async (item, index) => {
                try {
                    // Optional stagger 100–200ms per item within the batch
                    const staggerMs = 100 + Math.floor(Math.random() * 100);
                    await new Promise(r => setTimeout(r, staggerMs * index));

                    const result = await this._analyzeWithRetry(item.transcript, item.metadata);
                    item.resolve(result);
                    this.metrics.processedCount += 1;
                } catch (error) {
                    this.metrics.failedCount += 1;
                    this.metrics.lastErrorCode = error.code || error.status || error.name || 'UNKNOWN_ERROR';
                    this.metrics.lastErrorAt = new Date().toISOString();
                    item.reject(error);
                }
            });
            
            await Promise.all(promises);
            
            // If there are more items in queue, wait before next batch
            if (this.rateLimit.queue.length > 0) {
                console.log(`⏳ Waiting ${Math.ceil(this.rateLimit.batchIntervalMs / 1000)} seconds before next batch (${this.rateLimit.queue.length} remaining)...`);
                await new Promise(resolve => setTimeout(resolve, this.rateLimit.batchIntervalMs));
            }
        }
        
        this.rateLimit.processing = false;
    }

    /**
     * Analyze with retry/backoff for transient errors
     */
    async _analyzeWithRetry(transcript, metadata = {}) {
        let attempt = 0;
        let lastError;
        while (attempt <= this.retryConfig.maxRetries) {
            try {
                return await this._analyzeTranscriptInternal(transcript, metadata);
            } catch (error) {
                const retryable = this._isRetryableError(error);
                if (!retryable || attempt === this.retryConfig.maxRetries) {
                    throw error;
                }
                this.metrics.retryCount += 1;
                const delay = this._computeBackoffDelay(attempt);
                console.warn(`⏱️ Retry ${attempt + 1}/${this.retryConfig.maxRetries} after ${delay}ms due to: ${error.message}`);
                await new Promise(r => setTimeout(r, delay));
                attempt += 1;
                lastError = error;
            }
        }
        throw lastError || new Error('Analysis failed after retries');
    }

    _computeBackoffDelay(attempt) {
        const base = this.retryConfig.baseDelayMs;
        const cap = 30000; // hard cap 30s
        const expo = Math.min(base * Math.pow(2, attempt), cap);
        const jitter = Math.floor(Math.random() * Math.min(250, expo));
        return expo + jitter;
    }

    _isRetryableError(error) {
        const message = (error && error.message) || '';
        const code = (error && (error.code || error.status || error.name)) || '';
        const retryableCodes = ['429', '503', 'ECONNRESET', 'ETIMEDOUT', 'RESOURCE_EXHAUSTED'];
        if (retryableCodes.some(c => String(code).includes(c))) return true;
        const retryablePhrases = ['quota', 'exceeded', 'timeout', 'temporarily unavailable', 'rate limit'];
        return retryablePhrases.some(p => message.toLowerCase().includes(p));
    }

    /**
     * Analyze a call transcript for key insights (with rate limiting)
     * @param {string} transcript - The call transcript text
     * @param {Object} metadata - Additional call metadata
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeTranscript(transcript, metadata = {}) {
        if (!this.initialized) {
            throw new Error('Gemini service not initialized');
        }

        return new Promise((resolve, reject) => {
            // Add to queue
            this.rateLimit.queue.push({
                transcript,
                metadata,
                resolve,
                reject
            });
            
            // Start processing if not already processing
            this.processQueue();
        });
    }

    /**
     * Internal method to analyze transcript (without rate limiting)
     * @param {string} transcript - The call transcript text
     * @param {Object} metadata - Additional call metadata
     * @returns {Promise<Object>} Analysis results
     */
    async _analyzeTranscriptInternal(transcript, metadata = {}) {
        try {
            console.log(`🔍 Analyzing transcript (${transcript.length} characters)...`);
            
            const model = this.genAI.getGenerativeModel({ model: this.model });
            
            // Create the analysis prompt
            const prompt = this.createAnalysisPrompt(transcript, metadata);
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const analysisText = response.text();
            
            // Parse the analysis results
            const analysis = this.parseAnalysisResults(analysisText);
            
            console.log(`✅ Transcript analysis completed`);
            console.log(`📊 Results: meeting_booked=${analysis.meeting_booked}, interested=${analysis.person_interested}, upset=${analysis.person_very_upset}`);
            
            return {
                success: true,
                analysis: analysis,
                raw_response: analysisText,
                transcript_length: transcript.length
            };
        } catch (error) {
            console.error('❌ Error analyzing transcript:', error.message);
            throw new Error(`Failed to analyze transcript: ${error.message}`);
        }
    }

    /**
     * Create the analysis prompt for Gemini
     * @param {string} transcript - The call transcript
     * @param {Object} metadata - Call metadata
     * @returns {string} The formatted prompt
     */
    createAnalysisPrompt(transcript, metadata) {
        const callDuration = metadata.duration_seconds || 'unknown';
        const callSummary = metadata.call_summary_title || 'No summary available';
        
        return `Please analyze the following call transcript and provide insights in JSON format.

Call Information:
- Duration: ${callDuration} seconds
- Summary: ${callSummary}

Transcript:
${transcript}

Please analyze this transcript and return a JSON object with the following boolean fields:
- "meeting_booked": true if a meeting was scheduled/booked during the call, false otherwise
- "person_interested": true if the person showed interest in the product/service, false otherwise  
- "person_very_upset": true if the person was very upset or angry, false otherwise

Additional analysis fields:
- "confidence_score": number between 0-1 indicating confidence in the analysis
- "key_topics": array of main topics discussed
- "sentiment": overall sentiment (positive, negative, neutral)
- "action_items": array of any action items mentioned
- "notes": any additional relevant notes

Return ONLY valid JSON, no other text. Example format:
{
  "meeting_booked": false,
  "person_interested": true,
  "person_very_upset": false,
  "confidence_score": 0.85,
  "key_topics": ["product demo", "pricing"],
  "sentiment": "positive",
  "action_items": ["send follow-up email"],
  "notes": "Customer asked for pricing information"
}`;
    }

    /**
     * Parse the analysis results from Gemini response
     * @param {string} responseText - Raw response from Gemini
     * @returns {Object} Parsed analysis results
     */
    parseAnalysisResults(responseText) {
        try {
            // Extract JSON from the response (in case there's extra text)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            
            const analysis = JSON.parse(jsonMatch[0]);
            
            // Ensure all required fields are present with defaults
            return {
                meeting_booked: Boolean(analysis.meeting_booked),
                person_interested: Boolean(analysis.person_interested),
                person_very_upset: Boolean(analysis.person_very_upset),
                confidence_score: analysis.confidence_score || 0.5,
                key_topics: analysis.key_topics || [],
                sentiment: analysis.sentiment || 'neutral',
                action_items: analysis.action_items || [],
                notes: analysis.notes || ''
            };
        } catch (error) {
            console.error('❌ Error parsing analysis results:', error.message);
            console.error('Raw response:', responseText);
            
            // Return default analysis if parsing fails
            return {
                meeting_booked: false,
                person_interested: false,
                person_very_upset: false,
                confidence_score: 0.0,
                key_topics: [],
                sentiment: 'neutral',
                action_items: [],
                notes: 'Analysis failed - could not parse response'
            };
        }
    }

    /**
     * Analyze multiple transcripts in batch (with rate limiting)
     * @param {Array} transcripts - Array of transcript objects
     * @returns {Promise<Array>} Array of analysis results
     */
    async analyzeTranscriptsBatch(transcripts) {
        if (!this.initialized) {
            throw new Error('Gemini service not initialized');
        }

        if (!Array.isArray(transcripts) || transcripts.length === 0) {
            return [];
        }

        console.log(`🔍 Starting batch analysis of ${transcripts.length} transcripts with rate limiting...`);
        
        // Create promises for all transcripts (rate limiting is handled internally)
        const promises = transcripts.map(transcriptData => 
            this.analyzeTranscript(transcriptData.transcript, transcriptData.metadata)
                .then(analysis => ({
                    call_id: transcriptData.call_id,
                    conversation_id: transcriptData.conversation_id,
                    success: true,
                    analysis: analysis.analysis,
                    transcript_length: analysis.transcript_length
                }))
                .catch(error => {
                    console.error(`❌ Error analyzing transcript for call ${transcriptData.call_id}:`, error.message);
                    return {
                        call_id: transcriptData.call_id,
                        conversation_id: transcriptData.conversation_id,
                        success: false,
                        error: error.message
                    };
                })
        );
        
        // Wait for all analyses to complete (rate limiting is handled internally)
        const results = await Promise.all(promises);
        
        console.log(`✅ Batch analysis completed: ${results.filter(r => r.success).length}/${results.length} successful`);
        return results;
    }

    /**
     * Test the Gemini service
     * @returns {Promise<Object>} Test results
     */
    async testService() {
        try {
            console.log('🧪 Testing Gemini Analysis Service...');
            
            const initResult = await this.initialize();
            if (!initResult) {
                throw new Error('Service initialization failed');
            }

            // Test with a sample transcript
            const sampleTranscript = `
            Agent: Hi, this is Sarah calling from Coalesce. I'm reaching out to see if you'd be interested in learning about our data transformation platform.
            
            Customer: Oh, hi Sarah. I'm actually pretty busy right now.
            
            Agent: I understand you're busy. Our platform can save teams up to 80% of their time on data transformation tasks. Would you be interested in a quick 15-minute demo?
            
            Customer: That sounds interesting. When would you be available?
            
            Agent: I have availability tomorrow at 2 PM or Friday at 10 AM. Which works better for you?
            
            Customer: Tomorrow at 2 PM works for me.
            
            Agent: Perfect! I'll send you a calendar invite. What's your email address?
            
            Customer: john.doe@company.com
            
            Agent: Great! I'll send the invite right away. Looking forward to our demo tomorrow.
            `;

            const analysis = await this.analyzeTranscript(sampleTranscript, {
                duration_seconds: 180,
                call_summary_title: 'Demo Scheduling Call'
            });
            
            return {
                success: true,
                message: 'Gemini Analysis Service test successful',
                analysis: analysis.analysis,
                transcript_length: analysis.transcript_length
            };
        } catch (error) {
            console.error('❌ Gemini Analysis Service test failed:', error.message);
            return {
                success: false,
                message: `Test failed: ${error.message}`
            };
        }
    }
}

module.exports = new GeminiAnalysisService(); 