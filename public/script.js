// WebRTC Video Call Script for Kay & Elssy
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
const endCallBtn = document.getElementById('endCall');

// ===== INITIALIZATION =====
async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  role = urlParams.get('role');

  if (role === 'caller') {
    localLabel.textContent = 'Kay';
    remoteLabel.textContent = 'Elssy';
  } else {
    localLabel.textContent = 'Elssy';
    remoteLabel.textContent = 'Kay';
  }

  connectToSignalingServer();
  await getUserMedia();
  setupEventListeners();
  await getVideoDevices();
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
      if (message.clientCount === 2 && role === 'caller') {
        console.log('📞 Both peers connected, caller creating offer...');
        setTimeout(() => createOffer(), 500);
      }
      break;
    case 'peer-joined':
      console.log('👥 Peer joined!');
      updateConnectionStatus('Peer joined, connecting...');
      
      // Wait a bit to ensure both peers are ready
      setTimeout(async () => {
        if (role === 'caller') {
          console.log('📞 I am the caller, creating offer...');
          await createOffer();
        } else {
          console.log('📱 I am the receiver, waiting for offer...');
          // Receiver will create peer connection when offer arrives
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
        updateConnectionStatus(`Connected to ${role === 'caller' ? 'Elssy' : 'Kay'} ❤️`, 'connected');
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
    
    if (!localStream) {
      console.error('❌ No local stream available for answer');
      return;
    }
    
    if (!peerConnection) {
      createPeerConnection();
    }
    
    console.log('📥 Setting remote description (offer)');
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
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
    console.log('✅ Answer processed successfully');
  } catch (error) {
    console.error('❌ Error handling answer:', error);
  }
}

// ===== HANDLE ICE CANDIDATE =====
async function handleIceCandidate(candidate) {
  try {
    if (!peerConnection) {
      console.warn('⚠️ No peer connection, cannot add ICE candidate');
      return;
    }
    
    if (peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added');
    } else {
      console.warn('⚠️ Waiting for remote description before adding ICE candidate');
      // Queue the candidate to be added later
      setTimeout(() => handleIceCandidate(candidate), 100);
    }
  } catch (error) {
    console.error('❌ Error adding ICE candidate:', error);
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
    console.log('Camera switched');
  } catch (error) {
    console.error('Error switching camera:', error);
  }
}

// ===== END CALL =====
function endCall() {
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  if (peerConnection) peerConnection.close();
  if (ws) ws.close();
  window.location.href = 'index.html';
}

// ===== UPDATE CONNECTION STATUS =====
function updateConnectionStatus(text, status = '') {
  const statusText = connectionStatus.querySelector('.status-text');
  statusText.textContent = text;
  connectionStatus.classList.remove('connected', 'disconnected');
  if (status) connectionStatus.classList.add(status);
}

// ===== SETUP EVENT LISTENERS =====
function setupEventListeners() {
  toggleMicBtn.addEventListener('click', toggleMicrophone);
  toggleCameraBtn.addEventListener('click', toggleCamera);
  switchCameraBtn.addEventListener('click', switchCamera);
  endCallBtn.addEventListener('click', endCall);
  window.addEventListener('beforeunload', () => {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (peerConnection) peerConnection.close();
    if (ws) ws.close();
  });
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