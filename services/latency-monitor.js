/**
 * Latency Monitor Service
 * 
 * Tracks and analyzes latency in the Twilio-HumeAI integration pipeline
 * to identify bottlenecks and optimize performance.
 */

const EventEmitter = require('events');

class LatencyMonitor extends EventEmitter {
    constructor() {
        super();
        this.activeSessions = new Map();
        this.latencyStats = {
            totalCalls: 0,
            averageInitialLatency: 0,
            averageResponseLatency: 0,
            latencyHistory: []
        };
    }

    /**
     * Start monitoring a call session
     * @param {string} callSid - Twilio Call SID
     * @param {string} phoneNumber - Phone number being called
     * @returns {Object} Session tracking object
     */
    startSession(callSid, phoneNumber) {
        const session = {
            callSid,
            phoneNumber,
            startTime: Date.now(),
            events: [],
            audioEvents: [],
            responseEvents: [],
            bottlenecks: []
        };

        this.activeSessions.set(callSid, session);
        
        console.log(`📊 [LATENCY] Started monitoring session: ${callSid}`);
        
        return session;
    }

    /**
     * Record an event with timing
     * @param {string} callSid - Call SID
     * @param {string} eventType - Type of event
     * @param {string} description - Event description
     * @param {Object} data - Additional event data
     */
    recordEvent(callSid, eventType, description, data = {}) {
        const session = this.activeSessions.get(callSid);
        if (!session) {
            console.warn(`⚠️ [LATENCY] No active session found for call: ${callSid}`);
            return;
        }

        const event = {
            timestamp: Date.now(),
            eventType,
            description,
            data,
            elapsedMs: session.startTime ? Date.now() - session.startTime : 0
        };

        session.events.push(event);
        
        console.log(`📊 [LATENCY] ${callSid} - ${eventType}: ${description} (${event.elapsedMs}ms)`);
        
        // Emit event for real-time monitoring
        this.emit('event', callSid, event);
    }

    /**
     * Record audio processing event
     * @param {string} callSid - Call SID
     * @param {string} audioEvent - Audio event type
     * @param {number} audioSize - Size of audio data in bytes
     * @param {number} processingTime - Processing time in ms
     */
    recordAudioEvent(callSid, audioEvent, audioSize, processingTime) {
        const session = this.activeSessions.get(callSid);
        if (!session) return;

        const event = {
            timestamp: Date.now(),
            audioEvent,
            audioSize,
            processingTime,
            elapsedMs: session.startTime ? Date.now() - session.startTime : 0
        };

        session.audioEvents.push(event);
        
        console.log(`🎵 [LATENCY] ${callSid} - Audio ${audioEvent}: ${processingTime}ms (${audioSize} bytes)`);
    }

    /**
     * Record response timing
     * @param {string} callSid - Call SID
     * @param {string} responseType - Type of response
     * @param {number} responseTime - Response time in ms
     * @param {number} responseSize - Size of response in bytes
     */
    recordResponse(callSid, responseType, responseTime, responseSize = 0) {
        const session = this.activeSessions.get(callSid);
        if (!session) return;

        const event = {
            timestamp: Date.now(),
            responseType,
            responseTime,
            responseSize,
            elapsedMs: session.startTime ? Date.now() - session.startTime : 0
        };

        session.responseEvents.push(event);
        
        console.log(`⚡ [LATENCY] ${callSid} - Response ${responseType}: ${responseTime}ms`);
        
        // Check for latency bottlenecks
        if (responseTime > 2000) {
            this.recordBottleneck(callSid, 'high_response_time', `${responseType} took ${responseTime}ms`);
        }
    }

    /**
     * Record a bottleneck
     * @param {string} callSid - Call SID
     * @param {string} bottleneckType - Type of bottleneck
     * @param {string} description - Bottleneck description
     */
    recordBottleneck(callSid, bottleneckType, description) {
        const session = this.activeSessions.get(callSid);
        if (!session) return;

        const bottleneck = {
            timestamp: Date.now(),
            type: bottleneckType,
            description,
            elapsedMs: session.startTime ? Date.now() - session.startTime : 0
        };

        session.bottlenecks.push(bottleneck);
        
        console.log(`🚨 [LATENCY] ${callSid} - BOTTLENECK: ${bottleneckType} - ${description}`);
        
        // Emit bottleneck event
        this.emit('bottleneck', callSid, bottleneck);
    }

