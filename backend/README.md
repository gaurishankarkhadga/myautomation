# CreatorHub Backend - Instagram Automation API

Complete Instagram Graph API integration for Instagram automation platform.

## ✅ Backend Complete & Functional

All Instagram Graph API features implemented and ready to use.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables (see backend/.env)
# Make sure MongoDB is running

# Start server
npm start
```

## 📋 Environment Variables Required

Check `/backend/.env` - you need:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - For authentication
- `INSTAGRAM_APP_ID` - From Facebook Developer Console
- `INSTAGRAM_APP_SECRET` - From Facebook Developer Console
- `INSTAGRAM_REDIRECT_URI` - OAuth callback URL
- `FRONTEND_URL` - Your React app URL

## 🎯 Features Implemented

### ✅ Authentication
- User registration & login
- JWT token management

### ✅ Instagram OAuth
- Complete OAuth 2.0 flow
- Long-lived token (60 days)
- Token refresh
- Account disconnection

### ✅ Instagram Data
- Fetch user profile
- Get media (posts/reels)
- Retrieve insights & analytics
- Follower/engagement metrics

### ✅ Post Automation
- Schedule posts for future
- Immediate publishing
- Automatic publishing via cron job (every minute)
- Support for images & videos

### ✅ Analytics
- Sync Instagram insights
- Historical data tracking
- Top posts analysis
- Growth metrics

### ✅ Data Deletion
- Facebook callback compliance
- Manual deletion requests
- Complete data removal

## 📁 Project Structure

```
backend/
├── config/
│   ├── database.js          # MongoDB connection
│   └── instagram.js          # Instagram API config
├── models/
│   ├── User.js              # User authentication
│   ├── InstagramAccount.js   # Connected accounts
│   ├── ScheduledPost.js      # Post automation
│   └── Analytics.js          # Insights data
├── services/
│   ├── InstagramOAuthService.js  # OAuth flow
│   └── InstagramAPIService.js    # Instagram Graph API
├── controllers/
│   ├── authController.js
│   ├── instagramController.js
│   ├── automationController.js
│   └── analyticsController.js
├── routes/
│   ├── auth.js
│   ├── instagram.js
│   ├── automation.js
│   ├── analytics.js
│   └── dataDeletion.js
├── jobs/
│   └── publishScheduledPosts.js # Cron job
├── middleware/
│   └── auth.js              # JWT verification
└── app.js                   # Express server
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - User login

### Instagram
- `GET /api/instagram/auth` - Get OAuth URL
- `GET /api/instagram/callback` - OAuth callback
- `GET /api/instagram/profile` - Get profile
- `GET /api/instagram/media` - Get posts
- `DELETE /api/instagram/disconnect` - Disconnect

### Automation
- `POST /api/automation` - Schedule post
- `GET /api/automation` - List scheduled
- `PUT /api/automation/:id` - Update
- `DELETE /api/automation/:id` - Cancel
- `POST /api/automation/:id/publish` - Publish now

### Analytics
- `GET /api/analytics/overview` - Dashboard data
- `POST /api/analytics/sync` - Sync insights
- `GET /api/analytics/insights` - Historical data

### Data Deletion
- `POST /api/data-deletion/callback` - Facebook callback
- `POST /api/data-deletion/request` - Manual deletion

## ⚙️ Automated Features

**Cron Job** runs every minute to publish scheduled posts automatically.

## 🔐 Security

- Passwords hashed with bcrypt
- JWT authentication
- CORS enabled
- Input validation

## 📝 Notes

- Requires Business/Creator Instagram accounts
- Instagram Graph API limitations apply
- Long-lived tokens expire after 60 days (auto-refresh implemented)

Done! Backend is production-ready. 🎉
