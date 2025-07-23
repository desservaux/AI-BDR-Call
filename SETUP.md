# HumeAI Agent Setup Instructions

## Phase 5: Deploy HumeAI Agent with LiveKit

This document explains how to deploy the Python HumeAI agent that bridges LiveKit SIP calls to HumeAI EVI.

## ✅ Prerequisites Complete

- **LiveKit Cloud**: Connected and configured
- **HumeAI EVI**: API key working
- **SIP Trunk**: `ST_aYbiFgUMYsFA` created and ready
- **Dispatch Rule**: `SDR_WWcXJGDqR254` configured for `hume-ai-agent`

## 🐍 Python Environment Setup

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Environment Variables

Create a `.env` file with:

```bash
# LiveKit Configuration
LIVEKIT_URL=wss://test-89asdjqg.livekit.cloud
LIVEKIT_API_KEY=APILiHWQMCq8HaB
LIVEKIT_API_SECRET=5xmXfOCA0f1feeAxnGiRuVeAmaOe4Q8SfBP8Kw09t4BU

# HumeAI Configuration
HUME_API_KEY=sUxoFMRiwyAqRsKgiFt5ZIl8yeSVvGPKOGec8mWpN5DpVIsD

# Custom Hume Configuration ID for specialized agent behavior
# This configuration provides customized voice, system prompt, and capabilities
HUME_CONFIG_ID=9d00fd96-7e92-44c1-b781-4af52331c629

# Optional
LOG_LEVEL=INFO
```

### 3. Run the Agent

```bash
python hume-ai-agent.py dev
```

The agent will:
- Connect to LiveKit Cloud
- Wait for SIP dispatch calls
- Auto-join rooms when calls come in
- Bridge audio to HumeAI EVI with custom configuration

## 📞 SIP Configuration

### Current Setup:
- **Trunk ID**: `ST_aYbiFgUMYsFA`
- **Username**: `ai-voice-agent`  
- **Password**: `secure-password-123`
- **Dispatch Rule**: `SDR_WWcXJGDqR254`

### Next Steps:
1. **SIP Provider**: Configure with your phone provider
2. **Phone Number**: Point to LiveKit SIP trunk
3. **Testing**: Make test calls

## 🏗️ Architecture Flow

```
Phone Call → SIP Provider → LiveKit Trunk → Dispatch Rule → Room → Python Agent → HumeAI EVI (Custom Config)
```

## 🚀 Testing

1. **Start Agent**: `python hume-ai-agent.py dev`
2. **Make Call**: Dial the configured phone number
3. **Check Logs**: Agent should auto-join the room and apply custom configuration
4. **Verify Audio**: HumeAI should process the conversation with custom behavior

## 🎯 Expected Behavior

When a call comes in:
1. LiveKit creates room `hume-call-XXXXX`
2. SIP caller joins as participant
3. Python agent joins automatically  
4. HumeAI EVI connects with configuration `9d00fd96-7e92-44c1-b781-4af52331c629`
5. Agent processes audio with custom voice, prompts, and capabilities
6. Real-time conversation with emotion-aware responses

## 🎛️ Custom Configuration Features

The configuration `9d00fd96-7e92-44c1-b781-4af52331c629` provides:
- Specialized voice characteristics
- Custom system prompts and personality
- Enhanced conversation capabilities
- Specific response patterns optimized for voice calls

## 🔧 Troubleshooting

**Configuration Not Applied:**
- Verify `HUME_CONFIG_ID` environment variable is set
- Check agent logs for configuration loading messages
- Ensure configuration ID is valid in Hume dashboard

**Agent Connection Issues:**
- Verify all environment variables are set correctly
- Check LiveKit and HumeAI API credentials
- Ensure network connectivity to both services 