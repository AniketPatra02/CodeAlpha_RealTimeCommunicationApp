/**
 * CodeAlpha Internship - Task 4: Real-Time Communication App
 * WebRTC Signaling Server, Room Orchestration & File Transfer Pipeline
 * Author: CodeAlpha Intern
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 5003;
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// --- Helper Functions for Database Persistence ---
function readDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return { users: [], rooms: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    return false;
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_meet_salt').digest('hex');
}

function generateToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function parseToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const raw = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
    const decoded = JSON.parse(raw);
    if (decoded.exp && decoded.exp > Date.now()) return decoded;
  } catch (e) {
    return null;
  }
  return null;
}

// In-Memory Real-Time Signaling Room Registry
// roomCode -> Set of { peerId, peerName, sseRes }
const rooms = new Map();

function getOrCreateRoom(roomCode) {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, new Map());
  }
  return rooms.get(roomCode);
}

function broadcastToRoom(roomCode, senderPeerId, message) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const dataStr = `event: signal\ndata: ${JSON.stringify(message)}\n\n`;
  for (const [peerId, peer] of room.entries()) {
    if (peerId !== senderPeerId && peer.res && !peer.res.writableEnded) {
      try {
        peer.res.write(dataStr);
      } catch (e) {
        room.delete(peerId);
      }
    }
  }
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Check if Express is available
let useExpress = false;
try {
  require.resolve('express');
  useExpress = true;
} catch (e) {
  useExpress = false;
}

if (useExpress) {
  const express = require('express');
  const app = express();

  app.use(express.json({ limit: '15mb' })); // Support file sharing payload
  app.use(express.static(PUBLIC_DIR));

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  const authenticate = (req, res, next) => {
    req.user = parseToken(req.headers['authorization']);
    next();
  };

  // --- Real-Time WebRTC Signaling Hub (SSE Channel) ---
  app.get('/api/signal/stream', (req, res) => {
    const { roomCode, peerId, peerName } = req.query;
    if (!roomCode || !peerId) {
      return res.status(400).send('roomCode and peerId are required');
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('event: connected\ndata: {"status":"connected"}\n\n');

    const room = getOrCreateRoom(roomCode);

    // Announce to other peers in room
    broadcastToRoom(roomCode, peerId, {
      type: 'peer_joined',
      senderPeerId: peerId,
      peerName: peerName || 'Guest Participant'
    });

    // Send list of existing peers to newly joined client
    const existingPeers = [];
    for (const [id, peer] of room.entries()) {
      existingPeers.push({ peerId: id, peerName: peer.name });
    }
    res.write(`event: signal\ndata: ${JSON.stringify({ type: 'existing_peers', peers: existingPeers })}\n\n`);

    room.set(peerId, { name: peerName || 'Guest', res });

    req.on('close', () => {
      room.delete(peerId);
      broadcastToRoom(roomCode, peerId, {
        type: 'peer_left',
        senderPeerId: peerId
      });
      if (room.size === 0) rooms.delete(roomCode);
    });
  });

  // Relay WebRTC signals (Offers, Answers, ICE candidates, Whiteboard, Chat, File)
  app.post('/api/signal/relay', (req, res) => {
    const { roomCode, senderPeerId, targetPeerId, type, payload } = req.body;
    if (!roomCode || !senderPeerId || !type) {
      return res.status(400).json({ success: false, message: 'Invalid signal payload' });
    }

    const room = rooms.get(roomCode);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const message = { type, senderPeerId, payload, timestamp: Date.now() };

    // If targeted, send only to target peer; otherwise broadcast to room
    if (targetPeerId && room.has(targetPeerId)) {
      const target = room.get(targetPeerId);
      if (target.res && !target.res.writableEnded) {
        target.res.write(`event: signal\ndata: ${JSON.stringify(message)}\n\n`);
      }
    } else {
      broadcastToRoom(roomCode, senderPeerId, message);
    }

    res.json({ success: true });
  });

  // --- Rooms Management ---
  app.post('/api/rooms', authenticate, (req, res) => {
    const { title } = req.body;
    const db = readDb();

    // Generate readable room code e.g. "meet-842-194"
    const roomCode = 'meet-' + Math.floor(100 + Math.random() * 900) + '-' + Math.floor(100 + Math.random() * 900);

    const newRoom = {
      id: roomCode,
      title: title || 'Collaborative Video Meeting',
      hostId: req.user ? req.user.id : 'guest_host',
      hostName: req.user ? req.user.name : 'Host',
      encryption: 'DTLS-SRTP AES-128',
      createdAt: new Date().toISOString()
    };

    if (!Array.isArray(db.rooms)) db.rooms = [];
    db.rooms.unshift(newRoom);
    writeDb(db);

    res.status(201).json({ success: true, room: newRoom });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const db = readDb();
    const room = (db.rooms || []).find(r => r.id.toLowerCase() === req.params.code.toLowerCase());
    if (!room) {
      // Allow dynamic ad-hoc rooms as well
      return res.json({
        success: true,
        room: {
          id: req.params.code,
          title: 'Ad-Hoc Collaboration Room',
          encryption: 'DTLS-SRTP AES-128'
        }
      });
    }
    res.json({ success: true, room });
  });

  // --- Auth Endpoints ---
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'All fields required' });

    const db = readDb();
    if (db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const newUser = {
      id: 'usr_' + Date.now().toString(36),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      avatarUrl: 'assets/avatars/aniket.svg'
    };

    db.users.push(newUser);
    writeDb(db);
    res.status(201).json({ success: true, token: generateToken(newUser), user: newUser });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const db = readDb();
    const u = db.users.find(user => user.email.toLowerCase() === (email || '').trim().toLowerCase());

    if (!u || u.passwordHash !== hashPassword(password || '')) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    res.json({ success: true, token: generateToken(u), user: u });
  });

  app.get('/api/auth/me', authenticate, (req, res) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not logged in' });
    const db = readDb();
    const u = db.users.find(user => user.id === req.user.id);
    if (!u) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: u });
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(` CodeAlpha Task 4: Real-Time Communication App`);
    console.log(` Server running on: http://localhost:${PORT}`);
    console.log(` Framework: Express.js (WebRTC Signaling Hub active)`);
    console.log(`=================================================`);
  });

} else {
  // Built-in HTTP server fallback
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }

    const sendJson = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    const getRequestBody = (callback) => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          callback(body ? JSON.parse(body) : {});
        } catch (e) {
          sendJson(400, { success: false, message: 'Invalid JSON' });
        }
      });
    };

    const user = parseToken(req.headers['authorization']);

    // Signaling stream
    if (pathname === '/api/signal/stream' && method === 'GET') {
      const { roomCode, peerId, peerName } = parsedUrl.query;
      if (!roomCode || !peerId) {
        res.writeHead(400);
        return res.end('Missing roomCode or peerId');
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('event: connected\ndata: {"status":"connected"}\n\n');

      const room = getOrCreateRoom(roomCode);
      broadcastToRoom(roomCode, peerId, {
        type: 'peer_joined',
        senderPeerId: peerId,
        peerName: peerName || 'Guest Participant'
      });

      const existingPeers = [];
      for (const [id, peer] of room.entries()) {
        existingPeers.push({ peerId: id, peerName: peer.name });
      }
      res.write(`event: signal\ndata: ${JSON.stringify({ type: 'existing_peers', peers: existingPeers })}\n\n`);
      room.set(peerId, { name: peerName || 'Guest', res });

      req.on('close', () => {
        room.delete(peerId);
        broadcastToRoom(roomCode, peerId, { type: 'peer_left', senderPeerId: peerId });
        if (room.size === 0) rooms.delete(roomCode);
      });
      return;
    }

    // Signaling relay
    if (pathname === '/api/signal/relay' && method === 'POST') {
      return getRequestBody(body => {
        const { roomCode, senderPeerId, targetPeerId, type, payload } = body;
        const room = rooms.get(roomCode);
        if (!room) return sendJson(404, { success: false, message: 'Room not found' });

        const message = { type, senderPeerId, payload, timestamp: Date.now() };

        if (targetPeerId && room.has(targetPeerId)) {
          const target = room.get(targetPeerId);
          if (target.res && !target.res.writableEnded) {
            target.res.write(`event: signal\ndata: ${JSON.stringify(message)}\n\n`);
          }
        } else {
          broadcastToRoom(roomCode, senderPeerId, message);
        }
        return sendJson(200, { success: true });
      });
    }

    // Create room
    if (pathname === '/api/rooms' && method === 'POST') {
      return getRequestBody(body => {
        const db = readDb();
        const roomCode = 'meet-' + Math.floor(100 + Math.random() * 900) + '-' + Math.floor(100 + Math.random() * 900);
        const newRoom = {
          id: roomCode,
          title: body.title || 'Collaborative Video Meeting',
          hostId: user ? user.id : 'guest_host',
          encryption: 'DTLS-SRTP AES-128',
          createdAt: new Date().toISOString()
        };
        db.rooms.unshift(newRoom);
        writeDb(db);
        return sendJson(201, { success: true, room: newRoom });
      });
    }

    // Auth
    if (pathname === '/api/auth/login' && method === 'POST') {
      return getRequestBody(body => {
        const db = readDb();
        const found = db.users.find(u => u.email.toLowerCase() === (body.email || '').trim().toLowerCase());
        if (!found || found.passwordHash !== hashPassword(body.password || '')) {
          return sendJson(401, { success: false, message: 'Invalid credentials' });
        }
        return sendJson(200, { success: true, token: generateToken(found), user: found });
      });
    }

    // Static files
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) filePath = path.join(PUBLIC_DIR, 'index.html');
      const ext = path.extname(filePath).toLowerCase();
      fs.readFile(filePath, (e, content) => {
        if (e) {
          res.writeHead(500);
          return res.end('Error loading asset');
        }
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
        res.end(content);
      });
    });
  });

  server.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(` CodeAlpha Task 4: Real-Time Communication App`);
    console.log(` Server running on: http://localhost:${PORT}`);
    console.log(` Running mode: Standalone Node HTTP (WebRTC Signaling ready)`);
    console.log(`=================================================`);
  });
}

