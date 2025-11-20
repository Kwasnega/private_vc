// WebRTC Video Call Script for Kay & Cathy
// This handles all the video calling logic using pure WebRTC

// ===== CONFIGURATION =====
const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ===== GLOBAL VARIABLES =====
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let ws = null;
let role = null;
let isMicEnabled = true;
let isCameraEnabled = true;
let currentCameraIndex = 0;
let videoDevices = [];
let hasPlayedJoinSound = false;
let pulseTimeout = null;
let isPulsing = false;

// Drawing variables
let isDrawing = false;
let drawingEnabled = false;
let drawCanvas = null;
let drawCtx = null;
let lastX = 0;
let lastY = 0;

// Mood lighting variables
let moodLightingEnabled = false;
let audioContext = null;
let analyser = null;
let dataArray = null;

// Game variables
let currentGame = null;
let gameState = {};

// Watch party variables
let partyPlayer = null;
let isPartyLeader = false;

// Notes variables
let notes = [];
let noteIdCounter = 0;

// Compliments
let complimentsEnabled = true;
let compliments = [
  "You look absolutely stunning today! 💜",
  "Your smile could light up the whole room! ✨",
  "You're the best thing that's happened to me! ❤️",
  "Every moment with you is magical! 🌟",
  "You make my heart skip a beat! 💕",
  "You're more beautiful than ever! 🌹",
  "I'm so lucky to have you! 🍀",
  "You're my favorite person in the world! 🌍"
];

// Portal effect variables
let portalEnabled = false;
let motionDetectionEnabled = false;
let lastMotionTime = 0;
let remoteMotionTime = 0;
let lastPortalTime = 0;
let motionCanvas = null;
let motionCtx = null;
let previousFrame = null;
let motionDetectionInterval = null;
const PORTAL_COOLDOWN = 45000; // 45 seconds
const WAVE_SYNC_WINDOW = 1200; // 1.2 seconds

// ===== DOM ELEMENTS =====
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const localLabel = document.getElementById('localLabel');
const remoteLabel = document.getElementById('remoteLabel');
const connectionStatus = document.getElementById('connectionStatus');
const remotePlaceholder = document.getElementById('remotePlaceholder');
const toggleMicBtn = document.getElementById('toggleMic');
const toggleCameraBtn = document.getElementById('toggleCamera');
const switchCameraBtn = document.getElementById('switchCamera');
const sendPulseBtn = document.getElementById('sendPulse');
const endCallBtn = document.getElementById('endCall');
const localAvatar = document.getElementById('localAvatar');
const remoteAvatar = document.getElementById('remoteAvatar');
const joinSound = document.getElementById('joinSound');

// New feature elements
const toggleDrawBtn = document.getElementById('toggleDraw');
const clearDrawBtn = document.getElementById('clearDraw');
const toggleMoodLightingBtn = document.getElementById('toggleMoodLighting');
const gamesBtn = document.getElementById('gamesBtn');
const reactionsBtn = document.getElementById('reactionsBtn');
const watchPartyBtn = document.getElementById('watchPartyBtn');
const notesBtn = document.getElementById('notesBtn');
const togglePortalBtn = document.getElementById('togglePortal');

// ===== INITIALIZATION =====
async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  role = urlParams.get('role');

  if (role === 'caller') {
    localLabel.textContent = 'Kay';
    remoteLabel.textContent = 'Cathy';
    localAvatar.textContent = 'K';
    remoteAvatar.textContent = 'C';
  } else {
    localLabel.textContent = 'Cathy';
    remoteLabel.textContent = 'Kay';
    localAvatar.textContent = 'C';
    remoteAvatar.textContent = 'K';
  }

  // Create join sound using base64 encoded soft ding
  joinSound.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

  connectToSignalingServer();
  await getUserMedia();
  setupEventListeners();
  await getVideoDevices();
  initDrawingCanvas();
  initMotionDetection();
  loadNotes();
  
  // Show compliment on join
  if (complimentsEnabled) {
    setTimeout(() => showCompliment(), 2000);
  }
}

// ===== SEND MESSAGE SAFELY =====
function sendMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  } else {
    console.error('❌ WebSocket not ready, state:', ws?.readyState);
    return false;
  }
}

// ===== SIGNALING SERVER CONNECTION =====
function connectToSignalingServer() {
  // Auto-detect WebSocket URL based on environment
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // includes port if any
  const wsUrl = `${protocol}//${host}`;
  
  console.log('🌐 Connecting to signaling server:', wsUrl);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('✅ Connected to signaling server');
    updateConnectionStatus('Waiting for peer...');
  };

  ws.onmessage = async (event) => {
    console.log('📨 Received WebSocket message');
    
    // Handle both text and Blob data
    let data = event.data;
    if (data instanceof Blob) {
      data = await data.text();
    }
    
    const message = JSON.parse(data);
    await handleSignalingMessage(message);
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
    updateConnectionStatus('Connection error', 'disconnected');
  };

  ws.onclose = () => {
    console.log('🔌 Disconnected from signaling server');
    updateConnectionStatus('Disconnected', 'disconnected');
  };
}

