# Twilio SIP Configuration for LiveKit Integration

## 🎯 Goal
Route calls from Twilio phone number `+44 7846 855904` to LiveKit SIP trunk `ST_aYbiFgUMYsFA`, which auto-dispatches the HumeAI agent.

## 📊 Architecture Flow
```
Caller → +44 7846 855904 → Twilio SIP Domain → LiveKit SIP Trunk → HumeAI Agent
```

---

## Step 1: Create Twilio SIP Domain

### 1.1 Go to Twilio Console
- Navigate to: https://console.twilio.com/us1/develop/sip/domains
- Click **"Create new SIP Domain"**

### 1.2 Configure SIP Domain
```
Domain Name: hume-ai-sip.sip.twilio.com
Friendly Name: HumeAI Voice Agent SIP
```

### 1.3 Authentication Settings
```
✅ Enable: "SIP Registration"
✅ Enable: "Mapping using SIP Auth credentials"

Credentials:
- Username: ai-voice-agent  
- Password: secure-password-123
```
*(These match our LiveKit trunk authentication)*

---

## Step 2: Create SIP Trunk (Twilio → LiveKit)

### 2.1 Go to SIP Trunking
- Navigate to: https://console.twilio.com/us1/develop/sip/trunks
- Click **"Create new SIP Trunk"**

### 2.2 Configure SIP Trunk
```
Friendly Name: LiveKit AI Voice Trunk
Termination SIP URI: sip:test-89asdjqg.sip.livekit.cloud

Authentication:
✅ Enable: "Credential List Auth"
- Use the same credentials: ai-voice-agent / secure-password-123

Origination: 
✅ Enable: "Accept SIP traffic from"  
- LiveKit Cloud (no specific IPs needed)
```

### 2.3 Advanced Settings
```
Connection Policy: DENY_ALL (then add specific IPs if needed)
SIP Header: From -> To (preserve caller ID)
Codec Preferences: PCMU, PCMA (for compatibility)
```

---

## Step 3: Route Phone Number to SIP

### 3.1 Go to Phone Numbers
- Navigate to: https://console.twilio.com/us1/develop/phone-numbers/manage/active
- Click on your number: `+44 7846 855904`

### 3.2 Configure Voice Webhooks
```
Voice & Fax Configuration:
- Webhook: https://YOUR_TWILIO_FUNCTION_URL/route-to-sip
- HTTP Method: POST
- Accept Calls: Yes
```

### 3.3 Create TwiML Function (Route to SIP)
Create a Twilio Function with this TwiML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial>
        <Sip>sip:call@hume-ai-sip.sip.twilio.com</Sip>
    </Dial>
</Response>
```

---

## Step 4: LiveKit SIP Endpoint Configuration

### 4.1 LiveKit SIP Settings
Our LiveKit trunk needs to accept calls from Twilio:

```
SIP Trunk: ST_aYbiFgUMYsFA
- Accept from: Twilio IP ranges
- Authentication: ai-voice-agent / secure-password-123
- Protocol: SIP/UDP on port 5060
```

### 4.2 Update Allowed Addresses (Optional)
LiveKit Cloud automatically handles Twilio IPs, but if needed you can add:
- Twilio SIP IP ranges (check Twilio documentation for current ranges)
- Or use our trunk credentials for authentication instead

---

## Step 5: Testing Configuration

### 5.1 Start HumeAI Agent
```bash
python hume-ai-agent.py dev
```

### 5.2 Test Call Flow
1. **Call** `+44 7846 855904`
2. **Twilio** routes to SIP domain
3. **SIP Domain** forwards to LiveKit trunk  
4. **LiveKit** creates room `hume-call-XXXXX`
5. **Agent** auto-joins and connects to HumeAI
6. **Conversation** begins with emotion-aware AI

### 5.3 Debug Steps
- Check Twilio Call Logs
- Monitor LiveKit room creation
- Verify agent dispatch in Python logs
- Test HumeAI WebSocket connection

---

## 📋 Expected Results

**✅ Successful Call Flow:**
```
📞 Dial +44 7846 855904
   ↓
🌐 Twilio receives call  
   ↓
📡 Routes to SIP domain
   ↓
🚀 LiveKit SIP trunk receives
   ↓
🏠 Creates room hume-call-XXXXX
   ↓
🤖 Python agent auto-joins
   ↓
🧠 Connects to HumeAI EVI
   ↓
💬 Emotion-aware conversation starts!
```

---

## 🔧 Troubleshooting

**Common Issues:**
- **No answer**: Check TwiML function URL
- **SIP fails**: Verify authentication credentials match
- **No agent**: Ensure Python agent is running with correct name
- **No audio**: Check codec compatibility (PCMU/PCMA)
- **Auth errors**: Verify LiveKit trunk credentials

**Debug Commands:**
```bash
# Check LiveKit rooms
curl http://localhost:3000/livekit/rooms

# Check SIP configuration
curl http://localhost:3000/livekit/sip/inbound-trunks
```

---

## 🚀 Production Ready!

Once configured, you'll have:
- **Enterprise SIP**: Twilio → LiveKit Cloud
- **Auto-scaling**: Room-based architecture
- **AI Integration**: Real-time emotion detection
- **Robust**: Production-grade telephony 