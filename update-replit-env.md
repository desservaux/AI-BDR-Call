# 🔧 Replit Environment Variables Update Guide

## 🚨 **CRITICAL ISSUE**: Twilio Authentication Error

The Replit deployment is failing with "Authenticate" error because the environment variables are using the old auth token.

## 📋 **Required Environment Variables to Update on Replit**

### **Step 1: Access Replit Environment Variables**
1. Go to your Replit project: `https://replit.com/@your-username/your-project`
2. Click on the **"Tools"** button in the left sidebar
3. Select **"Secrets"** from the dropdown menu

### **Step 2: Update These Environment Variables**

**TWILIO_AUTH_TOKEN** (CRITICAL - This is the main issue)
- **Current Value**: (old auth token)
- **New Value**: `ee9c2764dea5cf13481fec5895e2b6ed`
- **Description**: This is the authentication token for Twilio API

**TWILIO_ACCOUNT_SID**
- **Value**: `ACe35419debddfa2d27efe6de4115f698c`
- **Description**: Your Twilio account SID

**TWILIO_PHONE_NUMBER**
- **Value**: `+447846855904`
- **Description**: Your Twilio phone number

**HUME_API_KEY**
- **Value**: `sUxoFMRi...` (your actual Hume API key)
- **Description**: Your HumeAI API key

### **Step 3: Restart the Replit Server**
1. After updating the environment variables
2. Click the **"Run"** button in Replit to restart the server
3. Wait for the server to start up completely

### **Step 4: Test the Fix**
```bash
# Test Twilio connection
curl -s https://bf106fba-e676-49f8-a335-2d10945885b6-00-oymr1gogxpd2.picard.replit.dev/test-twilio

# Test making a call
curl -X POST https://bf106fba-e676-49f8-a335-2d10945885b6-00-oymr1gogxpd2.picard.replit.dev/make-call \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+33643584946", "message": "Test call after env update"}'
```

## 🎯 **Expected Results After Update**

✅ **Twilio Connection Test**: Should return `{"success":true}`
✅ **Make Call Endpoint**: Should successfully initiate calls
✅ **Web Interface**: Should work without authentication errors
✅ **Double-Call Prevention**: Should work correctly with the fixes implemented

## 🔍 **Troubleshooting**

If you still get authentication errors after updating:

1. **Check Environment Variable Names**: Make sure they're exactly `TWILIO_AUTH_TOKEN`, `TWILIO_ACCOUNT_SID`, etc.
2. **Restart Server**: Always restart the Replit server after updating environment variables
3. **Check for Typos**: Ensure the auth token is exactly `ee9c2764dea5cf13481fec5895e2b6ed`
4. **Verify API Key**: Make sure the Hume API key is correct

## 📊 **Current Status**

- ✅ **Local Testing**: Working with correct credentials
- ✅ **Double-Call Fix**: Implemented and ready
- 🔄 **Replit Deployment**: Waiting for environment variable update
- 🎯 **Next Steps**: Update Replit env vars and test deployment 