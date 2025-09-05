# ElevenLabs Voice Agent

## 🎯 Overview

This project implements an AI-powered voice agent using **ElevenLabs Conversational AI** integrated with **Twilio** for telephony connectivity. The system provides a streamlined approach to AI voice calling with built-in conversation management and call logging.

## 🏗️ Architecture

```
Web Interface → Node.js Server → ElevenLabs API → Twilio → Phone Call
                                    ↓
                            Conversation Management
                            Call Logging & Analytics
```

## ✅ Current Status

- ✅ **ElevenLabs Integration**: Conversational AI with agent management
- ✅ **Twilio Integration**: Phone calls via ElevenLabs platform
- ✅ **Web Interface**: Modern UI for call management
- ✅ **Call Logging**: Comprehensive call tracking and analytics
- ✅ **Real-time Calls**: Live outbound calling functionality

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file with the following configuration:

```bash
# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_AGENT_ID=your_agent_id_here
ELEVENLABS_PHONE_NUMBER_ID=your_phone_number_id_here

# Note: Global Phone Number Pool is now configured via the web interface
# and stored in the database (no longer needs environment variable)

# Dynamic Variables Configuration (for agent personalization)
BATCH_CALLING_FIRST_NAME_KEY=name_test
BATCH_CALLING_COMPANY_KEY=company
BATCH_CALLING_ROLE_KEY=role

# Supabase Configuration (for call logging)
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 2. Start the Server

```bash
npm install
npm start
```

### 3. Access the Web Interface

Open your browser and navigate to:
```
http://localhost:3000
```

### 4. Make a Call

1. **Enter a phone number** in international format (e.g., +1234567890)
2. **Click "🎯 Start ElevenLabs Call"**
3. **Receive the call** from your ElevenLabs agent

### 5. Phone Number Randomization (Optional)

To avoid calling from the same phone number repeatedly (which might trigger spam filters), you can set up a global phone pool:

1. **Via Web Interface** (Recommended):
   - Go to the web interface at `http://localhost:3000`
   - Look for settings or configuration section
   - Configure your phone pool through the UI
   - The phone pool is now stored in the database and persists across restarts

2. **Legacy Method** (Environment Variable - Deprecated):
   - The old `ELEVENLABS_PHONE_NUMBER_POOL` environment variable is no longer used
   - Use the web interface instead for better persistence and management
```

Each call will randomly select a phone number from this pool. This works for:
- Manual calls via the web interface
- Sequence batch calls
- Agent assignments (when no specific phone is assigned to an agent)

## 📁 Key Files

- **`index.js`**: Main server with ElevenLabs integration
- **`services/elevenlabs.js`**: ElevenLabs API service
- **`services/supabase-db.js`**: Database operations
- **`public/index.html`**: Web interface for call management

## 🎛️ Configuration Details

### ElevenLabs Setup

1. **Create an ElevenLabs Account**: Sign up at [elevenlabs.io](https://elevenlabs.io)
2. **Create a Conversational AI Agent**: Configure voice, prompts, and behavior
3. **Connect Twilio Phone Number**: Link your Twilio number in ElevenLabs dashboard
4. **Get API Credentials**: Retrieve your API key and agent/phone number IDs

### Agent Configuration

The system uses your configured ElevenLabs agent with:
- **Custom Voice**: Your chosen voice characteristics
- **System Prompts**: Defined personality and conversation style
- **Call Management**: Built-in conversation tracking
- **Analytics**: Comprehensive call logging and insights

### Dynamic Variables

The system now automatically passes contact information to your ElevenLabs agents through dynamic variables:

- **`name_test`** (configurable): Contact's first name
- **`company`** (configurable): Contact's company name
- **`role`** (configurable): Contact's position/role
- **`weekday`**: Current day of the week

These variables are available in your agent prompts for personalized conversations. You can customize the variable names using:

```bash
BATCH_CALLING_FIRST_NAME_KEY=your_name_variable
BATCH_CALLING_COMPANY_KEY=your_company_variable
BATCH_CALLING_ROLE_KEY=your_role_variable
```

**Example Agent Prompt:**
```
Hello {name_test}! I'm calling from your ElevenLabs assistant. I see you work at {company} as a {role}. How are you today?
```

The system automatically populates these variables from your contact database for all calling methods:
- Manual calls via the web interface
- Batch sequence calls
- Individual sequence calls

## 🔧 API Endpoints

- **`POST /make-call`**: Initiate outbound calls
- **`GET /test-elevenlabs`**: Test ElevenLabs connection
- **`GET /elevenlabs/agents`**: List available agents
<!-- Removed: GET /elevenlabs/phone-numbers (unused) -->
- **`GET /health`**: Server health check

## 📊 Features

- **Real-time Calling**: Live outbound call initiation
- **Call Logging**: Comprehensive call tracking and analytics
- **Web Interface**: Modern, responsive UI for call management
- **Error Handling**: Robust error management and user feedback
- **Status Monitoring**: Real-time system status and health checks

## 🚀 Deployment

The application is ready for deployment on platforms like:
- **Replit**: Direct deployment with environment variables
- **Heroku**: Cloud deployment with add-ons
- **Vercel**: Serverless deployment
- **Railway**: Containerized deployment

## 📞 Usage

1. **Start the server**: `node index.js`
2. **Open web interface**: Navigate to the provided URL
3. **Enter phone number**: Use international format
4. **Make call**: Click the call button
5. **Monitor calls**: Check logs and analytics

## 🔍 Troubleshooting

- **Check environment variables**: Ensure all required variables are set
- **Verify ElevenLabs credentials**: Confirm API key and agent/phone number IDs
- **Test Twilio connection**: Ensure Twilio credentials are valid in ElevenLabs
- **Check server logs**: Monitor for any error messages

## 📈 Analytics

The system provides comprehensive call analytics including:
- Call duration and status
- Conversation transcripts
- Agent performance metrics
- Call outcome tracking 