// ===== HANDLE SIGNALING MESSAGES =====
async function handleSignalingMessage(message) {
  console.log('📬 Received message:', message.type);

  switch (message.type) {
    case 'connection-status':
      console.log(`👥 Client count: ${message.clientCount}`);
      
      // Both peers should prepare peer connection
      if (message.clientCount === 2 && localStream && !peerConnection) {
        console.log('🔗 Both peers connected, creating peer connection...');
        createPeerConnection();
      }
      
      if (message.clientCount === 2 && role === 'caller') {
        console.log('📞 Both peers connected, caller creating offer...');
        setTimeout(() => createOffer(), 1000);
      }
      break;
    case 'peer-joined':
      console.log('👥 Peer joined!');
      updateConnectionStatus('Peer joined, connecting...');
      
      // Both peers should create connection immediately
      if (!peerConnection && localStream) {
        console.log('🔗 Creating peer connection for both peers...');
        createPeerConnection();
      }
      
      // Wait a bit to ensure both peers are ready
      setTimeout(async () => {
        if (role === 'caller') {
          console.log('📞 I am the caller, creating offer...');
          await createOffer();
        } else {
          console.log('📱 I am the receiver, waiting for offer...');
        }
      }, 500);
      break;
    case 'peer-left':
      updateConnectionStatus('Peer disconnected', 'disconnected');
      remotePlaceholder.classList.remove('hidden');
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      break;
    case 'offer':
      await handleOffer(message.offer);
      break;
    case 'answer':
      await handleAnswer(message.answer);
      break;
    case 'ice-candidate':
      await handleIceCandidate(message.candidate);
      break;
    case 'pulse':
      receivePulse();
      break;
    case 'draw':
      handleRemoteDraw(message.data);
      break;
    case 'clearDraw':
      clearDrawingCanvas();
      break;
    case 'reaction':
      showReactionParticles(message.reaction);
      break;
    case 'game':
      handleGameMessage(message);
      break;
    case 'partyLoad':
      handlePartyLoad(message);
      break;
    case 'partyControl':
      handlePartyControl(message);
      break;
    case 'partyReact':
      showPartyReaction(message.react);
      break;
    case 'note':
      handleNoteMessage(message);
      break;
    case 'portalSync':
      handlePortalSync(message);
      break;
  }
}

// ===== GET USER MEDIA =====
async function getUserMedia() {
  try {
    console.log('🎥 Requesting camera and microphone access...');
    const constraints = {
      video: { 
        width: { ideal: 1280 }, 
        height: { ideal: 720 }, 
        facingMode: 'user' 
      },
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true, 
        autoGainControl: true 
      }
    };
    
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;
    await localVideo.play();
    
    console.log('✅ Got local stream with tracks:');
    localStream.getTracks().forEach(track => {
      console.log(`  - ${track.kind}: ${track.label} (enabled: ${track.enabled})`);
    });
  } catch (error) {
    console.error('❌ Error accessing media devices:', error);
    alert('Could not access camera/microphone. Please check permissions.');
  }
}

// ===== GET VIDEO DEVICES =====
async function getVideoDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter(device => device.kind === 'videoinput');
    console.log('Available video devices:', videoDevices.length);
  } catch (error) {
    console.error('Error getting video devices:', error);
  }
}

// ===== CREATE PEER CONNECTION =====
function createPeerConnection() {
  console.log('Creating peer connection...');
  
  if (peerConnection) {
    console.log('Peer connection already exists');
    return peerConnection;
  }
  
  peerConnection = new RTCPeerConnection(config);
  
  // Add local tracks to peer connection
  if (localStream) {
    console.log('Adding local tracks to peer connection');
    localStream.getTracks().forEach(track => {
      console.log('Adding track:', track.kind, track.enabled);
      peerConnection.addTrack(track, localStream);
    });
  } else {
    console.error('No local stream available!');
  }

  peerConnection.ontrack = (event) => {
    console.log('🎥 Received remote track:', event.track.kind, 'enabled:', event.track.enabled);
    
    if (!remoteStream) {
      remoteStream = new MediaStream();
      remoteVideo.srcObject = remoteStream;
      console.log('Created new remote stream');
    }
    
    remoteStream.addTrack(event.track);
    console.log('Remote stream tracks:', remoteStream.getTracks().length);
    
    // Explicitly play the remote video
    remoteVideo.play().then(() => {
      console.log('✅ Remote video playing successfully');
      remotePlaceholder.classList.add('hidden');
      
      // Trigger heart burst animation and play join sound when remote video successfully connects
      // Only trigger once when video track starts playing
      if (event.track.kind === 'video') {
        triggerHeartBurst();
        playJoinSound();
      }
    }).catch(error => {
      console.error('❌ Error playing remote video:', error);
    });
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('📡 Sending ICE candidate:', event.candidate.type);
      sendMessage({ type: 'ice-candidate', candidate: event.candidate });
    } else {
      console.log('✅ All ICE candidates sent');
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log('🔌 ICE connection state:', peerConnection.iceConnectionState);
    switch (peerConnection.iceConnectionState) {
      case 'connected':
      case 'completed':
        updateConnectionStatus(`Connected to ${role === 'caller' ? 'Cathy' : 'Kay'} ❤️`, 'connected');
        console.log('✅ ICE connection established!');
        break;
      case 'disconnected':
        updateConnectionStatus('Connection interrupted...', 'disconnected');
        break;
      case 'failed':
        updateConnectionStatus('Connection failed', 'disconnected');
        console.error('❌ ICE connection failed');
        break;
      case 'checking':
        updateConnectionStatus('Connecting...', '');
        console.log('🔍 Checking ICE connection...');
        break;
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('🔗 Connection state:', peerConnection.connectionState);
  };

  peerConnection.onsignalingstatechange = () => {
    console.log('📶 Signaling state:', peerConnection.signalingState);
  };

  console.log('✅ Peer connection created');
  return peerConnection;
}

// ===== CREATE OFFER =====
async function createOffer() {
  try {
    console.log('📞 Creating offer...');
    
    if (!localStream) {
      console.error('❌ No local stream available for offer');
      return;
    }
    
    if (!peerConnection) {
      createPeerConnection();
    }
    
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    
    console.log('📤 Setting local description (offer)');
    await peerConnection.setLocalDescription(offer);
    
    console.log('📡 Sending offer to peer');
    if (sendMessage({ type: 'offer', offer: offer })) {
      console.log('✅ Offer sent successfully');
    }
  } catch (error) {
    console.error('❌ Error creating offer:', error);
  }
}

// ===== HANDLE OFFER =====
async function handleOffer(offer) {
  try {
    console.log('📥 Received offer from peer');
    
    // Wait for local stream if not ready yet
    if (!localStream) {
      console.log('⏳ Waiting for local stream...');
      let attempts = 0;
      while (!localStream && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!localStream) {
        console.error('❌ Local stream still not available after waiting 10 seconds');
        return;
      }
      console.log('✅ Local stream is now ready');
    }
    
    // Ensure peer connection exists
    if (!peerConnection) {
      console.log('🔗 Creating peer connection for receiver...');
      createPeerConnection();
    }
    
    console.log('📥 Setting remote description (offer)');
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Process any pending ICE candidates
    await processPendingIceCandidates();
    
    console.log('📞 Creating answer...');
    const answer = await peerConnection.createAnswer();
    
    console.log('📤 Setting local description (answer)');
    await peerConnection.setLocalDescription(answer);
    
    console.log('📡 Sending answer to peer');
    if (sendMessage({ type: 'answer', answer: answer })) {
      console.log('✅ Answer sent successfully');
    }
  } catch (error) {
    console.error('❌ Error handling offer:', error);
  }
}

// ===== HANDLE ANSWER =====
async function handleAnswer(answer) {
  try {
    console.log('📥 Received answer from peer');
    
    if (!peerConnection) {
      console.error('❌ No peer connection exists');
      return;
    }
    
    console.log('📥 Setting remote description (answer)');
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    
    // Process any pending ICE candidates
    await processPendingIceCandidates();
    
    console.log('✅ Answer processed successfully');
  } catch (error) {
    console.error('❌ Error handling answer:', error);
  }
}

// Store pending ICE candidates
let pendingIceCandidates = [];

// ===== HANDLE ICE CANDIDATE =====
async function handleIceCandidate(candidate) {
  try {
    if (!peerConnection) {
      console.warn('⚠️ No peer connection yet, queuing ICE candidate');
      pendingIceCandidates.push(candidate);
      return;
    }
    
    if (peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added');
    } else {
      console.warn('⚠️ No remote description yet, queuing ICE candidate');
      pendingIceCandidates.push(candidate);
    }
  } catch (error) {
    console.error('❌ Error adding ICE candidate:', error);
  }
}

// ===== PROCESS PENDING ICE CANDIDATES =====
async function processPendingIceCandidates() {
  if (pendingIceCandidates.length > 0 && peerConnection && peerConnection.remoteDescription) {
    console.log(`📦 Processing ${pendingIceCandidates.length} pending ICE candidates`);
    for (const candidate of pendingIceCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ Queued ICE candidate added');
      } catch (error) {
        console.error('❌ Error adding queued ICE candidate:', error);
      }
    }
    pendingIceCandidates = [];
  }
}

