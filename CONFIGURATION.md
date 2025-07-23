# Hume AI Custom Configuration Guide

## 🎛️ Configuration Overview

**Configuration ID**: `9d00fd96-7e92-44c1-b781-4af52331c629`

This document details the implementation and usage of the custom Hume AI configuration across the voice agent system.

## 🔧 Implementation Details

### Environment Variable Setup

The configuration is managed through the `HUME_CONFIG_ID` environment variable:

```bash
# Set in .env file
HUME_CONFIG_ID=9d00fd96-7e92-44c1-b781-4af52331c629
```

### JavaScript Service Integration

**File**: `services/hume-evi.js`

```javascript
getCredentials() {
    const apiKey = process.env.HUME_API_KEY;
    const configId = process.env.HUME_CONFIG_ID;
    
    return {
        apiKey,
        configId: configId || null // Optional configuration ID
    };
}

async startConversation(callSid, onAudioData, onTranscript, onError) {
    const { apiKey, configId } = this.getCredentials();
    
    // Build WebSocket URL with authentication
    const params = new URLSearchParams();
    params.append('api_key', apiKey);
    if (configId) {
        params.append('config_id', configId);  // ← Custom config applied here
    }
    params.append('verbose_transcription', 'true');
    
    const wsUrl = `${this.baseUrl}?${params.toString()}`;
    const ws = new WebSocket(wsUrl);
    // ... connection handling
}
```

### Python Agent Integration

**File**: `hume-ai-agent.py`

```python
class HumeAIAgent:
    def __init__(self):
        self.hume_api_key = os.getenv("HUME_API_KEY")
        self.hume_config_id = os.getenv("HUME_CONFIG_ID") or None  # ← Config loaded here
        
        # Log configuration status
        if self.hume_config_id:
            logger.info(f"🎛️ Using custom Hume configuration: {self.hume_config_id}")
        else:
            logger.info(f"📝 Using default Hume configuration")
    
    async def connect_to_hume(self):
        # Build WebSocket URL with authentication
        params = f"api_key={self.hume_api_key}"
        if self.hume_config_id:
            params += f"&config_id={self.hume_config_id}"  # ← Custom config applied here
        
        hume_url = f"wss://api.hume.ai/v0/evi/chat?{params}"
        self.hume_websocket = await websockets.connect(hume_url)
```

## 🌐 WebSocket URL Construction

### JavaScript Service URL
```
wss://api.hume.ai/v0/evi/chat?api_key=***&config_id=9d00fd96-7e92-44c1-b781-4af52331c629&verbose_transcription=true
```

### Python Agent URL
```
wss://api.hume.ai/v0/evi/chat?api_key=***&config_id=9d00fd96-7e92-44c1-b781-4af52331c629
```

## 📊 Configuration Capabilities

Based on Hume AI documentation, this configuration enables:

### Voice Customization
- Specialized voice characteristics
- Custom speech patterns and intonation
- Emotional expression in voice output

### System Prompts
- Custom personality definition
- Specialized response patterns
- Context-aware conversation logic

### Enhanced Features
- Built-in tools (web search, hang up)
- Custom tools and function calling
- Event messages and timeouts
- Webhook integration capabilities

### Emotion Processing
- Advanced emotional intelligence
- Tailored response based on user emotions
- Context-aware empathetic responses

## 🧪 Testing Configuration

### Verification Tests

**Environment Variable Test:**
```bash
echo $HUME_CONFIG_ID
# Should output: 9d00fd96-7e92-44c1-b781-4af52331c629
```

**JavaScript Service Test:**
```bash
node test-integration-config.js
```

**Python Agent Test:**
```bash
python3 test-python-config.py
```

### Expected Behavior

When configuration is properly applied:

1. **Initialization Logs**: Services will log the custom configuration ID during startup
2. **WebSocket URLs**: Generated URLs will include the `config_id` parameter
3. **Voice Behavior**: Calls will exhibit custom voice characteristics and response patterns
4. **Enhanced Capabilities**: Advanced conversation features will be available

## 🔍 Debugging Configuration Issues

### Common Issues

**Configuration Not Loading:**
```bash
# Check environment variable
echo "HUME_CONFIG_ID: $HUME_CONFIG_ID"

# Verify in JavaScript
node -e "console.log('Config:', process.env.HUME_CONFIG_ID)"

# Verify in Python  
python3 -c "import os; print('Config:', os.getenv('HUME_CONFIG_ID'))"
```

**WebSocket Connection Issues:**
- Check that configuration ID is valid in Hume dashboard
- Verify API key has access to the configuration
- Ensure network connectivity to Hume AI services

### Log Analysis

**JavaScript Service Logs:**
```
🎛️ Using custom Hume configuration: 9d00fd96-7e92-44c1-b781-4af52331c629
🔗 WebSocket URL: wss://api.hume.ai/v0/evi/chat?api_key=***&config_id=9d00fd96-7e92-44c1-b781-4af52331c629&verbose_transcription=true
✅ HumeAI EVI conversation started for call test-123 with custom config 9d00fd96-7e92-44c1-b781-4af52331c629
```

**Python Agent Logs:**
```
🎛️ Using custom Hume configuration: 9d00fd96-7e92-44c1-b781-4af52331c629
🎛️ Connecting to HumeAI EVI with custom configuration: 9d00fd96-7e92-44c1-b781-4af52331c629
🔗 WebSocket URL: wss://api.hume.ai/v0/evi/chat?api_key=***&config_id=9d00fd96-7e92-44c1-b781-4af52331c629
✅ Connected to HumeAI EVI with custom config 9d00fd96-7e92-44c1-b781-4af52331c629
```

## 🚀 Production Deployment

### Environment Setup

**Docker Environment:**
```dockerfile
ENV HUME_CONFIG_ID=9d00fd96-7e92-44c1-b781-4af52331c629
```

**Kubernetes ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hume-config
data:
  HUME_CONFIG_ID: "9d00fd96-7e92-44c1-b781-4af52331c629"
```

**systemd Service:**
```ini
[Service]
Environment=HUME_CONFIG_ID=9d00fd96-7e92-44c1-b781-4af52331c629
```

### Monitoring

**Health Checks:**
- Verify configuration ID in service startup logs
- Monitor WebSocket connection success rates
- Track custom behavior activation in conversations

**Metrics:**
- Configuration application rate
- Custom feature usage statistics  
- Voice quality and response metrics

## 📞 Call Flow with Custom Configuration

1. **Call Initiation**: Phone call received via Twilio SIP
2. **LiveKit Room**: Call routed to LiveKit room
3. **Agent Dispatch**: Python agent joins room automatically
4. **Hume Connection**: Agent connects to Hume AI with custom configuration
5. **Custom Behavior**: Voice processing uses specialized configuration
6. **Enhanced Experience**: Caller experiences custom voice and conversation capabilities

---

**Status**: ✅ Fully Implemented and Tested  
**Configuration ID**: `9d00fd96-7e92-44c1-b781-4af52331c629`  
**Last Updated**: Current implementation 