# 🔐 Environment Setup Guide - Instagram Automation SAAS

## ⚡ Quick Setup (5 Minutes)

### Step 1: Generate Security Keys

Run these commands in your terminal to generate secure random keys:

```bash
# Generate JWT Secret (64 bytes)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate Session Secret (64 bytes)
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate Encryption Key for Instagram sessions (32 bytes)
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and replace the placeholder values in `backend/.env`.

---

### Step 2: MongoDB Setup

**Option A: Local Development**
```env
MONGODB_URI=mongodb://localhost:27017/creatorhub
```

**Option B: MongoDB Atlas (Recommended for Production)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string
4. Replace in backend/.env:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/creatorhub?retryWrites=true&w=majority
```

---

### Step 3: Update Frontend URL

**Development:**
```env
FRONTEND_URL=http://localhost:5173
```

**Production:**
```env
FRONTEND_URL=https://app.creatorhub.com
```

---

### Step 4: Create Required Directories

```bash
cd backend
mkdir -p instagram-sessions uploads logs
```

---

## 🚨 CRITICAL for Production

### 1. Security Keys
- **NEVER** use the same keys across different environments
- **NEVER** commit `.env` files to Git
- Generate **new unique keys** for production

### 2. MongoDB
- Use **MongoDB Atlas** or managed MongoDB for production
- Enable authentication
- Whitelist only your server IPs

### 3. Instagram Session Encryption
- The `ENCRYPTION_KEY` encrypts Instagram login sessions for ALL users
- If you lose this key, all users will need to re-login to Instagram
- **BACKUP THIS KEY SECURELY**

---

## 📋 Minimal Required Variables

### Backend `.env` (Required)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/creatorhub
JWT_SECRET=<generated-64-char-string>
SESSION_SECRET=<generated-64-char-string>
ENCRYPTION_KEY=<generated-32-char-string>
FRONTEND_URL=http://localhost:5173
```

### Frontend `.env` (Required)
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 🎯 For Multi-User SAAS

### User Isolation
- Each user's Instagram session is stored as encrypted file: `instagram-sessions/<userId>.json`
- Sessions are encrypted using `ENCRYPTION_KEY`
- Each user can connect ONLY their own Instagram account

### Rate Limiting
- Global rate limit: 100 requests per 15 minutes
- Instagram-specific: 10 requests per minute (prevents bans)
- Per-user Instagram operations are queued

### Scalability
- Session files are lightweight (< 10KB per user)
- For 10,000 users = ~100MB storage
- Use Redis for session store if scaling beyond 50,000 users

---

## 🔧 Testing the Setup

```bash
# 1. Start MongoDB
sudo systemctl start mongod

# 2. Start Backend
cd backend
npm start

# 3. Start Frontend (new terminal)
cd frontend
npm run dev

# 4. Test health endpoint
curl http://localhost:5000/api/health
```

---

## ⚠️ Common Issues

### "MongooseServerSelectionError"
- MongoDB is not running
- Fix: `sudo systemctl start mongod` or check MongoDB Atlas connection string

### "Error: secretOrPrivateKey must have a value"
- JWT_SECRET not set in `.env`
- Fix: Generate and add JWT_SECRET

### "CORS Error" in browser
- FRONTEND_URL doesn't match your actual frontend URL
- Fix: Update FRONTEND_URL in backend/.env

---

## 🚀 Production Deployment Checklist

- [ ] Generate new unique secrets for production
- [ ] Use MongoDB Atlas or managed MongoDB
- [ ] Update FRONTEND_URL to production domain
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS (SSL certificates)
- [ ] Set up server firewall rules
- [ ] Configure proper CORS origins
- [ ] Set up backup for MongoDB
- [ ] Backup ENCRYPTION_KEY securely
- [ ] Set up monitoring (optional: Sentry)
- [ ] Configure email SMTP for 2FA notifications

---

**Last Updated:** December 22, 2024
