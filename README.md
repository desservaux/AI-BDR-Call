# AI Voice Agent - HumeAI + LiveKit Integration

## 🎯 Overview

This project implements an AI-powered voice agent using **HumeAI EVI** (Empathic Voice Interface) integrated with **LiveKit** for real-time communication and **Twilio SIP** for telephony connectivity. The system uses a **custom Hume configuration** for specialized voice behavior and enhanced conversation capabilities.

## 🎛️ Custom Hume Configuration

**Configuration ID**: `9d00fd96-7e92-44c1-b781-4af52331c629`

This custom configuration provides:
- Specialized voice characteristics and personality
- Custom system prompts optimized for voice calls
- Enhanced conversation capabilities and response patterns
- Emotion-aware processing with tailored behavior

## 🏗️ Architecture

```
Phone Call → Twilio SIP → LiveKit Cloud → HumeAI Agent → Custom EVI Configuration
                                           ↓
                                    Real-time Voice Processing
                                    with Emotion Awareness
```

## ✅ Current Status

- ✅ **SIP Integration**: Phone calls successfully route through Twilio → LiveKit
- ✅ **HumeAI Integration**: EVI service with custom configuration
- ✅ **LiveKit Rooms**: WebRTC audio processing working
- ✅ **Python Agent**: Auto-dispatch agent for call handling
- ✅ **Custom Configuration**: Specialized Hume behavior implemented

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file with the following configuration:

```bash
# HumeAI Configuration
HUME_API_KEY=your_hume_api_key_here
HUME_CONFIG_ID=9d00fd96-7e92-44c1-b781-4af52331c629

# LiveKit Configuration  
LIVEKIT_URL=wss://test-89asdjqg.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here

# Twilio Configuration (if using)
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here
```

### 2. Start the Services

**Python HumeAI Agent:**
```bash
python hume-ai-agent.py dev
```

**JavaScript Services (if using):**
```bash
npm install
npm start
```

### 3. Test the Integration

1. **Make a Call**: Dial your configured phone number
2. **Check Logs**: Verify the agent connects with custom configuration
3. **Experience**: Custom voice behavior and enhanced conversation

## 📁 Key Files

- **`hume-ai-agent.py`**: Python agent that bridges LiveKit rooms to HumeAI EVI
- **`services/hume-evi.js`**: JavaScript service for HumeAI integration
- **`config.example`**: Environment configuration template
- **`SETUP.md`**: Detailed setup instructions
- **`.cursor/scratchpad.md`**: Development progress tracking

## 🎛️ Configuration Details

### Custom Configuration Features

The configuration `9d00fd96-7e92-44c1-b781-4af52331c629` includes:

- **Voice Customization**: Specialized voice characteristics
- **System Prompts**: Custom personality and response patterns
- **Conversation Logic**: Enhanced interaction capabilities
- **Emotion Processing**: Tailored emotional intelligence responses

### How Configuration is Applied

**JavaScript Service (`services/hume-evi.js`):**
```javascript
const { apiKey, configId } = this.getCredentials();
params.append('config_id', configId); // Applied to WebSocket URL
```

**Python Agent (`hume-ai-agent.py`):**
```python
self.hume_config_id = os.getenv("HUME_CONFIG_ID")
params += f"&config_id={self.hume_config_id}"  # Applied to WebSocket URL
```

## 🧪 Testing

**Run Configuration Tests:**
```bash
# Test JavaScript configuration
node test-integration-config.js

# Test Python configuration  
python3 test-python-config.py

# Simple environment test
node simple-config-test.js
```

## 🔧 Troubleshooting

### Configuration Not Applied
- Verify `HUME_CONFIG_ID` environment variable is set correctly
- Check agent logs for configuration loading messages
- Ensure configuration ID is valid in Hume dashboard

### Connection Issues  
- Verify all environment variables are set correctly
- Check LiveKit and HumeAI API credentials
- Ensure network connectivity to both services

### SIP Integration Issues
- Verify Twilio SIP trunk configuration
- Check LiveKit SIP dispatch rules
- Ensure phone number routing is correct

## 📚 Documentation

- **[Setup Guide](SETUP.md)**: Detailed installation and configuration
- **[Twilio SIP Setup](TWILIO_SIP_SETUP.md)**: SIP trunk configuration
- **[Development Log](.cursor/scratchpad.md)**: Implementation progress and decisions

## 🎯 Next Steps

1. **Phone Integration**: Configure your phone provider with the SIP trunk
2. **Testing**: Make test calls to verify custom behavior
3. **Monitoring**: Set up logging and analytics
4. **Scaling**: Configure for production usage

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the setup documentation  
3. Check the development log for implementation details

---

**Architecture**: HumeAI EVI + LiveKit + Twilio SIP  
**Configuration**: Custom `9d00fd96-7e92-44c1-b781-4af52331c629`  
**Status**: ✅ Ready for production calls 