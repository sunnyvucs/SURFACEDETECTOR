# SurfaceDetector

A real-time device monitoring and surface detection server built with Node.js, Express, HTTPS, and Socket.IO.

## What it does

- Registers and tracks multiple IoT/mobile devices over a secure HTTPS + WebSocket connection
- Maintains a live in-memory device registry (device ID, IP, GPS coordinates, last-seen timestamp)
- Records per-device daily activity logs as CSV files
- Provides an admin dashboard (`admin.html`) for monitoring all connected devices
- Supports mobile clients (`mobile.html`) that report their location and status in real time
- CSV export endpoint: download a device's activity log for any given date

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express |
| Real-time | Socket.IO |
| Transport | HTTPS (self-signed cert) |
| Location | Google APIs |
| Logging | Morgan |

## Project Structure

SURFACEDETECTOR/
├── server/
│   ├── server.js        ← Express + Socket.IO backend (HTTPS)
│   ├── package.json
│   ├── certs/           ← SSL cert/key (not committed)
│   └── data/            ← Per-device CSV logs (auto-created)
└── public/
├── admin.html       ← Admin monitoring dashboard
└── mobile.html      ← Mobile device client


## Setup

```bash
cd server
npm install

# Generate self-signed SSL cert (required for HTTPS + camera/geolocation on mobile)
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes

npm start
# Server runs on https://localhost:8443



API Endpoints
Method	Route	Description
GET	/devices	List all connected devices
GET	/export/:deviceId?date=YYYY-MM-DD	Download CSV log for a device
Built as a learning project exploring real-time IoT communication, WebSockets, and HTTPS on local networks.


---