// ===== TOGGLE MICROPHONE =====
function toggleMicrophone() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMicEnabled = audioTrack.enabled;
      toggleMicBtn.classList.toggle('active', !isMicEnabled);
      toggleMicBtn.querySelector('.control-icon').textContent = isMicEnabled ? '🎤' : '🔇';
      showToast(isMicEnabled ? 'Mic on' : 'Mic muted');
    }
  }
}

// ===== TOGGLE CAMERA =====
function toggleCamera() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isCameraEnabled = videoTrack.enabled;
      toggleCameraBtn.classList.toggle('active', !isCameraEnabled);
      toggleCameraBtn.querySelector('.control-icon').textContent = isCameraEnabled ? '📹' : '📷';
      
      // Toggle avatar visibility
      if (isCameraEnabled) {
        localVideo.style.display = 'block';
        localAvatar.classList.remove('visible');
        showToast('Camera on');
      } else {
        localVideo.style.display = 'none';
        localAvatar.classList.add('visible');
        showToast('Camera off');
      }
    }
  }
}

// ===== SWITCH CAMERA =====
async function switchCamera() {
  if (videoDevices.length <= 1) {
    console.log('Only one camera available');
    return;
  }
  try {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) videoTrack.stop();
    currentCameraIndex = (currentCameraIndex + 1) % videoDevices.length;
    const deviceId = videoDevices[currentCameraIndex].deviceId;
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    });
    const newVideoTrack = newStream.getVideoTracks()[0];
    localStream.removeTrack(videoTrack);
    localStream.addTrack(newVideoTrack);
    localVideo.srcObject = localStream;
    if (peerConnection) {
      const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(newVideoTrack);
    }
    showToast('Camera switched');
    console.log('Camera switched');
  } catch (error) {
    console.error('Error switching camera:', error);
  }
}

// ===== END CALL =====
function endCall() {
  // Show goodbye message
  const partnerName = role === 'caller' ? 'Cathy' : 'Kay';
  showToast(`Bye ${partnerName}, talk to you laterrr 💜`);
  
  // Wait a moment for the toast to show, then end call
  setTimeout(() => {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (peerConnection) peerConnection.close();
    if (ws) ws.close();
    window.location.href = 'index.html';
  }, 2000);
}

// ===== UPDATE CONNECTION STATUS =====
function updateConnectionStatus(text, status = '') {
  const statusText = connectionStatus.querySelector('.status-text');
  statusText.textContent = text;
  connectionStatus.classList.remove('connected', 'disconnected');
  if (status) connectionStatus.classList.add(status);
}

// ===== PLAY JOIN SOUND =====
function playJoinSound() {
  if (!hasPlayedJoinSound && joinSound) {
    joinSound.volume = 0.3;
    joinSound.play().then(() => {
      console.log('🔔 Join sound played');
      hasPlayedJoinSound = true;
    }).catch(error => {
      console.error('Error playing join sound:', error);
    });
  }
}

// ===== SHOW TOAST NOTIFICATION =====
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2700);
}

// ===== SEND PULSE =====
function sendPulse() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendMessage({ type: 'pulse' });
    console.log('💜 Pulse sent to remote peer');
  }
}

// ===== RECEIVE PULSE =====
function receivePulse() {
  const remoteWrapper = document.querySelector('.remote-video-wrapper');
  if (!remoteWrapper) return;

  let pulseOverlay = remoteWrapper.querySelector('.pulse-overlay');
  if (!pulseOverlay) {
    pulseOverlay = document.createElement('div');
    pulseOverlay.className = 'pulse-overlay';
    remoteWrapper.appendChild(pulseOverlay);
  }

  pulseOverlay.classList.remove('active');
  void pulseOverlay.offsetWidth;
  pulseOverlay.classList.add('active');

  console.log('💜 Received pulse from remote peer');

  setTimeout(() => {
    pulseOverlay.classList.remove('active');
  }, 800);
}

