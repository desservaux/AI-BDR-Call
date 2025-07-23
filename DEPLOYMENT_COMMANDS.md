# Quick Deployment & Testing Commands

## 🚀 Deploy HumeAI Agent (Terminal Commands)

### 1. Install Python Dependencies
```bash
# Make sure you're in the project directory
cd /home/runner/workspace

# Install required packages
pip install livekit-agents livekit-plugins-openai websockets aiohttp python-dotenv
```

### 2. Set Environment Variables
```bash
# Create .env file for Python agent
cat > .env << EOF
LIVEKIT_URL=wss://test-89asdjqg.livekit.cloud
LIVEKIT_API_KEY=APILiHWQMCq8HaB
LIVEKIT_API_SECRET=5xmXfOCA0f1feeAxnGiRuVeAmaOe4Q8SfBP8Kw09t4BU
HUME_API_KEY=sUxoFMRiwyAqRsKgiFt5ZIl8yeSVvGPKOGec8mWpN5DpVIsD
LOG_LEVEL=INFO
EOF
```

### 3. Start the Agent
```bash
# Run the HumeAI agent - it will wait for SIP calls
python hume-ai-agent.py dev
```

**Expected Output:**
```
🚀 Starting HumeAI Agent Worker...
Agent Name: hume-ai-agent (must match SIP dispatch rule)
Waiting for SIP calls to be dispatched...
✅ Connected to LiveKit Cloud
🎭 Agent ready for SIP dispatch
```

---

## 📞 Test Complete Flow

### 4. Verify SIP Configuration
```bash
# Check our LiveKit SIP setup
curl -s http://localhost:3000/livekit/sip/inbound-trunks
curl -s http://localhost:3000/livekit/sip/dispatch-rules
```

**Should show:**
- Trunk: `ST_aYbiFgUMYsFA` ✅
- Dispatch Rule: `SDR_WWcXJGDqR254` ✅  

### 5. Test Call Flow
```bash
# 1. Start Python agent (in one terminal)
python hume-ai-agent.py dev

# 2. Check LiveKit rooms (in another terminal) 
watch -n 2 'curl -s http://localhost:3000/livekit/rooms'

# 3. Make test call to +44 7846 855904
#    → Should create room hume-call-XXXXX
#    → Agent should auto-join
#    → HumeAI conversation starts
```

---

## 🔧 Debug Commands

### Check Agent Status
```bash
# Verify agent is running and waiting
ps aux | grep hume-ai-agent
```

### Monitor LiveKit Activity  
```bash
# Watch for new rooms being created
curl -s http://localhost:3000/livekit/rooms | jq

# Check room details when call comes in
curl -s http://localhost:3000/livekit/rooms/hume-call-XXXXX | jq
```

### Twilio Call Logs
- Go to: https://console.twilio.com/us1/monitor/logs/calls
- Check call flow: Phone → Function → SIP → LiveKit

---

## 🎯 Success Indicators

**✅ Complete Flow Working:**

1. **Agent Ready:** Python agent shows "Waiting for SIP calls"
2. **Call Placed:** Dial +44 7846 855904  
3. **Room Created:** LiveKit creates `hume-call-XXXXX`
4. **Agent Joins:** Python logs show "Agent starting in room" 
5. **HumeAI Connected:** WebSocket connection established
6. **Conversation:** Audio flows through the complete pipeline

**Architecture Flow:**
```
📱 Call +44 7846 855904
   ↓
🌐 Twilio Function routes to SIP  
   ↓
🚀 LiveKit SIP trunk receives
   ↓ 
🏠 Creates room hume-call-XXXXX
   ↓
🤖 Auto-dispatches hume-ai-agent
   ↓
🧠 Agent connects to HumeAI EVI
   ↓
💬 Emotion-aware conversation begins!
``` 