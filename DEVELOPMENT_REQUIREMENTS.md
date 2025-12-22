# Instagram Automation Suite - Development Requirements

## 📋 Minimal Requirements for Development

### 1. Environment Variables

#### Backend `.env` File
Create `/backend/.env` with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/creatorhub
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/creatorhub?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# Google Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Instagram Session Storage
INSTAGRAM_SESSION_DIR=./instagram-sessions

# CORS Configuration
FRONTEND_URL=http://localhost:5173

# Session Secret (for express-session if needed)
SESSION_SECRET=your_session_secret_key_here

# Optional: Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend `.env` File
Create `/frontend/.env` with the following variables:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:5000/api
VITE_API_TIMEOUT=30000

# Environment
VITE_NODE_ENV=development

# Optional: Analytics (for future)
# VITE_ANALYTICS_ID=your_analytics_id
```

---

### 2. Required NPM Packages

#### Backend Dependencies
Run these commands in `/backend`:

```bash
# Core Backend
npm install express dotenv cors body-parser cookie-parser

# Database
npm install mongoose

# Authentication & Security
npm install jsonwebtoken bcryptjs express-validator helmet express-rate-limit

# Instagram Private API
npm install instagram-private-api

# Google Gemini AI
npm install @google/generative-ai

# File Upload & Processing
npm install multer sharp

# Job Scheduling (for automation)
npm install node-cron

# Session Management
npm install express-session connect-mongo

# Utilities
npm install axios uuid

# Development
npm install --save-dev nodemon
```

**Total Backend package.json dependencies:**
```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "axios": "^1.7.0",
    "bcryptjs": "^2.4.3",
    "body-parser": "^1.20.3",
    "connect-mongo": "^5.1.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.2.1",
    "express-rate-limit": "^7.4.1",
    "express-session": "^1.18.1",
    "express-validator": "^7.2.0",
    "helmet": "^8.0.0",
    "instagram-private-api": "^1.46.1",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.8.4",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "sharp": "^0.33.5",
    "uuid": "^11.0.3"
  },
  "devDependencies": {
    "nodemon": "^3.1.11"
  }
}
```

#### Frontend Dependencies
Run these commands in `/frontend`:

```bash
# Core React (if not already installed via Vite)
npm install react react-dom react-router-dom

# HTTP Client
npm install axios

# UI & Icons
npm install lucide-react

# State Management (optional for complex state)
npm install zustand
# OR
npm install @tanstack/react-query

# Form Handling
npm install react-hook-form

# Date/Time Utilities
npm install date-fns

# Development
npm install --save-dev vite @vitejs/plugin-react
```

---

### 3. MongoDB Setup

#### Option A: Local MongoDB (Recommended for Development)
1. **Install MongoDB Community Edition:**
   - Ubuntu/Debian: `sudo apt-get install -y mongodb`
   - macOS: `brew install mongodb-community`
   - Windows: Download from [mongodb.com](https://www.mongodb.com/try/download/community)

2. **Start MongoDB:**
   ```bash
   # Ubuntu/Debian
   sudo systemctl start mongod
   sudo systemctl enable mongod
   
   # macOS
   brew services start mongodb-community
   
   # Manual start
   mongod --dbpath ~/data/db
   ```

3. **Verify Installation:**
   ```bash
   mongosh
   # or
   mongo
   ```

#### Option B: MongoDB Atlas (Cloud - Free Tier)
1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free M0 cluster
3. Whitelist your IP address (0.0.0.0/0 for development)
4. Create a database user
5. Get connection string and add to `.env` as `MONGODB_URI`

---

### 4. Google Gemini API Key

1. **Get API Key:**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with Google account
   - Click "Create API Key"
   - Copy and add to `.env` as `GEMINI_API_KEY`

2. **Free Tier Limits:**
   - 60 requests per minute
   - 1,500 requests per day
   - Perfect for development!

---

### 5. Instagram Private API Considerations

> **⚠️ IMPORTANT: Instagram API Compliance**

#### Session Management
- Instagram sessions will be stored locally in `./instagram-sessions/` directory
- Each user's Instagram session is saved as a JSON file
- Sessions persist across server restarts
- Supports 2FA authentication

#### Rate Limiting & Safety
```javascript
// Recommended settings to avoid Instagram bans
const IGConfig = {
  requestsPerMinute: 10,    // Max 10 requests/min
  delayBetweenRequests: 6000, // 6 seconds between requests
  maxRetries: 3,
  timeoutMs: 30000
};
```

#### Challenges & Limitations
- **2FA Required:** Users must enter 2FA codes via your modal
- **Session Expiry:** Sessions expire after ~90 days of inactivity
- **Checkpoint Required:** Some accounts may need checkpoint verification
- **Rate Limits:** Instagram has strict rate limits (follow recommendations above)

---

### 6. Project Structure (Recommended)

```
insta-integration/
├── backend/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   ├── instagram.js       # Instagram API config
│   │   └── gemini.js          # Gemini AI config
│   ├── models/
│   │   ├── User.js
│   │   ├── Creator.js
│   │   ├── InstagramAccount.js
│   │   ├── Analytics.js
│   │   ├── Automation.js
│   │   └── ScheduledPost.js
│   ├── services/
│   │   ├── instagram/
│   │   │   ├── InstagramService.js       # Base Instagram operations
│   │   │   ├── DMAutomationService.js    # DM automation
│   │   │   ├── PostAutomationService.js  # Post scheduling
│   │   │   └── DataSyncService.js        # Analytics sync
│   │   ├── ai/
│   │   │   └── GeminiService.js          # AI operations
│   │   └── auth/
│   │       └── AuthService.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── instagramController.js
│   │   ├── automationController.js
│   │   └── analyticsController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── instagram.js
│   │   ├── automation.js
│   │   └── analytics.js
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── helpers.js
│   ├── instagram-sessions/     # Instagram session storage
│   ├── uploads/                # Media uploads
│   ├── .env
│   ├── app.js
│   ├── server.js
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── dashboard/
    │   │   ├── automation/
    │   │   ├── analytics/
    │   │   └── common/
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── Automation.jsx
    │   │   └── Analytics.jsx
    │   ├── services/
    │   │   └── api.js          # Axios instance
    │   ├── hooks/
    │   ├── utils/
    │   ├── Base.css            # Design system
    │   ├── App.jsx
    │   └── main.jsx
    ├── .env
    ├── package.json
    └── vite.config.js
