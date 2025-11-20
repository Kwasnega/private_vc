# 🚀 Deployment Guide

## Option 1: Railway (Recommended - Free & Easy)

Railway supports WebSockets and is perfect for this app.

### Steps:

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Initialize and deploy**:
   ```bash
   cd bsff
   railway init
   railway up
   ```

4. **Get your URL**:
   ```bash
   railway domain
   ```
   This will give you a URL like: `https://your-app.railway.app`

5. **Open the URL on your phone** and test!

---

## Option 2: Render (Also Free)

1. Go to [render.com](https://render.com)
2. Sign up/Login
3. Click "New +" → "Web Service"
4. Connect your GitHub repo or upload code
5. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
6. Click "Create Web Service"
7. Wait for deployment (2-3 minutes)
8. Use the provided URL on your phone

---

## Option 3: Fly.io

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login**:
   ```bash
   fly auth login
   ```

3. **Deploy**:
   ```bash
   cd bsff
   fly launch
   fly deploy
   ```

4. **Get URL**:
   ```bash
   fly status
   ```

---

## Testing on Phone

Once deployed:

1. **Open the URL on both phones** (or phone + computer)
2. **Allow camera/microphone permissions**
3. **One person clicks "Start Call"** (Kay)
4. **Other person clicks "Join Call"** (Cathy)
5. **You should see each other!** 💜

### Important Notes:

- ✅ HTTPS is automatically provided by these platforms
- ✅ Camera/microphone will work on phones (requires HTTPS)
- ✅ WebSocket connections are supported
- ⚠️ First connection might take 10-20 seconds as server wakes up (free tier)

---

## Quick Deploy with Railway (Fastest)

```bash
# One command deployment
cd bsff
npx @railway/cli login
npx @railway/cli init
npx @railway/cli up
npx @railway/cli domain
```

Copy the domain URL and open it on your phone! 🎉