// ===== DRAWING CANVAS FUNCTIONS =====
function initDrawingCanvas() {
  drawCanvas = document.getElementById('drawCanvas');
  drawCtx = drawCanvas.getContext('2d');
  
  // Set canvas size
  drawCanvas.width = window.innerWidth;
  drawCanvas.height = window.innerHeight;
  
  drawCtx.strokeStyle = '#ff6b9d';
  drawCtx.lineWidth = 3;
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  
  // Resize canvas on window resize
  window.addEventListener('resize', () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = drawCanvas.width;
    tempCanvas.height = drawCanvas.height;
    tempCanvas.getContext('2d').drawImage(drawCanvas, 0, 0);
    
    drawCanvas.width = window.innerWidth;
    drawCanvas.height = window.innerHeight;
    drawCtx.drawImage(tempCanvas, 0, 0);
  });
  
  // Drawing event listeners
  drawCanvas.addEventListener('mousedown', startDrawing);
  drawCanvas.addEventListener('mousemove', draw);
  drawCanvas.addEventListener('mouseup', stopDrawing);
  drawCanvas.addEventListener('mouseout', stopDrawing);
  
  drawCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    drawCanvas.dispatchEvent(mouseEvent);
  });
  
  drawCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    drawCanvas.dispatchEvent(mouseEvent);
  });
  
  drawCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    drawCanvas.dispatchEvent(mouseEvent);
  });
}

function toggleDrawing() {
  drawingEnabled = !drawingEnabled;
  drawCanvas.classList.toggle('active', drawingEnabled);
  toggleDrawBtn.classList.toggle('active', drawingEnabled);
  clearDrawBtn.style.display = drawingEnabled ? 'flex' : 'none';
  showToast(drawingEnabled ? 'Drawing enabled' : 'Drawing disabled');
}

function startDrawing(e) {
  if (!drawingEnabled) return;
  isDrawing = true;
  [lastX, lastY] = [e.clientX, e.clientY];
}

function draw(e) {
  if (!isDrawing || !drawingEnabled) return;
  
  drawCtx.beginPath();
  drawCtx.moveTo(lastX, lastY);
  drawCtx.lineTo(e.clientX, e.clientY);
  drawCtx.stroke();
  
  // Send draw data to peer
  sendMessage({
    type: 'draw',
    data: {
      x1: lastX,
      y1: lastY,
      x2: e.clientX,
      y2: e.clientY,
      color: drawCtx.strokeStyle,
      width: drawCtx.lineWidth
    }
  });
  
  [lastX, lastY] = [e.clientX, e.clientY];
}

function stopDrawing() {
  isDrawing = false;
}

function handleRemoteDraw(data) {
  drawCtx.strokeStyle = data.color;
  drawCtx.lineWidth = data.width;
  drawCtx.beginPath();
  drawCtx.moveTo(data.x1, data.y1);
  drawCtx.lineTo(data.x2, data.y2);
  drawCtx.stroke();
}

function clearDrawingCanvas() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function clearDrawing() {
  clearDrawingCanvas();
  sendMessage({ type: 'clearDraw' });
  showToast('Drawing cleared');
}

// ===== MOOD LIGHTING FUNCTIONS =====
function toggleMoodLighting() {
  moodLightingEnabled = !moodLightingEnabled;
  toggleMoodLightingBtn.classList.toggle('active', moodLightingEnabled);
  
  if (moodLightingEnabled) {
    initMoodLighting();
    showToast('Mood lighting enabled');
  } else {
    showToast('Mood lighting disabled');
  }
}

function initMoodLighting() {
  if (!audioContext && localStream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(localStream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    updateMoodLighting();
  }
}

function updateMoodLighting() {
  if (!moodLightingEnabled || !analyser) return;
  
  analyser.getByteFrequencyData(dataArray);
  const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
  
  const gradientBg = document.querySelector('.gradient-bg');
  if (average > 50) {
    gradientBg.classList.add('mood-active');
    setTimeout(() => gradientBg.classList.remove('mood-active'), 500);
  }
  
  requestAnimationFrame(updateMoodLighting);
}

// ===== GAMES FUNCTIONS =====
function openGamesModal() {
  document.getElementById('gamesModal').classList.add('active');
}

function closeGamesModal() {
  document.getElementById('gamesModal').classList.remove('active');
  document.getElementById('gameArea').style.display = 'none';
  document.querySelector('.games-menu').style.display = 'flex';
  currentGame = null;
}

function startGame(gameType) {
  currentGame = gameType;
  document.querySelector('.games-menu').style.display = 'none';
  const gameArea = document.getElementById('gameArea');
  gameArea.style.display = 'block';
  gameArea.innerHTML = '';
  
  switch(gameType) {
    case 'rps':
      initRockPaperScissors(gameArea);
      break;
    case 'emoji':
      initEmojiRace(gameArea);
      break;
    case 'memory':
      initMemoryFlip(gameArea);
      break;
  }
}

function initRockPaperScissors(container) {
  container.innerHTML = `
    <h3 style="color: white; text-align: center;">Choose your move!</h3>
    <div style="display: flex; justify-content: center; gap: 10px;">
      <button class="game-choice-btn" data-choice="rock">🪨</button>
      <button class="game-choice-btn" data-choice="paper">📄</button>
      <button class="game-choice-btn" data-choice="scissors">✂️</button>
    </div>
    <div id="rpsResult"></div>
  `;
  
  container.querySelectorAll('.game-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const choice = btn.dataset.choice;
      sendMessage({ type: 'game', game: 'rps', action: 'choice', choice });
      gameState.myChoice = choice;
      checkRPSResult();
    });
  });
}

