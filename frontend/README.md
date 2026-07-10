# 🐾 EcoCollar - Smart Animal Collar for Plastic Detection

A web application that simulates a smart collar for animals that detects plastic waste and alerts the municipality for cleanup.

## Features

### Smart Collar Interface
- **Real-time Scanning**: IR, NIR, and Ultrasonic sensors scan for plastic waste
- **Live Collar Status**: Battery level, signal strength, and LED indicators
- **Plastic Detection**: Simulates detection of various plastic types (PET, HDPE, PVC, etc.)
- **Alert History**: Tracks all detected plastic incidents
- **Animal Profile**: Shows animal information and current location

### Municipality Dashboard
- **Interactive Map**: Visualizes plastic hotspots with color-coded markers (Red=New, Yellow=In Progress, Green=Resolved)
- **Alert Management Table**: View, accept, resolve, and delete alerts
- **Statistics Overview**: Total alerts, pending, in progress, and resolved counts
- **Filter System**: Filter alerts by status (All, Pending, In Progress, Resolved)
- **Cleanup Scheduling**: Auto-generates cleanup schedules for detected plastic

## How It Works

1. **Automatic Scanning**: The smart collar automatically scans every 8 seconds
2. **Manual Scan**: Click "Scan Now" to trigger an immediate scan
3. **Detection Alert**: When plastic is detected, a modal appears with details
4. **Municipality Notification**: Click "Notify Municipality" to alert the city
5. **Dashboard Management**: Municipality workers can accept, resolve, and manage alerts
6. **Map Visualization**: All alerts are shown on a live map with popup details

## Tech Stack

- HTML5
- CSS3 (Custom properties, Grid, Flexbox, Animations)
- Vanilla JavaScript (ES6+)
- Leaflet.js (Interactive maps via OpenStreetMap)

## How to Run

Simply open `index.html` in any modern web browser. No server or installation required.

## Project Structure

```
smart-collar/
├── index.html          # Main application HTML
├── css/
│   └── style.css       # All styles and animations
├── js/
│   └── app.js          # Application logic
└── README.md           # This file