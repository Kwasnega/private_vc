# 💜 Kay & Cathy — Private Video Call

A beautiful, private web-based video calling website built with pure WebRTC for Kay and Cathy.

## ✨ Features

- **Private & Simple**: Just two people, no rooms, no complexity
- **Beautiful Design**: Dark theme with purple gradient, soft glows, and smooth transitions
- **Full Video Controls**: 
  - Toggle microphone
  - Toggle camera
  - Switch between cameras
  - End call
- **Responsive**: Works on desktop and mobile devices
- **Pure WebRTC**: No external libraries, clean implementation

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Camera and microphone permissions

### Installation

1. Navigate to the project directory:
```bash
cd bsff
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## 📖 How to Use

### For Kay (Caller):
1. Open `http://localhost:3000`
2. Click **"Start Call"**
3. Allow camera and microphone permissions
4. Wait for Cathy to join

### For Cathy (Receiver):
1. Open `http://localhost:3000`
2. Click **"Join Call"**
3. Allow camera and microphone permissions
4. Connect with Kay

### During the Call:
- **🎤 Microphone Button**: Toggle your microphone on/off
- **📹 Camera Button**: Toggle your camera on/off
- **🔄 Switch Camera**: Switch between front/back cameras (mobile) or multiple cameras (desktop)
- **📵 End Call**: End the call and return to the landing page

## 🏗️ Project Structure

```
bsff/
├── public/
│   ├── index.html      # Landing page
│   ├── call.html       # Video call interface
│   ├── style.css       # All styling
│   └── script.js       # WebRTC client logic
├── server.js           # WebSocket signaling server
├── package.json        # Dependencies
└── README.md          # This file
```

## 🔧 Technical Details

### WebRTC Signaling
- Simple WebSocket server relays signaling messages
- Supports only 2 concurrent connections
- Messages: offers, answers, ICE candidates

### STUN Servers
Uses Google's public STUN servers for NAT traversal:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

### Video Quality
- Ideal resolution: 1280x720
- Audio features: Echo cancellation, noise suppression, auto gain control

## 🌐 Deployment

For production deployment:

1. Update the WebSocket URL in `public/script.js`:
```javascript
const wsUrl = `wss://your-domain.com`;
```

2. Use a proper HTTPS server (required for camera/mic access)

3. Consider using a TURN server for better connectivity

## 🎨 Customization

### Colors
Edit the gradient in `public/style.css`:
```css
background: linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #533483 75%, #7b2cbf 100%);
```

### Names
Update labels in `public/script.js` in the `init()` function

## 📝 Notes

- This is a **private** application for two people only
- Requires HTTPS in production for camera/microphone access
- Works best on modern browsers with WebRTC support
- Mobile users may need to allow camera/microphone permissions

## 💖 Made with Love

A special private space for Kay & Cathy's conversations.

---

**Port**: 3000 (default)  
**Protocol**: WebSocket for signaling, WebRTC for media  
**Browser Support**: Chrome, Firefox, Safari, Edge (latest versions)