```

---

### 7. Database Models (Schema Overview)

#### Creator Model
```javascript
{
  userId: ObjectId,           // Reference to User
  username: String,
  bio: String,
  profileImage: String,
  niches: [String],
  instagramConnected: Boolean,
  analytics: ObjectId,        // Reference to Analytics
  createdAt: Date,
  updatedAt: Date
}
```

#### InstagramAccount Model
```javascript
{
  creatorId: ObjectId,
  username: String,
  userId: String,             // Instagram user ID
  sessionData: String,        // Encrypted session JSON
  isConnected: Boolean,
  lastSynced: Date,
  followerCount: Number,
  followingCount: Number,
  mediaCount: Number,
  automationSettings: {
    dmAutoReply: Boolean,
    autoPost: Boolean,
    triggers: [Object]
  }
}
```

#### Analytics Model
```javascript
{
  creatorId: ObjectId,
  instagramId: ObjectId,
  metrics: {
    followers: Number,
    engagement: Number,
    reach: Number,
    impressions: Number
  },
  posts: [{
    postId: String,
    likes: Number,
    comments: Number,
    shares: Number,
    timestamp: Date
  }],
  lastUpdated: Date
}
```

#### Automation Model
```javascript
{
  creatorId: ObjectId,
  type: String,               // 'dm' | 'post' | 'story'
  trigger: Object,
  action: Object,
  isActive: Boolean,
  lastRun: Date,
  stats: {
    executions: Number,
    successes: Number,
    failures: Number
  }
}
```

---

### 8. Testing Tools

```bash
# API Testing
npm install --save-dev jest supertest

# For testing Instagram features manually
# Create a test Instagram account (do NOT use your personal account)
```

---

### 9. Optional but Recommended

```bash
# Backend
npm install morgan          # HTTP request logger
npm install compression     # Response compression
npm install joi             # Schema validation alternative

# Frontend
npm install react-toastify  # Toast notifications
npm install framer-motion   # Animations
```

---

### 10. Development Workflow

1. **Start MongoDB:**
   ```bash
   sudo systemctl start mongod
   # or
   brew services start mongodb-community
   ```

2. **Start Backend:**
   ```bash
   cd backend
   npm start
   # Runs on http://localhost:5000
   ```

3. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   # Runs on http://localhost:5173
   ```

4. **Test API:**
   ```bash
   # Health check
   curl http://localhost:5000/api/health
   ```

---

## 🚀 Quick Start Checklist

- [ ] Install MongoDB (local or Atlas)
- [ ] Get Google Gemini API key
- [ ] Create backend `.env` file with all variables
- [ ] Create frontend `.env` file
- [ ] Install all backend dependencies
- [ ] Install all frontend dependencies
- [ ] Create Instagram test account (for development)
- [ ] Create necessary directories (`instagram-sessions/`, `uploads/`)
- [ ] Test MongoDB connection
- [ ] Test Gemini API connection
- [ ] Set up basic Express server
- [ ] Set up basic React app

---

## 📝 Important Notes

### Security
- **Never commit `.env` files** to version control
- Use strong, unique values for `JWT_SECRET` and `SESSION_SECRET`
- In production, use environment-specific secrets

### Instagram API
- Use a **test Instagram account** for development
- Enable 2FA on the test account to simulate real-world scenarios
- Respect Instagram's rate limits
- Be prepared for checkpoint challenges

### Development Tips
- Use MongoDB Compass for database visualization
- Use Postman/Insomnia for API testing
- Keep session files secure and encrypted
- Log all Instagram API interactions for debugging

---

## 🔗 Useful Links

- [Instagram Private API Docs](https://github.com/dilame/instagram-private-api)
- [MongoDB Docs](https://docs.mongodb.com/)
- [Gemini API Docs](https://ai.google.dev/docs)
- [Express.js Docs](https://expressjs.com/)
- [React Router Docs](https://reactrouter.com/)

---

**Last Updated:** December 22, 2024
