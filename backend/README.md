# 📸 Instagram Graph API - Minimal Test Server

Simple server to test Instagram Graph API OAuth flow and data fetching.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Make sure `.env` has:
```env
PORT=8000
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_REDIRECT_URI=https://myautomation-test2.onrender.com/api/instagram/callback
FRONTEND_URL=https://mydmtestingapp.netlify.app
```

> ⚠️ **Important**: Update the redirect URI in your Meta App Dashboard to match exactly!

### 3. Start Server
```bash
npm start
```

Server will run on `http://localhost:8000`

## 🧪 Testing

1. **Start OAuth Flow**  
   Open: `http://localhost:8000/api/instagram/auth`

2. **Login with Instagram Professional Account**  
   You'll be redirected to Instagram

3. **Get Access Token**  
   After login, you'll see a success page with your token

4. **Test Endpoints**  
   - Profile: `http://localhost:8000/api/instagram/profile?token=YOUR_TOKEN`
   - Media: `http://localhost:8000/api/instagram/media?token=YOUR_TOKEN`

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instagram/auth` | Start OAuth flow |
| GET | `/api/instagram/callback` | OAuth callback (automatic) |
| GET | `/api/instagram/profile?token=XXX` | Get profile data |
| GET | `/api/instagram/media?token=XXX` | Get posts & reels |
| GET | `/api/health` | Health check |

## 📦 What's Included

- ✅ OAuth 2.0 flow (short → long-lived token)
- ✅ Profile data fetching
- ✅ Media fetching (posts & reels)
- ✅ Beautiful HTML success pages
- ✅ In-memory token storage
- ✅ Error handling

## 🌐 Deployment

Deploy to Render and it will work automatically. Make sure to:
1. Update Meta App redirect URI
2. Set environment variables on Render

---

**Note**: This is a minimal testing server. Tokens are stored in memory and will be lost on restart.
