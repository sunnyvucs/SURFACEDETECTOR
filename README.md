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

