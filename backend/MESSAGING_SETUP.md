# Instagram Messaging Setup Guide

## Environment Variables

Add this to your `.env` file:

```env
# Instagram Messaging Webhook
WEBHOOK_VERIFY_TOKEN=your_secure_random_token_12345
```

**Important**: Change `your_secure_random_token_12345` to a secure random string. This token is used by Facebook to verify your webhook.

---

## Facebook Developer Console Setup

### 1. Configure Webhook URL

1. Go to [Facebook Developers Console](https://developers.facebook.com/)
2. Select your Instagram app
3. Go to **Products** → **Webhooks**
4. Click **Edit** next to Instagram
5. Add callback URL:
   - **Development**: Use ngrok or similar: `https://your-ngrok-url.ngrok.io/api/instagram/webhook`
   - **Production**: Use your server: `https://yourdomain.com/api/instagram/webhook`
6. Verify Token: Enter the same value as `WEBHOOK_VERIFY_TOKEN` from your `.env`
7. Click **Verify and Save**

### 2. Subscribe to Webhook Fields

After verification, subscribe to these fields:
- ✅ **messages** (required for receiving DMs)
- ✅ **messaging_postbacks** (optional - for quick replies)
- ✅ **message_reactions** (optional - for reactions)

Click **Subscribe**

---

## Using ngrok for Local Development

If testing locally, you need to expose your backend:

```bash
# Install ngrok (if not installed)
# Download from: https://ngrok.com/download

# Start your backend first
cd backend
npm start

# In a new terminal, start ngrok
ngrok http 8000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and use it in the Facebook webhook configuration as `https://abc123.ngrok.io/api/instagram/webhook`

---

## API Endpoints Overview

### Webhook Endpoints
- `GET /api/instagram/webhook` - Webhook verification (Facebook uses this)
- `POST /api/instagram/webhook` - Receives incoming messages

### Messaging Endpoints
- `POST /api/instagram/send-message` - Send a reply
- `GET /api/instagram/conversations` - List all conversations
- `GET /api/instagram/messages/:senderId` - Get messages from a sender
- `DELETE /api/instagram/messages/clear` - Clear message store (testing)

---

## Testing the System

### 1. Verify Webhook Setup
```bash
# Check if webhook verification works
curl "http://localhost:8000/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=your_secure_random_token_12345&hub.challenge=test"

# Should return: test
```

### 2. Send a Test Message
1. From another Instagram account, send a DM to your connected Instagram business account
2. Check your backend logs - you should see:
   ```
   [Webhook] Event received: ...
   [Webhook] Message received from: <IGSID>
   [Webhook] Message text: <message content>
   ```

### 3. Check Conversations
```bash
curl http://localhost:8000/api/instagram/conversations
```

### 4. Reply to a Message
```bash
curl -X POST http://localhost:8000/api/instagram/send-message \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "SENDER_IGSID_FROM_WEBHOOK",
    "message": "Thanks for your message!"
  }'
```

---

## Important Notes

⚠️ **24-Hour Messaging Window**: You can only reply within 24 hours of the user's last message

⚠️ **IGSID vs User ID**: Instagram uses IGSID (Instagram-Scoped ID) for messaging, not the public user ID

⚠️ **Message Storage**: Currently using in-memory storage. Messages will be lost when server restarts. Consider adding database storage for production.

⚠️ **Permissions**: Ensure `instagram_manage_messages` permission is approved in your Facebook app
