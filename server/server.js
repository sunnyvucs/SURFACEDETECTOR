// server/server.js
const fs = require('fs');
const https = require('https');
const path = require('path');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');
const cors = require('cors');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 8443;
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const CERT_DIR = path.join(__dirname, 'certs');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Read SSL certs
const keyPath = path.join(CERT_DIR, 'key.pem');
const certPath = path.join(CERT_DIR, 'cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('ERROR: key.pem and cert.pem must be present in server/certs/');
  process.exit(1);
}

const sslOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Simple API: list devices (from in-memory registry)
app.get('/devices', (req, res) => {
  const list = Array.from(devices.values());
  res.json(list);
});

// Export CSV for a device & date (YYYY-MM-DD). If date omitted, today is used.
app.get('/export/:deviceId', (req, res) => {
  const deviceId = req.params.deviceId;
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const filePath = path.join(DATA_DIR, deviceId, `${date}.csv`);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'file not found', path: filePath });
  }
});

// Create HTTPS server
const httpsServer = https.createServer(sslOptions, app);

// Attach Socket.IO
const io = new Server(httpsServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// In-memory device registry: deviceId => { deviceId, ip, socketId, lastSeen, lat, lon }
const devices = new Map();

function clientIpFromSocket(socket) {
  // Prefer X-Forwarded-For if present (behind proxies)
  const xff = socket.handshake.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  // socket.handshake.address/conn.remoteAddress
  const addr = (socket.handshake.address || (socket.conn && socket.conn.remoteAddress) || '') + '';
  return addr.replace('::ffff:', '');
}

function ensureDeviceFolder(deviceId) {
  const folder = path.join(DATA_DIR, deviceId);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function appendCsv(deviceId, row) {
  try {
    const folder = ensureDeviceFolder(deviceId);
    const fileName = `${new Date().toISOString().slice(0, 10)}.csv`; // YYYY-MM-DD.csv
    const filePath = path.join(folder, fileName);
    const line = `${row.time},${row.x},${row.y},${row.z},${row.lat},${row.lon},${row.ip}\n`;
    if (!fs.existsSync(filePath)) {
      const header = 'timestamp,x,y,z,lat,lon,ip\n';
      fs.appendFileSync(filePath, header);
    }
    fs.appendFileSync(filePath, line);
  } catch (err) {
    console.error('appendCsv error', err);
  }
}

// Handle socket connections
io.on('connection', (socket) => {
  const ip = clientIpFromSocket(socket);
  const role = (socket.handshake.query && socket.handshake.query.role) || 'device';
  console.log(`[SOCKET] connected id=${socket.id} role=${role} ip=${ip}`);

  if (role === 'admin') {
    // send current device list to admin
    socket.emit('devices', Array.from(devices.values()));
  }

  socket.on('register', (payload) => {
    // payload: { deviceId? }
    let deviceId = (payload && payload.deviceId) || `dev_${uuidv4().slice(0, 8)}`;
    // store device
    const now = new Date().toISOString();
    const existing = devices.get(deviceId) || {};
    const entry = {
      deviceId,
      ip,
      socketId: socket.id,
      lastSeen: now,
      lat: existing.lat || null,
      lon: existing.lon || null
    };
    devices.set(deviceId, entry);
    // store deviceId on socket for easy lookup
    socket.data.deviceId = deviceId;
    socket.emit('registered', { deviceId });
    // notify all admins/clients about device list
    io.emit('devices', Array.from(devices.values()));
    console.log(`[REGISTER] device=${deviceId} ip=${ip}`);
  });

  socket.on('sensor-data', (payload) => {
    // payload: { deviceId, time, x, y, z, lat, lon }
    if (!payload) return;
    const deviceId = socket.data.deviceId || payload.deviceId || `dev_${uuidv4().slice(0,8)}`;
    const time = payload.time || new Date().toISOString();
    const x = typeof payload.x === 'number' ? payload.x : Number(payload.x) || 0;
    const y = typeof payload.y === 'number' ? payload.y : Number(payload.y) || 0;
    const z = typeof payload.z === 'number' ? payload.z : Number(payload.z) || 0;
    const lat = payload.lat || '';
    const lon = payload.lon || '';

    const row = { time, x, y, z, lat, lon, ip };

    // persist to CSV
    appendCsv(deviceId, row);

    // update registry
    const dev = devices.get(deviceId) || { deviceId, ip };
    dev.lastSeen = new Date().toISOString();
    dev.lat = lat;
    dev.lon = lon;
    dev.socketId = socket.id;
    devices.set(deviceId, dev);

    // broadcast sensor-data to admin clients
    io.emit('sensor-data', Object.assign({ deviceId }, row));
  });

  socket.on('disconnect', (reason) => {
    console.log(`[SOCKET] disconnected id=${socket.id} reason=${reason}`);
    // Mark device offline (keep entry but remove socketId)
    const deviceId = socket.data.deviceId;
    if (deviceId && devices.has(deviceId)) {
      const dev = devices.get(deviceId);
      dev.socketId = null;
      dev.lastSeen = new Date().toISOString();
      devices.set(deviceId, dev);
      io.emit('devices', Array.from(devices.values()));
    }
  });
});

// Start HTTPS server
httpsServer.listen(PORT, () => {
  console.log(`✅ HTTPS + Socket.IO server running at https://0.0.0.0:${PORT}`);
  console.log(`Place your client pages at ${PUBLIC_DIR}/mobile.html and admin.html`);
});
