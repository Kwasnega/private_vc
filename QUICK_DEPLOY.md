# 🚀 Quick Deploy to Test on Phone

## Easiest Method: Render (No CLI needed!)

### Step 1: Push to GitHub (if not already)

```bash
cd C:\Users\SKANTECH\Desktop\bsff
git init
git add .
git commit -m "Initial commit"
# Create a repo on GitHub and push
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to **[render.com](https://render.com)** and sign up/login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account and select the `bsff` repository
4. Fill in:
   - **Name**: `kay-elssy-call`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Click **"Create Web Service"**
6. Wait 2-3 minutes for deployment
7. Copy the URL (like `https://kay-elssy-call.onrender.com`)

### Step 3: Test on Phone

1. Open the URL on both phones
2. Allow camera/microphone permissions
3. One clicks "Start Call", other clicks "Join Call"
4. Enjoy! 💜

---

## Alternative: Railway (Requires CLI)

### Install Railway CLI:
```bash
npm install -g @railway/cli
```

### Deploy:
```bash
cd C:\Users\SKANTECH\Desktop\bsff
railway login
railway init
railway up
railway domain
```

Copy the domain and test on your phone!

---

## Alternative: Glitch (Easiest - No Git needed!)

1. Go to **[glitch.com](https://glitch.com)**
2. Click **"New Project"** → **"Import from GitHub"**
3. Or click **"New Project"** → **"hello-node"**
4. Delete all files and upload your `bsff` folder contents
5. Glitch will auto-deploy
6. Click **"Share"** → Copy the live site URL
7. Test on phone!

---

## Alternative: Replit (Also Easy!)

1. Go to **[replit.com](https://replit.com)**
2. Click **"Create Repl"**
3. Choose **"Node.js"**
4. Upload your files or import from GitHub
5. Click **"Run"**
6. Copy the URL from the webview
7. Test on phone!

---

## 🎯 Recommended for You: Render

It's free, supports WebSockets, and gives you HTTPS automatically. No CLI installation needed - just use their web interface!

### Why Render?
- ✅ Free tier available
- ✅ Automatic HTTPS (required for camera/mic on phones)
- ✅ WebSocket support (required for your app)
- ✅ Easy GitHub integration
- ✅ Auto-deploys on git push

---

## Troubleshooting

**If camera doesn't work on phone:**
- Make sure you're using HTTPS (all platforms above provide this)
- Check browser permissions for camera/microphone
- Try Chrome or Safari on mobile

**If connection fails:**
- Check browser console for errors (F12 on desktop)
- Make sure both people are on the deployed URL (not localhost)
- Wait 10-20 seconds for free tier servers to wake up

**If you see "peer joined" but no video:**
- Check the browser console logs
- Both users should allow camera/microphone permissions
- Try refreshing both pages