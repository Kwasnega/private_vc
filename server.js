// Simple WebSocket signaling server for Kay & Cathy's private video calls
// This server just relays WebRTC signaling messages between two peers

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Create HTTP server to serve static files
const server = http.createServer((req, res) => {
  // Parse URL to remove query parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Determine file path (without query parameters)
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.join(__dirname, 'public', filePath);

  // Determine content type
  const extname = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json'
  };
  const contentType = contentTypes[extname] || 'text/plain';

  // Read and serve file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients (max 2: Kay and Cathy)
let clients = [];

wss.on('connection', (ws) => {
  console.log('New connection established');

  // Add client to list
  clients.push(ws);
  console.log(`Total clients: ${clients.length}`);

  // Send connection status to client
  ws.send(JSON.stringify({
    type: 'connection-status',
    clientCount: clients.length
  }));

  // Notify other client that someone joined
  clients.forEach(client => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'peer-joined',
        clientCount: clients.length
      }));
    }
  });

  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message type:', data.type);

      // Relay message to the other peer
      clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
    clients = clients.filter(client => client !== ws);
    console.log(`Total clients: ${clients.length}`);

    // Notify remaining client
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'peer-left',
          clientCount: clients.length
        }));
      }
    });
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🎥 Kay & Cathy's Private Call Server running on port ${PORT}`);
  console.log(`💜 Waiting for connections...`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});