    /**
     * End session and calculate statistics
     * @param {string} callSid - Call SID
     * @returns {Object} Session statistics
     */
    endSession(callSid) {
        const session = this.activeSessions.get(callSid);
        if (!session) {
            console.warn(`⚠️ [LATENCY] No active session found for call: ${callSid}`);
            return null;
        }

        const endTime = Date.now();
        const totalDuration = endTime - session.startTime;

        // Calculate initial latency (time to first response)
        const firstResponse = session.responseEvents[0];
        const initialLatency = firstResponse ? firstResponse.elapsedMs : totalDuration;

        // Calculate average response time
        const avgResponseTime = session.responseEvents.length > 0 
            ? session.responseEvents.reduce((sum, event) => sum + event.responseTime, 0) / session.responseEvents.length
            : 0;

        const stats = {
            callSid: session.callSid,
            phoneNumber: session.phoneNumber,
            totalDuration,
            initialLatency,
            averageResponseTime: avgResponseTime,
            totalEvents: session.events.length,
            totalAudioEvents: session.audioEvents.length,
            totalResponses: session.responseEvents.length,
            bottlenecks: session.bottlenecks.length,
            events: session.events,
            audioEvents: session.audioEvents,
            responseEvents: session.responseEvents,
            bottlenecks: session.bottlenecks
        };

        // Update global statistics
        this.latencyStats.totalCalls++;
        this.latencyStats.latencyHistory.push({
            callSid: session.callSid,
            initialLatency,
            averageResponseTime: avgResponseTime,
            totalDuration,
            timestamp: new Date().toISOString()
        });

        // Calculate running averages
        const recentCalls = this.latencyStats.latencyHistory.slice(-10);
        this.latencyStats.averageInitialLatency = recentCalls.reduce((sum, call) => sum + call.initialLatency, 0) / recentCalls.length;
        this.latencyStats.averageResponseLatency = recentCalls.reduce((sum, call) => sum + call.averageResponseTime, 0) / recentCalls.length;

        // Remove session from active sessions
        this.activeSessions.delete(callSid);

        console.log(`📊 [LATENCY] Session ended: ${callSid}`);
        console.log(`📊 [LATENCY] Initial latency: ${initialLatency}ms, Avg response: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`📊 [LATENCY] Bottlenecks found: ${session.bottlenecks.length}`);

        // Emit session end event
        this.emit('sessionEnd', callSid, stats);

        return stats;
    }

    /**
     * Get current latency statistics
     * @returns {Object} Current statistics
     */
    getStats() {
        return {
            ...this.latencyStats,
            activeSessions: this.activeSessions.size,
            recentSessions: this.latencyStats.latencyHistory.slice(-5)
        };
    }

    /**
     * Get session details
     * @param {string} callSid - Call SID
     * @returns {Object} Session details
     */
    getSession(callSid) {
        return this.activeSessions.get(callSid);
    }

    /**
     * Analyze bottlenecks across all sessions
     * @returns {Object} Bottleneck analysis
     */
    analyzeBottlenecks() {
        const allBottlenecks = [];
        
        for (const session of this.activeSessions.values()) {
            allBottlenecks.push(...session.bottlenecks);
        }

        // Group bottlenecks by type
        const bottleneckTypes = {};
        allBottlenecks.forEach(bottleneck => {
            if (!bottleneckTypes[bottleneck.type]) {
                bottleneckTypes[bottleneck.type] = [];
            }
            bottleneckTypes[bottleneck.type].push(bottleneck);
        });

        return {
            totalBottlenecks: allBottlenecks.length,
            bottleneckTypes,
            recommendations: this.generateRecommendations(bottleneckTypes)
        };
    }

    /**
     * Generate optimization recommendations based on bottlenecks
     * @param {Object} bottleneckTypes - Bottlenecks grouped by type
     * @returns {Array} List of recommendations
     */
    generateRecommendations(bottleneckTypes) {
        const recommendations = [];

        if (bottleneckTypes.high_response_time && bottleneckTypes.high_response_time.length > 0) {
            recommendations.push({
                priority: 'high',
                type: 'response_time',
                description: 'High response times detected. Consider optimizing HumeAI configuration loading and audio processing.',
                action: 'Review custom configuration initialization and audio pipeline settings'
            });
        }

        if (bottleneckTypes.connection_delay && bottleneckTypes.connection_delay.length > 0) {
            recommendations.push({
                priority: 'high',
                type: 'connection',
                description: 'Connection delays detected. Consider implementing connection pooling.',
                action: 'Pre-warm HumeAI connections and implement keep-alive mechanisms'
            });
        }

        if (bottleneckTypes.audio_buffering && bottleneckTypes.audio_buffering.length > 0) {
            recommendations.push({
                priority: 'medium',
                type: 'audio',
                description: 'Audio buffering delays detected. Consider reducing buffer sizes.',
                action: 'Optimize audio buffer settings and implement streaming processing'
            });
        }

        return recommendations;
    }

    /**
     * Clear old session data
     * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
     */
    clearOldData(maxAge = 3600000) {
        const cutoff = Date.now() - maxAge;
        this.latencyStats.latencyHistory = this.latencyStats.latencyHistory.filter(
            session => new Date(session.timestamp).getTime() > cutoff
        );
    }
}

module.exports = new LatencyMonitor(); 