function initEmojiRace(container) {
  const emojis = ['😀', '😍', '🎉', '🌟', '❤️', '🔥', '⭐', '✨', '💜'];
  const targetEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  gameState.targetEmoji = targetEmoji;
  
  container.innerHTML = `
    <h3 style="color: white; text-align: center;">Click: ${targetEmoji}</h3>
    <div class="emoji-grid" id="emojiGrid"></div>
    <div id="emojiResult"></div>
  `;
  
  const grid = container.querySelector('#emojiGrid');
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      if (emoji === targetEmoji) {
        sendMessage({ type: 'game', game: 'emoji', action: 'win' });
        showGameResult('You won! 🎉');
      }
    });
    grid.appendChild(btn);
  });
}

function initMemoryFlip(container) {
  const symbols = ['❤️', '⭐', '🌟', '💜', '✨', '🎉', '🔥', '💕'];
  const cards = [...symbols, ...symbols].sort(() => Math.random() - 0.5);
  gameState.memoryCards = cards;
  gameState.flipped = [];
  gameState.matched = [];
  
  container.innerHTML = `
    <h3 style="color: white; text-align: center;">Memory Flip</h3>
    <div class="memory-grid" id="memoryGrid"></div>
    <div id="memoryResult"></div>
  `;
  
  const grid = container.querySelector('#memoryGrid');
  cards.forEach((symbol, index) => {
    const card = document.createElement('div');
    card.className = 'memory-card';
    card.dataset.index = index;
    card.dataset.symbol = symbol;
    card.textContent = '?';
    card.addEventListener('click', () => flipMemoryCard(card, index));
    grid.appendChild(card);
  });
}

function flipMemoryCard(card, index) {
  if (gameState.flipped.length >= 2 || card.classList.contains('flipped')) return;
  
  card.classList.add('flipped');
  card.textContent = card.dataset.symbol;
  gameState.flipped.push({ card, index, symbol: card.dataset.symbol });
  
  sendMessage({ type: 'game', game: 'memory', action: 'flip', index });
  
  if (gameState.flipped.length === 2) {
    setTimeout(() => {
      if (gameState.flipped[0].symbol === gameState.flipped[1].symbol) {
        gameState.flipped.forEach(f => f.card.classList.add('matched'));
        gameState.matched.push(...gameState.flipped);
        gameState.flipped = [];
        
        if (gameState.matched.length === gameState.memoryCards.length) {
          showGameResult('All matched! 🎉');
        }
      } else {
        gameState.flipped.forEach(f => {
          f.card.classList.remove('flipped');
          f.card.textContent = '?';
        });
        gameState.flipped = [];
      }
    }, 1000);
  }
}

function handleGameMessage(message) {
  if (message.game === 'rps' && message.action === 'choice') {
    gameState.theirChoice = message.choice;
    checkRPSResult();
  } else if (message.game === 'emoji' && message.action === 'win') {
    showGameResult('They won!');
  } else if (message.game === 'memory' && message.action === 'flip') {
    const card = document.querySelector(`[data-index="${message.index}"]`);
    if (card && !card.classList.contains('flipped')) {
      card.classList.add('flipped');
      card.textContent = card.dataset.symbol;
    }
  }
}

function checkRPSResult() {
  if (gameState.myChoice && gameState.theirChoice) {
    const results = {
      'rock-scissors': 'You won! 🎉',
      'paper-rock': 'You won! 🎉',
      'scissors-paper': 'You won! 🎉',
      'scissors-rock': 'They won!',
      'rock-paper': 'They won!',
      'paper-scissors': 'They won!'
    };
    
    const key = `${gameState.myChoice}-${gameState.theirChoice}`;
    const result = results[key] || "It's a tie!";
    showGameResult(result);
    gameState = {};
  }
}

function showGameResult(message) {
  const resultDiv = document.querySelector('#rpsResult, #emojiResult, #memoryResult');
  if (resultDiv) {
    resultDiv.className = 'game-result';
    resultDiv.textContent = message;
    setTimeout(() => {
      closeGamesModal();
    }, 3000);
  }
}

// ===== REACTIONS FUNCTIONS =====
function toggleReactionsMenu() {
  const menu = document.getElementById('reactionsMenu');
  const isVisible = menu.style.display === 'flex';
  menu.style.display = isVisible ? 'none' : 'flex';
}

function sendReaction(reaction) {
  sendMessage({ type: 'reaction', reaction });
  showReactionParticles(reaction, true);
  document.getElementById('reactionsMenu').style.display = 'none';
}

function showReactionParticles(reaction, isLocal = false) {
  const container = document.getElementById('reactionParticles');
  const reactionEmojis = {
    heart: '❤️',
    star: '⭐',
    sparkle: '✨',
    clap: '👏'
  };
  
  const emoji = reactionEmojis[reaction] || '❤️';
  const targetVideo = isLocal ? document.querySelector('.local-video-wrapper') : document.querySelector('.remote-video-wrapper');
  const rect = targetVideo.getBoundingClientRect();
  
  for (let i = 0; i < 8; i++) {
    const particle = document.createElement('div');
    particle.className = 'reaction-particle';
    particle.textContent = emoji;
    particle.style.left = (rect.left + Math.random() * rect.width) + 'px';
    particle.style.top = (rect.top + rect.height / 2) + 'px';
    particle.style.animationDelay = (Math.random() * 0.3) + 's';
    container.appendChild(particle);
    
    setTimeout(() => particle.remove(), 2000);
  }
}

// ===== WATCH PARTY FUNCTIONS =====
function toggleWatchParty() {
  const panel = document.getElementById('watchPartyPanel');
  const isVisible = panel.style.display === 'block';
  panel.style.display = isVisible ? 'none' : 'block';
  
  if (!isVisible) {
    isPartyLeader = role === 'caller';
  }
}

function loadPartyVideo() {
  const url = document.getElementById('watchUrl').value.trim();
  if (!url) return;
  
  const playPauseBtn = document.getElementById('playPauseVideo');
  
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    // Extract YouTube video ID
    let videoId = '';
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    }
    
    if (videoId) {
      loadYouTubeVideo(videoId);
      playPauseBtn.disabled = false;
      sendMessage({ type: 'partyLoad', url, duration: 0, isYouTube: true, videoId });
      showToast('YouTube video loaded');
    } else {
      showToast('Invalid YouTube URL');
    }
    return;
  }
  
  // Regular MP4 video
  partyPlayer = document.getElementById('partyPlayer');
  partyPlayer.src = url;
  partyPlayer.style.display = 'block';
  document.getElementById('youtubePlayer').style.display = 'none';
  playPauseBtn.disabled = false;
  
  sendMessage({ type: 'partyLoad', url, duration: 0, isYouTube: false });
  showToast('Video loaded');
}

function loadYouTubeVideo(videoId) {
  const youtubeContainer = document.getElementById('youtubePlayer');
  const mp4Player = document.getElementById('partyPlayer');
  
  mp4Player.style.display = 'none';
  youtubeContainer.style.display = 'block';
  
  // Create YouTube iframe
  youtubeContainer.innerHTML = `
    <iframe id="ytPlayer" width="100%" height="315" 
      src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}" 
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen>
    </iframe>
  `;
  
  // Initialize YouTube player API if not already loaded
  if (!window.YT) {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }
}

function togglePartyPlayPause() {
  if (!partyPlayer && !document.getElementById('ytPlayer')) return;
  
  const youtubePlayer = document.getElementById('ytPlayer');
  
  if (youtubePlayer && youtubePlayer.style.display !== 'none') {
    // YouTube player control via postMessage
    const iframe = youtubePlayer;
    const playPauseBtn = document.getElementById('playPauseVideo');
    
    if (playPauseBtn.textContent === 'Play') {
      iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      playPauseBtn.textContent = 'Pause';
      sendMessage({ type: 'partyControl', action: 'play', time: 0, isYouTube: true });
    } else {
      iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      playPauseBtn.textContent = 'Play';
      sendMessage({ type: 'partyControl', action: 'pause', time: 0, isYouTube: true });
    }
    return;
  }
  
  // Regular MP4 player
  if (!partyPlayer) return;
  
  if (partyPlayer.paused) {
    partyPlayer.play();
    sendMessage({ type: 'partyControl', action: 'play', time: partyPlayer.currentTime, isYouTube: false });
    document.getElementById('playPauseVideo').textContent = 'Pause';
  } else {
    partyPlayer.pause();
    sendMessage({ type: 'partyControl', action: 'pause', time: partyPlayer.currentTime, isYouTube: false });
    document.getElementById('playPauseVideo').textContent = 'Play';
  }
}

function togglePartyPlayPause() {
  if (!partyPlayer) return;
  
  if (partyPlayer.paused) {
    partyPlayer.play();
    sendMessage({ type: 'partyControl', action: 'play', time: partyPlayer.currentTime });
    document.getElementById('playPauseVideo').textContent = 'Pause';
  } else {
    partyPlayer.pause();
    sendMessage({ type: 'partyControl', action: 'pause', time: partyPlayer.currentTime });
    document.getElementById('playPauseVideo').textContent = 'Play';
  }
}

function handlePartyLoad(message) {
  if (message.isYouTube && message.videoId) {
    loadYouTubeVideo(message.videoId);
    document.getElementById('playPauseVideo').disabled = false;
    showToast('YouTube video loaded by peer');
  } else {
    partyPlayer = document.getElementById('partyPlayer');
    partyPlayer.src = message.url;
    partyPlayer.style.display = 'block';
    document.getElementById('youtubePlayer').style.display = 'none';
    document.getElementById('playPauseVideo').disabled = false;
    showToast('Video loaded by peer');
  }
}

function handlePartyControl(message) {
  if (message.isYouTube) {
    const iframe = document.getElementById('ytPlayer');
    if (!iframe) return;
    
    if (message.action === 'play') {
      iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      document.getElementById('playPauseVideo').textContent = 'Pause';
    } else if (message.action === 'pause') {
      iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      document.getElementById('playPauseVideo').textContent = 'Play';
    }
  } else {
    if (!partyPlayer) return;
    
    if (message.action === 'play') {
      partyPlayer.currentTime = message.time;
      partyPlayer.play();
      document.getElementById('playPauseVideo').textContent = 'Pause';
    } else if (message.action === 'pause') {
      partyPlayer.pause();
      document.getElementById('playPauseVideo').textContent = 'Play';
    } else if (message.action === 'seek') {
      partyPlayer.currentTime = message.time;
    }
  }
}

function showPartyReaction(react) {
  showToast(`Party reaction: ${react}`);
}

// ===== NOTES FUNCTIONS =====
function toggleNotes() {
  const panel = document.getElementById('notesPanel');
  const isVisible = panel.style.display === 'block';
  panel.style.display = isVisible ? 'none' : 'block';
}

function addNote() {
  const input = document.getElementById('noteInput');
  const text = input.value.trim();
  if (!text) return;
  
  const note = {
    id: Date.now() + '-' + Math.random(),
    text,
    timestamp: Date.now()
  };
  
  notes.push(note);
  saveNotes();
  renderNotes();
  input.value = '';
  
  sendMessage({ type: 'note', action: 'add', note });
}

function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  saveNotes();
  renderNotes();
  sendMessage({ type: 'note', action: 'delete', id });
}

function renderNotes() {
  const list = document.getElementById('notesList');
  list.innerHTML = '';
  
  notes.forEach(note => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${note.text}</span>
      <button onclick="deleteNote('${note.id}')">Delete</button>
    `;
    list.appendChild(li);
  });
}

function saveNotes() {
  localStorage.setItem('sharedNotes', JSON.stringify(notes));
}

function loadNotes() {
  const saved = localStorage.getItem('sharedNotes');
  if (saved) {
    notes = JSON.parse(saved);
    renderNotes();
  }
}

function exportNotes() {
  const text = notes.map(n => n.text).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'shared-notes.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Notes exported');
}

function handleNoteMessage(message) {
  if (message.action === 'add') {
    notes.push(message.note);
    saveNotes();
    renderNotes();
  } else if (message.action === 'delete') {
    notes = notes.filter(n => n.id !== message.id);
    saveNotes();
    renderNotes();
  }
}

// ===== MOTION DETECTION & PORTAL FUNCTIONS =====
function initMotionDetection() {
  motionCanvas = document.createElement('canvas');
  motionCtx = motionCanvas.getContext('2d', { willReadFrequently: true });
}

function togglePortalFeature() {
  portalEnabled = !portalEnabled;
  motionDetectionEnabled = portalEnabled;
  togglePortalBtn.classList.toggle('active', portalEnabled);
  
  if (portalEnabled) {
    startMotionDetection();
    showToast('Portal effect enabled - Wave together!');
  } else {
    stopMotionDetection();
    showToast('Portal effect disabled');
  }
}

function startMotionDetection() {
  if (motionDetectionInterval) return;
  
  motionDetectionInterval = setInterval(() => {
    detectMotion();
  }, 200); // Check every 200ms
}

function stopMotionDetection() {
  if (motionDetectionInterval) {
    clearInterval(motionDetectionInterval);
    motionDetectionInterval = null;
  }
}

function detectMotion() {
  if (!motionDetectionEnabled || !localVideo || !localVideo.videoWidth) return;
  
  // Set canvas size to match video
  if (motionCanvas.width !== localVideo.videoWidth) {
    motionCanvas.width = localVideo.videoWidth;
    motionCanvas.height = localVideo.videoHeight;
  }
  
  // Draw current frame
  motionCtx.drawImage(localVideo, 0, 0, motionCanvas.width, motionCanvas.height);
  const currentFrame = motionCtx.getImageData(0, 0, motionCanvas.width, motionCanvas.height);
  
  if (previousFrame) {
    // Calculate motion by comparing frames
    let motionPixels = 0;
    const threshold = 30; // Sensitivity threshold
    const data = currentFrame.data;
    const prevData = previousFrame.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const diff = Math.abs(data[i] - prevData[i]) + 
                   Math.abs(data[i + 1] - prevData[i + 1]) + 
                   Math.abs(data[i + 2] - prevData[i + 2]);
      
      if (diff > threshold) {
        motionPixels++;
      }
    }
    
    // Calculate motion percentage
    const totalPixels = motionCanvas.width * motionCanvas.height;
    const motionPercentage = (motionPixels / totalPixels) * 100;
    
    // Detect significant motion (wave)
    if (motionPercentage > 2) { // 2% of pixels changed
      const now = Date.now();
      
      // Rate limit motion events to once per second
      if (now - lastMotionTime > 1000) {
        lastMotionTime = now;
        sendMessage({ type: 'portalSync', ts: now });
        checkPortalSync(now);
      }
    }
  }
  
  // Store current frame for next comparison
  previousFrame = motionCtx.getImageData(0, 0, motionCanvas.width, motionCanvas.height);
}

function handlePortalSync(message) {
  remoteMotionTime = message.ts;
  checkPortalSync(lastMotionTime);
}

function checkPortalSync(myTime) {
  if (!portalEnabled || !remoteMotionTime || !myTime) return;
  
  const timeDiff = Math.abs(myTime - remoteMotionTime);
  const now = Date.now();
  
  // Check if both waved within sync window and cooldown period has passed
  if (timeDiff <= WAVE_SYNC_WINDOW && (now - lastPortalTime) > PORTAL_COOLDOWN) {
    lastPortalTime = now;
    triggerPortalEffect();
    showToast('Portal activated! 🌀✨');
  }
}

function triggerPortalEffect() {
  // Create portal effect on both video wrappers
  createPortalOnVideo('.local-video-wrapper');
  createPortalOnVideo('.remote-video-wrapper');
}

function createPortalOnVideo(selector) {
  const wrapper = document.querySelector(selector);
  if (!wrapper) return;
  
  const portal = document.createElement('div');
  portal.className = 'portal-effect';
  wrapper.appendChild(portal);
  
  // Create portal ring
  const ring = document.createElement('div');
  ring.className = 'portal-ring';
  portal.appendChild(ring);
  
  // Create particles
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'portal-particle';
    
    // Random position around the circle
    const angle = (Math.PI * 2 * i) / 20;
    const radius = 45; // percentage
    particle.style.left = `${50 + radius * Math.cos(angle)}%`;
    particle.style.top = `${50 + radius * Math.sin(angle)}%`;
    
    // Random animation delay
    particle.style.animationDelay = `${Math.random() * 0.3}s`;
    
    portal.appendChild(particle);
  }
  
  // Remove portal after animation
  setTimeout(() => {
    portal.remove();
  }, 1600);
}

// ===== COMPLIMENT FUNCTIONS =====
function showCompliment() {
  const banner = document.getElementById('complimentBanner');
  const compliment = compliments[Math.floor(Math.random() * compliments.length)];
  banner.textContent = compliment;
  banner.classList.add('active');
  
  setTimeout(() => {
    banner.classList.remove('active');
  }, 3500);
}

// ===== SETUP EVENT LISTENERS =====
function setupEventListeners() {
  toggleMicBtn.addEventListener('click', toggleMicrophone);
  toggleCameraBtn.addEventListener('click', toggleCamera);
  switchCameraBtn.addEventListener('click', switchCamera);
  endCallBtn.addEventListener('click', endCall);
  
  // Drawing controls
  toggleDrawBtn.addEventListener('click', toggleDrawing);
  clearDrawBtn.addEventListener('click', clearDrawing);
  
  // Mood lighting
  toggleMoodLightingBtn.addEventListener('click', toggleMoodLighting);
  
  // Games
  gamesBtn.addEventListener('click', openGamesModal);
  document.getElementById('closeGames').addEventListener('click', closeGamesModal);
  document.querySelectorAll('.game-btn').forEach(btn => {
    btn.addEventListener('click', () => startGame(btn.dataset.game));
  });
  
  // Reactions
  reactionsBtn.addEventListener('click', toggleReactionsMenu);
  document.querySelectorAll('.reaction-option').forEach(btn => {
    btn.addEventListener('click', () => sendReaction(btn.dataset.reaction));
  });
  
  // Watch party
  watchPartyBtn.addEventListener('click', toggleWatchParty);
  document.getElementById('closeWatchParty').addEventListener('click', () => {
    document.getElementById('watchPartyPanel').style.display = 'none';
  });
  document.getElementById('loadVideo').addEventListener('click', loadPartyVideo);
  document.getElementById('playPauseVideo').addEventListener('click', togglePartyPlayPause);
  
  // Notes
  notesBtn.addEventListener('click', toggleNotes);
  document.getElementById('closeNotes').addEventListener('click', () => {
    document.getElementById('notesPanel').style.display = 'none';
  });
  document.getElementById('addNote').addEventListener('click', addNote);
  document.getElementById('noteInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addNote();
  });
  document.getElementById('exportNotes').addEventListener('click', exportNotes);
  
  // Portal effect
  if (togglePortalBtn) {
    togglePortalBtn.addEventListener('click', togglePortalFeature);
  }
  
  // Make deleteNote global
  window.deleteNote = deleteNote;

  sendPulseBtn.addEventListener('mousedown', () => {
    if (isPulsing) return;
    pulseTimeout = setTimeout(() => {
      isPulsing = true;
      sendPulseBtn.classList.add('active');
      sendPulse();
      setTimeout(() => {
        sendPulseBtn.classList.remove('active');
        isPulsing = false;
      }, 600);
    }, 500);
  });

  sendPulseBtn.addEventListener('mouseup', () => {
    if (pulseTimeout) {
      clearTimeout(pulseTimeout);
      pulseTimeout = null;
    }
  });

  sendPulseBtn.addEventListener('mouseleave', () => {
    if (pulseTimeout) {
      clearTimeout(pulseTimeout);
      pulseTimeout = null;
    }
  });

  sendPulseBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (isPulsing) return;
    pulseTimeout = setTimeout(() => {
      isPulsing = true;
      sendPulseBtn.classList.add('active');
      sendPulse();
      setTimeout(() => {
        sendPulseBtn.classList.remove('active');
        isPulsing = false;
      }, 600);
    }, 500);
  });

  sendPulseBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (pulseTimeout) {
      clearTimeout(pulseTimeout);
      pulseTimeout = null;
    }
  });
  
  // Mobile: tap video to toggle controls visibility
  let controlsVisible = true;
  let hideControlsTimeout;
  
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    const videoContainer = document.querySelector('.video-container');
    const controlsContainer = document.querySelector('.controls-container');
    const connectionStatus = document.getElementById('connectionStatus');
    
    // Auto-hide controls after 3 seconds of inactivity
    const autoHideControls = () => {
      clearTimeout(hideControlsTimeout);
      hideControlsTimeout = setTimeout(() => {
        if (controlsVisible) {
          controlsContainer.classList.add('hidden');
          connectionStatus.style.opacity = '0';
          controlsVisible = false;
        }
      }, 3000);
    };
    
    // Tap anywhere on video to toggle controls
    videoContainer.addEventListener('click', (e) => {
      // Don't toggle if clicking on controls themselves
      if (e.target.closest('.controls-container')) return;
      
      controlsVisible = !controlsVisible;
      
      if (controlsVisible) {
        controlsContainer.classList.remove('hidden');
        connectionStatus.style.opacity = '1';
        autoHideControls();
      } else {
        controlsContainer.classList.add('hidden');
        connectionStatus.style.opacity = '0';
      }
    });
    
    // Start auto-hide timer
    autoHideControls();
    
    // Show controls when user interacts with them
    controlsContainer.addEventListener('click', () => {
      autoHideControls();
    });
  }
  
  // Show compliment on 30 minute milestone
  setTimeout(() => {
    if (complimentsEnabled) showCompliment();
  }, 30 * 60 * 1000);
  
  window.addEventListener('beforeunload', () => {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (peerConnection) peerConnection.close();
    if (ws) ws.close();
  });
}

updateConnectionStatus = (function() {
  const original = updateConnectionStatus;
  return function(text, status) {
    original(text, status);
    if (status === 'connected') {
      showToast('Connected');
    }
  };
})();

// ===== TRIGGER HEART BURST (ONE-TIME ON CONNECTION) =====
function triggerHeartBurst() {
  const container = document.getElementById('heartBurst');
  if (!container) return;
  
  const heartCount = 8; // Generate 8 hearts
  const hearts = [];
  
  console.log('💕 Triggering heart burst animation!');
  
  for (let i = 0; i < heartCount; i++) {
    const heart = document.createElement('div');
    heart.className = 'heart-burst';
    heart.textContent = '♥';
    
    // Random horizontal position (25% to 75% of container width for better centering)
    const leftPosition = 25 + Math.random() * 50;
    heart.style.left = `${leftPosition}%`;
    
    // Random delay (0-300ms)
    const delay = Math.random() * 300;
    heart.style.animationDelay = `${delay}ms`;
    
    // Slight random variation in animation duration (1.2s - 1.6s)
    const duration = 1.2 + Math.random() * 0.4;
    heart.style.animationDuration = `${duration}s`;
    
    container.appendChild(heart);
    hearts.push(heart);
  }
  
  // Clear hearts after animation completes (max 1.6s animation + 300ms max delay + 100ms buffer)
  setTimeout(() => {
    hearts.forEach(heart => heart.remove());
    console.log('💕 Heart burst animation completed and cleaned up');
  }, 2000);
}

// ===== CREATE FLOATING HEARTS =====
function createFloatingHearts() {
  const container = document.getElementById('floatingHearts');
  if (!container) return;
  
  const heartSymbols = ['💜', '💕', '💗', '💖'];
  
  setInterval(() => {
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.textContent = heartSymbols[Math.floor(Math.random() * heartSymbols.length)];
    heart.style.left = Math.random() * 100 + '%';
    heart.style.animationDuration = (Math.random() * 4 + 6) + 's';
    heart.style.animationDelay = Math.random() * 2 + 's';
    container.appendChild(heart);
    
    setTimeout(() => heart.remove(), 10000);
  }, 3000);
}

// ===== START APPLICATION =====
init();
createFloatingHearts();