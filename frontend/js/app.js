/* ============================================================
   EcoCollar Bun.sh-Inspired Theme Core Controller (v3.1)
   Landing Page Coordinator, Benchmarks, & Interactive APIs
   ============================================================ */

// --- CONFIGURATION ---
const CONFIG = {
    scanInterval: 8000,
    serverUrl: "http://127.0.0.1:8000",
    locations: [
        { name: 'Central Park, Sector 7', lat: 28.6139, lng: 77.2090 },
        { name: 'India Gate, New Delhi', lat: 28.6129, lng: 77.2295 },
        { name: 'Lodhi Garden', lat: 28.5930, lng: 77.2195 },
        { name: 'Nehru Park', lat: 28.5960, lng: 77.2360 },
        { name: 'Sanjay Van', lat: 28.5400, lng: 77.1850 },
        { name: 'Qutub Minar Area', lat: 28.5244, lng: 77.1855 },
        { name: 'Deer Park, Hauz Khas', lat: 28.5560, lng: 77.1980 },
        { name: 'Buddha Jayanti Park', lat: 28.5740, lng: 77.1640 }
    ],
    plasticTypes: [
        'PET - Bottle', 'HDPE - Container', 'PVC - Pipe Fragment',
        'LDPE - Plastic Bag', 'PP - Food Wrapper', 'PS - Foam Fragment',
        'Single-use Plastic Bag', 'Plastic Bottle Cap',
        'Plastic Straw', 'Food Packaging Film'
    ],
    severities: ['Low', 'Medium', 'High']
};

// --- GLOBAL STATE ---
const state = {
    alerts: [],
    fleet: [],
    smsLogs: [],
    stats: {},
    activeCollarId: "EC-2024-0042",
    weather: { condition: "sunny", temp: 36 },
    weatherRates: { sunny: 0.5, cloudy: 0.1, night: -0.2 },
    isScanning: false,
    map: null,
    animalMarkers: {},
    alertMarkers: {},
    routePath: null,
    heatmapCircles: [],
    userRole: null, // "admin" or "worker"
    logs: [],
    tourStep: 0,
    activePopupAlert: null,
    feedSource: "sim", // "sim" or "esp32"
    esp32Url: "http://192.168.31.85:81/stream",
    esp32SnapshotMode: false,
    esp32SnapshotIntervalId: null
};

// --- UTILITY CLASS ---
const Utils = {
    randomBetween: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    randomItem: arr => arr[Math.floor(Math.random() * arr.length)],
    generateId: () => 'EC-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
    getTimestamp: () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    getDate: () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
};

// --- API FETCH ROUTINES ---
const API = {
    async request(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            return await response.json();
        } catch (e) {
            console.error(`API Failure [${url}]:`, e);
            return null;
        }
    },
    async getAlerts() { return await this.request('/api/alerts') || []; },
    async getFleet() { return await this.request('/api/fleet') || []; },
    async getSMS() { return await this.request('/api/sms') || []; },
    async getStats() { return await this.request('/api/stats') || {}; },
    async login(username, password) {
        return await this.request('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
    },
    async addAlert(alert) {
        return await this.request('/api/alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert)
        });
    },
    async deployCrews(ids) {
        return await this.request('/api/deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
    },
    async resolveAlert(alertId, file) {
        const formData = new FormData();
        formData.append("alertId", alertId);
        formData.append("image", file);
        return await this.request('/api/resolve', {
            method: 'POST',
            body: formData
        });
    },
    async getCustomerStats() { return await this.request('/api/customer/stats') || {}; },
    async requestSweep(location, lat, lng) {
        return await this.request('/api/sweeps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_id: "cust-101", location, lat, lng })
        });
    },
    async submitCitizenReport(location, lat, lng, file) {
        const formData = new FormData();
        formData.append("location", location);
        formData.append("lat", lat);
        formData.append("lng", lng);
        formData.append("image", file);
        return await this.request('/api/citizen-report', {
            method: 'POST',
            body: formData
        });
    }
};

// ============================================================
// APP CONTROLLER
// ============================================================
const App = {
    async init() {
        this.initClipboard();
        Terminal.init();
        Emulator.init();
        Slider.init();
        Tour.init();
        
        // Load static elements and GIS
        await this.syncWithServer();
        this.initMap();
        
        // Start loops
        setInterval(() => this.syncWithServer(), 4500);
        setInterval(() => this.simulateRoaming(), CONFIG.scanInterval);
        
        this.syncWeather();
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
    },

    initClipboard() {
        const pill = document.getElementById('installPill');
        const copyBtn = document.getElementById('copyInstallBtn');
        const cmd = "curl -sS http://localhost:8000/api/alerts | jq";

        const performCopy = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(cmd).then(() => {
                document.getElementById('copyIcon').textContent = "✔";
                this.notify("📋 Command copied to clipboard!");
                setTimeout(() => {
                    document.getElementById('copyIcon').textContent = "📋";
                }, 2000);
            });
        };

        pill.addEventListener('click', performCopy);
        copyBtn.addEventListener('click', performCopy);
    },

    async syncWithServer() {
        state.alerts = await API.getAlerts();
        state.fleet = await API.getFleet();
        state.smsLogs = await API.getSMS();
        state.stats = await API.getStats();

        // Update sections
        this.renderStatsStrip();
        this.renderAdminTable();
        this.renderSMSLogs();
        this.renderFleetMonitor();
        this.renderBeforeAfterGallery();
        this.renderWorkerTasks();
        this.updateMapElements();
    },

    updateTime() {
        const pt = document.getElementById('phoneTime');
        if (pt) {
            pt.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
    },

    async syncWeather() {
        try {
            const response = await fetch('https://wttr.in/Delhi?format=j1');
            const data = await response.json();
            const temp = data.current_condition[0].temp_C;
            const desc = data.current_condition[0].weatherDesc[0].value.toLowerCase();
            
            let condition = "sunny";
            let icon = "☀️";
            if (desc.includes("rain") || desc.includes("shower") || desc.includes("storm")) {
                condition = "night";
                icon = "🌧️";
            } else if (desc.includes("cloud") || desc.includes("overcast") || desc.includes("mist")) {
                condition = "cloudy";
                icon = "⛅";
            }
            
            state.weather = { condition, temp };
            document.getElementById('weatherIcon').textContent = icon;
            document.getElementById('weatherTemp').textContent = `${temp}°C`;
            
            Terminal.log(`INFO`, `Live weather sync'd: New Delhi, ${temp}°C, ${desc}.`);
        } catch (e) {
            state.weather = { condition: "sunny", temp: 30 };
            document.getElementById('weatherIcon').textContent = "☀️";
            document.getElementById('weatherTemp').textContent = "30°C";
        }
    },

    renderStatsStrip() {
        document.getElementById('statsWeight').textContent = state.stats.weight || "0.0";
        document.getElementById('statsCO2').textContent = state.stats.co2 || "0.0";
        document.getElementById('statsArea').textContent = state.stats.area || "0";
    },

    renderBeforeAfterGallery() {
        const grid = document.getElementById('galleryGrid');
        const resolvedAlerts = state.alerts.filter(a => a.status === 'resolved');
        
        if (resolvedAlerts.length === 0) {
            grid.innerHTML = `
                <div class="gallery-empty-state">
                    <span class="gallery-empty-icon">🧹</span>
                    <p>No verified cleanups reported yet. Awaiting worker uploads...</p>
                </div>`;
            return;
        }

        grid.innerHTML = '';
        resolvedAlerts.forEach(a => {
            const container = document.createElement('div');
            container.className = 'gallery-item';
            container.innerHTML = `
                <div class="slider-container" data-alert="${a.id}">
                    <img src="${a.after_img}" class="img-before" alt="After Cleaned">
                    <div class="after-wrapper">
                        <img src="images/plastic-alert-default.png" class="img-after" alt="Before Littered">
                    </div>
                    <div class="slider-handle"></div>
                </div>
                <div class="gallery-item-meta">
                    <h4>📍 ${a.location}</h4>
                    <p>Found by ${a.animalEmoji} ${a.animalName} · Cleared on ${a.date}</p>
                </div>
            `;
            grid.appendChild(container);
            Slider.attach(container.querySelector('.slider-container'));
        });
    },

    renderAdminTable() {
        const tbody = document.getElementById('adminTableTbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const activeFilterBtn = document.querySelector('.table-filters .filter-btn.active');
        const filter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'all';
        const filtered = filter === 'all' ? state.alerts : state.alerts.filter(a => a.status === filter);

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-row" style="text-align:center;padding:32px;color:var(--text-secondary);">
                        <span class="empty-row-icon" style="font-size:24px;display:block;">📋</span>
                        <p>No alerts in database matching "${filter}".</p>
                    </td>
                </tr>`;
            return;
        }

        filtered.forEach(a => {
            const statusClass = a.status === 'pending' ? 'status-badge-pending' :
                                a.status === 'in-progress' ? 'status-badge-progress' : 'status-badge-resolved';
            const statusText = a.status === 'pending' ? 'Pending' :
                              a.status === 'in-progress' ? 'Active' : 'Done';
                              
            const sevEmoji = a.severity === 'High' ? '🔴' : a.severity === 'Medium' ? '🟡' : '🟢';

            let actionBtn = '';
            if (a.status === 'pending') {
                actionBtn = `<button class="btn-action accept" onclick="AdminConsole.deployCrew('${a.id}')">Deploy</button>`;
            } else if (a.status === 'in-progress') {
                actionBtn = `<span class="severity-medium">Dispatched</span>`;
            } else {
                actionBtn = `<span class="severity-low">Completed ✓</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><small class="font-mono">${a.id.slice(0, 8)}</small></td>
                <td>${a.animal_emoji} ${a.animal_name}</td>
                <td>${a.plastic_type}</td>
                <td><small>${a.lat.toFixed(4)}°N, ${a.lng.toFixed(4)}°E</small></td>
                <td class="severity-${a.severity.toLowerCase()}">${sevEmoji} ${a.severity}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderSMSLogs() {
        const feed = document.getElementById('smsLogFeed');
        if (!feed) return;
        
        if (state.smsLogs.length === 0) {
            feed.innerHTML = `<div class="sms-empty">No SMS alerts generated yet.</div>`;
            return;
        }

        feed.innerHTML = '';
        state.smsLogs.forEach(l => {
            const item = document.createElement('div');
            item.className = 'sms-log-item';
            item.innerHTML = `<span>[${l.timestamp}]</span>To: ${l.recipient} — ${l.message}`;
            feed.appendChild(item);
        });
    },

    renderFleetMonitor() {
        const list = document.getElementById('fleetList');
        if (!list) return;
        list.innerHTML = '';

        state.fleet.forEach(f => {
            const item = document.createElement('div');
            item.className = `fleet-item ${state.activeCollarId === f.collar_id ? 'active-select' : ''}`;
            item.onclick = () => {
                state.activeCollarId = f.collar_id;
                document.getElementById('collarSelect').value = f.collar_id;
                Emulator.onCollarSelectChange();
                App.syncWithServer();
            };

            const batteryClass = f.battery < 25 ? 'severity-high' : f.battery < 50 ? 'severity-medium' : 'severity-low';

            item.innerHTML = `
                <div class="fleet-avatar">${f.animal_emoji}</div>
                <div class="fleet-meta">
                    <strong>${f.animal_name} (${f.animal_type})</strong>
                    <span>ID: <small class="font-mono">${f.collar_id}</small></span>
                </div>
                <div class="fleet-battery-status ${batteryClass}">
                    🔋 ${f.battery}%
                </div>
            `;
            list.appendChild(item);
        });
        
        const countBadge = document.getElementById('fleetOnlineCount');
        if (countBadge) {
            countBadge.textContent = `${state.fleet.filter(f => f.status === 'online').length} Nodes`;
        }
    },

    renderWorkerTasks() {
        const list = document.getElementById('phoneTaskList');
        if (!list) return;
        list.innerHTML = '';

        const activeDispatches = state.alerts.filter(a => a.status === 'in-progress');

        if (activeDispatches.length === 0) {
            list.innerHTML = `
                <div class="gallery-empty-state" style="padding:16px;">
                    <span class="gallery-empty-icon" style="font-size:24px;">🏖️</span>
                    <p style="font-size:10px;">No active dispatches.</p>
                </div>`;
            return;
        }

        activeDispatches.forEach(a => {
            const card = document.createElement('div');
            card.className = 'phone-task-card';
            card.onclick = () => WorkerPortal.showUploadForm(a);
            card.innerHTML = `
                <div class="pt-head">
                    <span>Task: ${a.id.slice(0, 8)}</span>
                    <span class="pt-active">Active</span>
                </div>
                <div class="pt-body">
                    <strong>📍 Location:</strong> ${a.location}<br>
                    <strong>🥤 Material:</strong> ${a.plastic_type}<br>
                    <strong>⚠️ Severity:</strong> ${a.severity}
                </div>
            `;
            list.appendChild(card);
        });
    },

    // --- LEAFLET MAP COORDINATION ---
    initMap() {
        state.map = L.map('map', {
            center: [28.6139, 77.2090],
            zoom: 12,
            zoomControl: false
        });

        // Dark Vector Tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OSM &copy; CARTO',
            maxZoom: 19
        }).addTo(state.map);

        L.control.zoom({ position: 'bottomright' }).addTo(state.map);

        // General map double click coordinate copy for citizen reporting
        state.map.on('dblclick', (e) => {
            if (state.userRole !== 'customer') {
                const lat = e.latlng.lat;
                const lng = e.latlng.lng;
                document.getElementById('citizenLat').value = lat.toFixed(4);
                document.getElementById('citizenLng').value = lng.toFixed(4);
                document.getElementById('citizenLocation').focus();
                App.notify(`✔ Coordinates copied: [${lat.toFixed(4)}, ${lng.toFixed(4)}]. Attach a photo and submit report!`);
            }
        });
    },

    updateMapElements() {
        if (!state.map) return;

        // 1. Draw Stray Animal Markers
        state.fleet.forEach(f => {
            if (!state.animalMarkers[f.collar_id]) {
                const pulseColor = f.collar_id === state.activeCollarId ? '#f97316' : '#0ea5e9';
                const icon = L.divIcon({
                    html: `
                        <div style="position:relative; width:34px; height:34px; border:2px solid ${pulseColor}; border-radius:50%; background:#000; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 0 10px ${pulseColor}66;">
                            ${f.animal_emoji}
                            <div style="position:absolute; width:100%; height:100%; border:2px solid ${pulseColor}; border-radius:50%; top:-2px; left:-2px; animation: pulseMarker 2s infinite;"></div>
                        </div>`,
                    className: 'custom-leaflet-icon',
                    iconSize: [34, 34],
                    iconAnchor: [17, 17]
                });

                state.animalMarkers[f.collar_id] = L.marker([f.lat, f.lng], { icon }).addTo(state.map);
                state.animalMarkers[f.collar_id].bindPopup(`<strong>🐾 Tracker: ${f.animal_name} (${f.animal_type})</strong>`);
            } else {
                state.animalMarkers[f.collar_id].setLatLng([f.lat, f.lng]);
            }
        });

        // 2. Draw Alerts Markers
        for (let aid in state.alertMarkers) {
            state.map.removeLayer(state.alertMarkers[aid]);
        }
        state.alertMarkers = {};

        const filter = document.getElementById('heatmapToggle').checked ? 'disabled' : 'enabled';
        
        if (filter === 'enabled') {
            state.alerts.forEach(a => {
                const isSweep = a.plastic_type === "Priority Area Sweep";
                const color = isSweep ? "#a855f7" : (a.status === 'pending' ? varColor('--coral') :
                              a.status === 'in-progress' ? varColor('--accent') : varColor('--mint'));

                const circle = L.circleMarker([a.lat, a.lng], {
                    radius: isSweep ? 9 : 8,
                    fillColor: color,
                    color: '#fff',
                    weight: 1.5,
                    opacity: 1,
                    fillOpacity: 0.85
                }).addTo(state.map);

                const statusLabel = isSweep ? '✨ PRIORITY CLIENT SWEEP' :
                                    (a.status === 'pending' ? '🚨 PENDING ALERT' :
                                     a.status === 'in-progress' ? '🚛 DISPATCHED (Active)' : '✅ RESOLVED (Cleaned)');

                circle.bindPopup(`
                    <div style="font-family:sans-serif;font-size:11px;min-width:180px;">
                        <strong style="color:${color};font-size:12px;">${statusLabel}</strong><br>
                        <strong>Material:</strong> ${a.plastic_type}<br>
                        <strong>Location:</strong> ${a.location}<br>
                        <strong>Reporter:</strong> ${a.animal_emoji} ${a.animal_name}<br>
                        <strong>Time:</strong> ${a.time} · ${a.date}
                    </div>
                `);

                state.alertMarkers[a.id] = circle;
            });
        }

        // 3. Draw Heatmap Circles
        state.heatmapCircles.forEach(c => state.map.removeLayer(c));
        state.heatmapCircles = [];

        if (document.getElementById('heatmapToggle').checked) {
            const heatpoints = {};
            state.alerts.forEach(a => {
                const key = `${a.lat.toFixed(3)},${a.lng.toFixed(3)}`;
                heatpoints[key] = (heatpoints[key] || 0) + 1;
            });

            for (let kp in heatpoints) {
                const [lat, lng] = kp.split(',').map(Number);
                const count = heatpoints[kp];
                const radialCircle = L.circle([lat, lng], {
                    radius: 200 + (count * 150),
                    fillColor: varColor('--coral'),
                    color: 'transparent',
                    fillOpacity: Math.min(0.7, 0.2 + (count * 0.15))
                }).addTo(state.map);
                state.heatmapCircles.push(radialCircle);
            }
        }

        // 4. Draw Route lines
        if (state.routePath) state.map.removeLayer(state.routePath);
        state.routePath = null;

        if (document.getElementById('routingToggle').checked) {
            const activeCoords = state.alerts
                .filter(a => a.status === 'in-progress')
                .map(a => [a.lat, a.lng]);
                
            if (activeCoords.length > 1) {
                const sorted = [activeCoords[0]];
                const remaining = activeCoords.slice(1);
                
                while (remaining.length > 0) {
                    const current = sorted[sorted.length - 1];
                    let minIdx = 0;
                    let minDist = Infinity;
                    for (let i = 0; i < remaining.length; i++) {
                        const dist = Math.hypot(current[0] - remaining[i][0], current[1] - remaining[i][1]);
                        if (dist < minDist) {
                            minDist = dist;
                            minIdx = i;
                        }
                    }
                    sorted.push(remaining.splice(minIdx, 1)[0]);
                }

                state.routePath = L.polyline(sorted, {
                    color: varColor('--accent'),
                    weight: 3,
                    opacity: 0.9,
                    dashArray: '8, 8'
                }).addTo(state.map);
            }
        }
    },

    simulateRoaming() {
        if (!state.map) return;
        
        state.fleet.forEach(f => {
            f.lat += (Math.random() - 0.5) * 0.002;
            f.lng += (Math.random() - 0.5) * 0.002;
            
            f.lat = Math.max(28.500, Math.min(f.lat, 28.650));
            f.lng = Math.max(77.100, Math.min(f.lng, 77.300));
        });
        
        // Sonar sweep pulse
        const active = state.fleet.find(f => f.collar_id === state.activeCollarId);
        if (active && state.map) {
            const sweepRing = L.circle([active.lat, active.lng], {
                radius: 10,
                color: varColor('--accent'),
                weight: 2,
                fill: false,
                opacity: 0.9
            }).addTo(state.map);
            
            let radius = 10;
            const sweepInterval = setInterval(() => {
                radius += 80;
                sweepRing.setRadius(radius);
                sweepRing.setStyle({ opacity: 1 - (radius / 1200) });
                if (radius >= 1200) {
                    clearInterval(sweepInterval);
                    state.map.removeLayer(sweepRing);
                }
            }, 50);
        }
    },

    notify(message) {
        const toast = document.createElement('div');
        toast.className = 'notification';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.4s';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }
};

function varColor(variableName) {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

// ============================================================
// RETRO TELEMETRY LOG ENGINE
// ============================================================
const Terminal = {
    init() {
        document.getElementById('consoleSearch').addEventListener('input', () => this.filterOutput());
        document.getElementById('consoleFilterLevel').addEventListener('change', () => this.filterOutput());
        
        this.log(`INFO`, `EcoCollar Telemetry Framework V3.1.0 activated.`);
        this.log(`INFO`, `Direct SQLite interface established.`);
        this.log(`HARDWARE`, `ESP32-CAM optical sensor initialized.`);
        this.log(`HARDWARE`, `Vibration Deterrent Actuators ready.`);
        
        setInterval(() => this.generateLogs(), 3500);
    },

    log(level, message) {
        const entry = {
            timestamp: timeStr(),
            level,
            message
        };
        state.logs.push(entry);
        this.writeLine(entry);
    },

    writeLine(log) {
        const feed = document.getElementById('consoleOutputFeed');
        if (!feed) return;
        
        const line = document.createElement('div');
        line.className = `console-line ${log.level.toLowerCase()}`;
        line.textContent = `[${log.timestamp}] [${log.level}] ${log.message}`;
        feed.appendChild(line);
        feed.scrollTop = feed.scrollHeight;
    },

    generateLogs() {
        const active = state.fleet.find(f => f.collar_id === state.activeCollarId);
        if (!active) return;

        const logType = Utils.randomItem(['GPS', 'HARDWARE', 'INFO']);
        let msg = "";
        
        if (logType === 'GPS') {
            msg = `Node coordinates: ${active.lat.toFixed(5)}, ${active.lng.toFixed(5)} (HDOP: 0.8)`;
        } else if (logType === 'HARDWARE') {
            const solarRate = state.weatherRates[state.weather.condition];
            msg = `Battery: ${active.battery}%. Solar charging current: ${solarRate > 0 ? '+' + solarRate + '%/s' : '0.0%/s'}`;
        } else {
            msg = `IR Sensor readings: ${Utils.randomBetween(80, 240)} / 1024. Noise filtering: active.`;
        }

        this.log(logType, msg);
    },

    filterOutput() {
        const feed = document.getElementById('consoleOutputFeed');
        if (!feed) return;
        feed.innerHTML = '';

        const search = document.getElementById('consoleSearch').value.toLowerCase();
        const level = document.getElementById('consoleFilterLevel').value;

        state.logs.forEach(l => {
            const matchesSearch = l.message.toLowerCase().includes(search) || l.level.toLowerCase().includes(search);
            const matchesLevel = level === 'ALL' || l.level === level;

            if (matchesSearch && matchesLevel) {
                this.writeLine(l);
            }
        });
    }
};

function timeStr() { return new Date().toLocaleTimeString('en-US', { hour12: false }); }

// ============================================================
// CAMERA HUD EMULATOR VIEWPORT
// ============================================================
const Emulator = {
    init() {
        document.getElementById('collarSelect').addEventListener('change', () => this.onCollarSelectChange());
        document.getElementById('manualScanBtn').addEventListener('click', () => this.executeScan());
        
        this.canvas = document.getElementById('camCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Feed Source Toggle controls
        document.querySelectorAll('.feed-source-selector .source-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.feed-source-selector .source-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                });
                btn.classList.add('active');
                btn.style.background = 'var(--accent)';
                btn.style.color = '#fff';

                const src = btn.dataset.source;
                state.feedSource = src;
                
                const canvas = document.getElementById('camCanvas');
                const img = document.getElementById('esp32StreamImg');
                const settings = document.getElementById('esp32Settings');
                const marker = document.getElementById('camSourceMarker');
                const fpsText = document.getElementById('camFpsText');
                const codecText = document.getElementById('camCodecText');

                if (src === 'esp32') {
                    settings.style.display = 'flex';
                    canvas.style.display = 'none';
                    img.style.display = 'block';
                    img.src = state.esp32Url;
                    marker.textContent = "ESP32 STREAM";
                    fpsText.textContent = "MJPEG Feed / 24 FPS";
                    codecText.textContent = "HTTP / 192.168.31.85";
                    Terminal.log(`INFO`, `Switching to physical ESP32-CAM stream: ${state.esp32Url}`);
                    this.toggleSnapshotLoop(state.esp32SnapshotMode);
                } else {
                    this.toggleSnapshotLoop(false);
                    settings.style.display = 'none';
                    img.style.display = 'none';
                    img.src = '';
                    canvas.style.display = 'block';
                    marker.textContent = "SIM STREAM";
                    fpsText.textContent = "15 FPS / 350 Kbps";
                    codecText.textContent = "H.264 / EdgeML";
                    Terminal.log(`INFO`, `Switching to simulated HUD camera feed.`);
                }
            });
        });
        
        document.getElementById('applyEsp32UrlBtn').addEventListener('click', () => {
            const url = document.getElementById('esp32UrlInput').value.trim();
            if (url) {
                state.esp32Url = url;
                if (state.feedSource === 'esp32') {
                    if (state.esp32SnapshotMode) {
                        this.toggleSnapshotLoop(true);
                    } else {
                        document.getElementById('esp32StreamImg').src = url;
                    }
                }
                Terminal.log(`INFO`, `Updated physical ESP32 stream URL to: ${url}`);
                App.notify("✔ ESP32 Stream URL applied!");
            }
        });

        document.getElementById('esp32SnapshotMode').addEventListener('change', (e) => {
            state.esp32SnapshotMode = e.target.checked;
            this.toggleSnapshotLoop(state.esp32SnapshotMode);
        });

        this.drawCameraFeed();
    },

    toggleSnapshotLoop(active) {
        if (state.esp32SnapshotIntervalId) {
            clearInterval(state.esp32SnapshotIntervalId);
            state.esp32SnapshotIntervalId = null;
        }

        if (active && state.feedSource === 'esp32' && state.esp32SnapshotMode) {
            const img = document.getElementById('esp32StreamImg');
            // Seed first immediately, then interval
            img.src = `${state.esp32Url}${state.esp32Url.includes('?') ? '&' : '?'}t=${Date.now()}`;
            state.esp32SnapshotIntervalId = setInterval(() => {
                img.src = `${state.esp32Url}${state.esp32Url.includes('?') ? '&' : '?'}t=${Date.now()}`;
            }, 250);
            Terminal.log(`INFO`, `Snapshot auto-refresh loop active (250ms).`);
        } else {
            const img = document.getElementById('esp32StreamImg');
            if (state.feedSource === 'esp32' && img) {
                img.src = state.esp32Url;
            }
        }
    },

    onCollarSelectChange() {
        state.activeCollarId = document.getElementById('collarSelect').value;
        const col = state.fleet.find(f => f.collar_id === state.activeCollarId);
        
        Terminal.log(`INFO`, `Focus tracker shifted: ${col.animal_name} (${col.collar_id}).`);
        App.renderFleetMonitor();
        this.updateHardwareUI(col);
    },

    updateHardwareUI(col) {
        document.getElementById('batteryPercentText').textContent = `${col.battery}%`;
        document.getElementById('batteryFillBar').style.width = `${col.battery}%`;

        const rate = state.weatherRates[state.weather.condition];
        const statusText = rate > 0 ? `High (+${rate}%/s)` : rate === 0 ? `Idle (0.0%/s)` : `None (${rate}%/s)`;
        document.getElementById('solarRateText').textContent = statusText;
        
        if (rate > 0) {
            document.getElementById('solarBadge').style.display = "inline-block";
            document.getElementById('solarBadge').textContent = "⚡ CHARGING";
        } else {
            document.getElementById('solarBadge').style.display = "none";
        }
    },

    drawCameraFeed() {
        const render = () => {
            const width = this.canvas.width;
            const height = this.canvas.height;
            
            // Background
            this.ctx.fillStyle = "#020204";
            this.ctx.fillRect(0, 0, width, height);

            // Bounding Grid overlay
            this.ctx.strokeStyle = "rgba(249, 115, 22, 0.05)";
            this.ctx.lineWidth = 1;
            
            for (let i = 0; i < width; i += 20) {
                this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, height); this.ctx.stroke();
            }
            for (let j = 0; j < height; j += 20) {
                this.ctx.beginPath(); this.ctx.moveTo(0, j); this.ctx.lineTo(width, j); this.ctx.stroke();
            }

            const now = Date.now() / 1000;
            this.ctx.strokeStyle = "rgba(0, 245, 160, 0.2)";
            this.ctx.beginPath();
            this.ctx.arc(width/2, height/2, 45, now, now + 0.4);
            this.ctx.lineTo(width/2, height/2);
            this.ctx.stroke();

            if (state.isScanning) {
                this.ctx.fillStyle = "rgba(249, 115, 22, 0.03)";
                this.ctx.fillRect(0, 0, width, height);
                
                this.ctx.font = "10px JetBrains Mono";
                this.ctx.fillStyle = varColor('--accent');
                this.ctx.fillText("PARSING IMAGE SEGMENTS...", 20, 30);
                this.ctx.fillText(`IR FEEDBACK: ${Math.round(Math.random() * 200 + 400)} UNITS`, 20, 45);
            } else {
                this.ctx.font = "9px JetBrains Mono";
                this.ctx.fillStyle = varColor('--text-muted');
                this.ctx.fillText("CAM_STATE: IDLE", 14, 20);
            }

            requestAnimationFrame(render);
        };
        render();
    },

    async executeScan() {
        if (state.isScanning) return;
        state.isScanning = true;
        
        const btn = document.getElementById('manualScanBtn');
        btn.disabled = true;
        btn.textContent = "Scanning...";
        
        const active = state.fleet.find(f => f.collar_id === state.activeCollarId);
        Terminal.log(`HARDWARE`, `Collar lens triggered manually for ${active.animal_name}.`);
        
        await new Promise(r => setTimeout(r, 2000));
        
        const isPlasticDetected = Math.random() < 0.4;
        
        if (isPlasticDetected) {
            const irVal = Utils.randomBetween(700, 950);
            this.setIRValue(irVal);
            this.setActuators(true, true);
            
            Terminal.log(`ALERTS`, `CRITICAL: Plastic polymer detected! IR value: ${irVal}.`);
            Terminal.log(`HARDWARE`, `Collar actuators triggered: Buzzer active, vibration active.`);
            
            // Show bounding box
            const box = document.getElementById('camBoundingBox');
            box.style.display = "block";
            box.style.width = "110px";
            box.style.height = "70px";
            box.style.top = "90px";
            box.style.left = "100px";
            
            const plastic = Utils.randomItem(CONFIG.plasticTypes);
            document.getElementById('bbLabel').textContent = `${plastic}: ${Utils.randomBetween(85, 98)}%`;

            const location = Utils.randomItem(CONFIG.locations);
            const severity = Utils.randomItem(CONFIG.severities);
            
            const alert = {
                id: Utils.generateId(),
                location: location.name,
                lat: location.lat,
                lng: location.lng,
                plasticType: plastic,
                severity,
                time: Utils.getTimestamp(),
                date: Utils.getDate(),
                timestamp: Date.now(),
                animalName: active.animal_name,
                animalEmoji: active.animal_emoji,
                animalType: active.animal_type
            };

            state.activePopupAlert = alert;
            
            // Add alert to server DB
            const response = await API.addAlert(alert);
            if (response && response.success) {
                App.syncWithServer();
                this.showPopupModal(alert);
            }
            
        } else {
            const irVal = Utils.randomBetween(60, 240);
            this.setIRValue(irVal);
            this.setActuators(false, false);
            document.getElementById('camBoundingBox').style.display = "none";
            Terminal.log(`INFO`, `Scan clear. Environment safe. IR value: ${irVal}.`);
        }
        
        // Drain battery
        active.battery = Math.max(5, active.battery - Utils.randomBetween(1, 3));
        this.updateHardwareUI(active);
        
        state.isScanning = false;
        btn.disabled = false;
        btn.textContent = "⚡ Force Environment Scan";
    },

    setIRValue(val) {
        document.getElementById('irValueText').textContent = `${val} / 1024`;
        const percentage = Math.min(100, Math.round((val / 1024) * 100));
        document.getElementById('irValueBar').style.width = `${percentage}%`;
    },

    setActuators(buzz, motor) {
        const buzzerBadge = document.getElementById('badgeBuzzer');
        const motorBadge = document.getElementById('badgeMotor');
        
        if (buzz) {
            buzzerBadge.className = "actuator-pill active-buzz";
            buzzerBadge.textContent = `🔊 Buzzer: ACTIVE`;
        } else {
            buzzerBadge.className = "actuator-pill";
            buzzerBadge.textContent = `🔇 Buzzer: SILENT`;
        }

        if (motor) {
            motorBadge.className = "actuator-pill active-motor";
            motorBadge.textContent = `📳 Motor: deterrent`;
        } else {
            motorBadge.className = "actuator-pill";
            motorBadge.textContent = `💤 Motor: IDLE`;
        }
    },

    showPopupModal(alert) {
        document.getElementById('modalAnimal').textContent = `${alert.animalEmoji} ${alert.animalName} (${alert.animalType})`;
        document.getElementById('modalLocation').textContent = alert.location;
        document.getElementById('modalPlastic').textContent = alert.plasticType;
        document.getElementById('modalSeverity').textContent = alert.severity;
        
        document.getElementById('alertModal').classList.add('active');
    }
};

// Modal buttons bindings
document.getElementById('modalClose').onclick = () => document.getElementById('alertModal').classList.remove('active');
document.getElementById('modalDismissBtn').onclick = () => document.getElementById('alertModal').classList.remove('active');
document.getElementById('modalNotifyBtn').onclick = async () => {
    document.getElementById('alertModal').classList.remove('active');
    if (state.activePopupAlert) {
        await API.deployCrews([state.activePopupAlert.id]);
        App.notify("🔔 Outgoing crew dispatch logged in SQLite.");
        App.syncWithServer();
        window.location.hash = "#admin-section";
    }
};

// ============================================================
// ADMIN CONSOLE CORE MODULE
// ============================================================
const AdminConsole = {
    async login(username, password) {
        const res = await API.login(username, password);
        if (res && res.success) {
            state.userRole = "admin";
            document.getElementById('adminAuthGate').style.display = "none";
            document.getElementById('adminDashboard').style.display = "flex";
            App.notify("🔓 Authorization accepted.");
            App.syncWithServer();
        } else {
            App.notify("❌ Invalid Credentials. Try admin/admin");
        }
    },

    logout() {
        state.userRole = null;
        document.getElementById('adminDashboard').style.display = "none";
        document.getElementById('adminAuthGate').style.display = "flex";
        App.notify("🔒 Session terminated.");
    },

    async deployCrew(alertId) {
        const res = await API.deployCrews([alertId]);
        if (res && res.success) {
            App.notify("🚛 Crew dispatched. Worker SMS generated.");
            App.syncWithServer();
        }
    },

    async bulkDispatch() {
        const pendingIds = state.alerts.filter(a => a.status === 'pending').map(a => a.id);
        if (pendingIds.length === 0) {
            App.notify("⚠️ No pending dispatches.");
            return;
        }
        const res = await API.deployCrews(pendingIds);
        if (res && res.success) {
            App.notify(`🚛 Path optimized dispatch issued for ${pendingIds.length} points.`);
            App.syncWithServer();
        }
    }
};

// Bindings
document.getElementById('adminLoginForm').onsubmit = (e) => {
    e.preventDefault();
    const u = document.getElementById('adminUsername').value;
    const p = document.getElementById('adminPassword').value;
    AdminConsole.login(u, p);
};
document.getElementById('adminLogoutBtn').onclick = () => AdminConsole.logout();
document.getElementById('adminBulkDispatchBtn').onclick = () => AdminConsole.bulkDispatch();

// Filters clicks
document.querySelectorAll('.table-filters .filter-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.table-filters .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        App.renderAdminTable();
    };
});

// Map toggles
document.getElementById('heatmapToggle').onchange = () => App.updateMapElements();
document.getElementById('routingToggle').onchange = () => App.updateMapElements();

// ============================================================
// FIELD WORKER PORTAL CORE MODULE
// ============================================================
const WorkerPortal = {
    async login(username, password) {
        const res = await API.login(username, password);
        if (res && res.success) {
            state.userRole = "worker";
            document.getElementById('workerAuthGate').style.display = "none";
            document.getElementById('workerDashboard').style.display = "flex";
            App.notify("🔓 Worker authorized.");
            App.syncWithServer();
        } else {
            App.notify("❌ Invalid Credentials. Try worker/worker");
        }
    },

    logout() {
        state.userRole = null;
        document.getElementById('workerDashboard').style.display = "none";
        document.getElementById('workerAuthGate').style.display = "flex";
        App.notify("🔒 Session terminated.");
    },

    showUploadForm(alert) {
        document.getElementById('phoneTaskList').style.display = "none";
        document.getElementById('phoneUploadForm').style.display = "block";
        
        document.getElementById('phoneFormDetails').textContent = `Location: ${alert.location}`;
        document.getElementById('uploadAlertId').value = alert.id;
        document.getElementById('fileNamePreview').textContent = "No file chosen";
    },

    hideUploadForm() {
        document.getElementById('phoneUploadForm').style.display = "none";
        document.getElementById('phoneTaskList').style.display = "flex";
    },

    async submitResolution(e) {
        e.preventDefault();
        
        const alertId = document.getElementById('uploadAlertId').value;
        const fileField = document.getElementById('uploadFileField');
        
        if (fileField.files.length === 0) {
            App.notify("⚠️ Verification photo required.");
            return;
        }

        const btn = document.getElementById('phoneSubmitBtn');
        btn.disabled = true;
        btn.textContent = "Uploading...";

        const file = fileField.files[0];
        const res = await API.resolveAlert(alertId, file);

        if (res && res.success) {
            App.notify("✅ Proof verification accepted! Public stats updated.");
            this.hideUploadForm();
            App.syncWithServer();
        } else {
            App.notify("❌ Photo upload transaction failed.");
        }

        btn.disabled = false;
        btn.textContent = "Mark Cleaned & Upload";
    }
};

// Bindings
document.getElementById('workerLoginForm').onsubmit = (e) => {
    e.preventDefault();
    const u = document.getElementById('workerUsername').value;
    const p = document.getElementById('workerPassword').value;
    WorkerPortal.login(u, p);
};

// ============================================================
// COMMERCIAL CUSTOMER PORTAL MODULE
// ============================================================
const CustomerPortal = {
    async login(username, password) {
        const res = await API.login(username, password);
        if (res && res.success) {
            state.userRole = "customer";
            document.getElementById('customerAuthGate').style.display = "none";
            document.getElementById('customerDashboard').style.display = "flex";
            App.notify("🔓 Customer Portal unlocked.");
            this.loadCustomerStats();
            // Setup Leaflet double click reporting
            state.map.on('dblclick', this.handleMapDoubleClick);
        } else {
            App.notify("❌ Invalid Credentials. Try customer/customer");
        }
    },

    logout() {
        state.userRole = null;
        document.getElementById('customerDashboard').style.display = "none";
        document.getElementById('customerAuthGate').style.display = "flex";
        App.notify("🔒 Session terminated.");
        if (state.map) {
            state.map.off('dblclick', this.handleMapDoubleClick);
        }
    },

    async loadCustomerStats() {
        const data = await API.getCustomerStats();
        if (data && data.customer) {
            const c = data.customer;
            document.getElementById('custCompanyName').textContent = c.company_name;
            document.getElementById('custSubscriptionTier').textContent = c.subscription_tier;
            document.getElementById('custLeasedCollars').textContent = `${c.leased_collars} Nodes`;
            document.getElementById('custBillingDue').textContent = `$${c.billing_due.toFixed(2)}`;
            document.getElementById('custWeightCollected').textContent = `${c.weight_collected.toFixed(1)} kg`;
            
            // Build sweeps table
            const tbody = document.getElementById('custSweepsTbody');
            if (data.sweeps && data.sweeps.length > 0) {
                tbody.innerHTML = data.sweeps.map(s => {
                    const date = new Date(s.timestamp * 1000).toLocaleString();
                    const statusClass = s.status === 'pending' ? 'badge-warn' : 'badge-success';
                    return `
                        <tr>
                            <td><code>${s.id}</code></td>
                            <td><strong>${s.location}</strong></td>
                            <td><code>${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</code></td>
                            <td>${date}</td>
                            <td><span class="status-badge ${statusClass}">${s.status.toUpperCase()}</span></td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No custom sweep dispatches registered.</td></tr>`;
            }
        }
    },

    async requestSweep(e) {
        e.preventDefault();
        const loc = document.getElementById('custSweepLocation').value.trim();
        const lat = parseFloat(document.getElementById('custSweepLat').value);
        const lng = parseFloat(document.getElementById('custSweepLng').value);

        if (!loc || isNaN(lat) || isNaN(lng)) {
            App.notify("⚠️ Please enter a valid sector name and coordinates.");
            return;
        }

        const res = await API.requestSweep(loc, lat, lng);
        if (res && res.success) {
            App.notify("✨ Custom priority sweep requested! Dispatch sent to crew.");
            document.getElementById('custSweepRequestForm').reset();
            this.loadCustomerStats();
            App.syncWithServer(); // Sync Leaflet map and alerts list!
        } else {
            App.notify("❌ Failed to request priority sweep.");
        }
    },

    handleMapDoubleClick(e) {
        if (state.userRole !== 'customer') return;
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        document.getElementById('custSweepLat').value = lat.toFixed(4);
        document.getElementById('custSweepLng').value = lng.toFixed(4);
        
        // Scroll to form
        document.getElementById('custSweepLocation').focus();
        
        App.notify(`✔ Coordinates copied: [${lat.toFixed(4)}, ${lng.toFixed(4)}]. Name your sector and submit!`);
    }
};

// Bindings
document.getElementById('customerLoginForm').onsubmit = (e) => {
    e.preventDefault();
    const u = document.getElementById('customerUsername').value;
    const p = document.getElementById('customerPassword').value;
    CustomerPortal.login(u, p);
};
document.getElementById('customerLogoutBtn').onclick = () => CustomerPortal.logout();
document.getElementById('custSweepRequestForm').onsubmit = (e) => CustomerPortal.requestSweep(e);
document.getElementById('workerLogoutBtn').onclick = () => WorkerPortal.logout();
document.getElementById('phoneFormBackBtn').onclick = () => WorkerPortal.hideUploadForm();
document.getElementById('uploadFileField').onchange = (e) => {
    const fn = e.target.files[0] ? e.target.files[0].name : "No file chosen";
    document.getElementById('fileNamePreview').textContent = fn;
};
document.getElementById('proofUploadForm').onsubmit = (e) => WorkerPortal.submitResolution(e);

// ============================================================
// BEFORE/AFTER SLIDER MODULE
// ============================================================
const Slider = {
    init() {
        // Attached dynamically
    },

    attach(container) {
        const handle = container.querySelector('.slider-handle');
        const afterWrapper = container.querySelector('.after-wrapper');
        let isDragging = false;

        const updatePosition = (clientX) => {
            const rect = container.getBoundingClientRect();
            const x = clientX - rect.left;
            let percentage = (x / rect.width) * 100;
            percentage = Math.max(0, Math.min(100, percentage));
            
            handle.style.left = `${percentage}%`;
            afterWrapper.style.width = `${percentage}%`;
        };

        const onStart = (e) => {
            isDragging = true;
            updatePosition(e.clientX || e.touches[0].clientX);
        };

        const onMove = (e) => {
            if (!isDragging) return;
            updatePosition(e.clientX || (e.touches && e.touches[0].clientX));
        };

        const onEnd = () => {
            isDragging = false;
        };

        handle.addEventListener('mousedown', onStart);
        container.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);

        handle.addEventListener('touchstart', onStart);
        container.addEventListener('touchmove', onMove);
        window.addEventListener('touchend', onEnd);
    }
};

// ============================================================
// PRESENTATION GUIDED TOUR MODULE (WOW FACTOR)
// ============================================================
const Tour = {
    steps: [
        {
            title: "1. EcoCollar.sh Framework",
            text: "This landing page replicates the template and aesthetics of Bun.sh. It features a bold headline, installation pill, live performance charts, and direct database dashboard panels.",
            element: "installPill",
            position: "bottom"
        },
        {
            title: "2. ESP32-CAM Diagnostics",
            text: "This card displays simulated live grid matrices, computer vision bounding box overlaps, haptic alerts, and real-weather solar sync charge rates.",
            element: "tourCamFeed",
            position: "right"
        },
        {
            title: "3. GIS Leaflet Map",
            text: "Tracks collar nodes roaming through Delhi coordinates. Includes toggle controls for cumulative density heatmaps andoptimized path routing.",
            element: "map",
            position: "top"
        },
        {
            title: "4. Command Control gate",
            text: "Lock gate panel for administrators. Authorize with admin/admin to review active alerts and send out Twilio crew dispatches.",
            element: "admin-section",
            position: "top"
        },
        {
            title: "5. Mobile Resolution Unit",
            text: "Worker mobile frame. Log in with worker/worker to review active dispatches and upload proof photos to increment environmental offsets.",
            element: "worker-section",
            position: "top"
        }
    ],

    init() {
        document.getElementById('guidedTourBtn').onclick = () => this.start();
        document.getElementById('tourPrevBtn').onclick = () => this.prev();
        document.getElementById('tourNextBtn').onclick = () => this.next();
        document.getElementById('tourEndBtn').onclick = () => this.end();
    },

    start() {
        state.tourStep = 0;
        document.getElementById('tourBackdrop').style.display = "block";
        document.getElementById('tourTooltip').style.display = "flex";
        this.renderStep();
        App.notify("🏁 Guided presenter tour initialized!");
    },

    renderStep() {
        const step = this.steps[state.tourStep];
        
        document.getElementById('tourStepTitle').textContent = step.title;
        document.getElementById('tourStepText').textContent = step.text;
        document.getElementById('tourStepCounter').textContent = `${state.tourStep + 1} of ${this.steps.length}`;

        document.getElementById('tourPrevBtn').style.display = state.tourStep === 0 ? "none" : "inline-block";
        if (state.tourStep === this.steps.length - 1) {
            document.getElementById('tourNextBtn').style.display = "none";
            document.getElementById('tourEndBtn').style.display = "inline-block";
        } else {
            document.getElementById('tourNextBtn').style.display = "inline-block";
            document.getElementById('tourEndBtn').style.display = "none";
        }

        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
        
        const highlightEl = document.getElementById(step.element);
        if (highlightEl) {
            highlightEl.classList.add('tour-highlight');
            highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            const rect = highlightEl.getBoundingClientRect();
            const tooltip = document.getElementById('tourTooltip');
            
            let top = 0;
            let left = 0;
            
            if (step.position === 'right') {
                top = window.scrollY + rect.top + rect.height/2 - 80;
                left = rect.right + 20;
            } else if (step.position === 'left') {
                top = window.scrollY + rect.top + rect.height/2 - 80;
                left = rect.left - 280;
            } else {
                top = window.scrollY + rect.top - 180;
                left = rect.left + rect.width/2 - 130;
            }
            
            left = Math.max(10, Math.min(window.innerWidth - 280, left));
            top = Math.max(10, top);

            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
        }
    },

    next() {
        if (state.tourStep < this.steps.length - 1) {
            state.tourStep++;
            this.renderStep();
        }
    },

    prev() {
        if (state.tourStep > 0) {
            state.tourStep--;
            this.renderStep();
        }
    },

    end() {
        document.getElementById('tourBackdrop').style.display = "none";
        document.getElementById('tourTooltip').style.display = "none";
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
        App.notify("✔ Tour complete.");
    }
};

// ============================================================
// CITIZEN CROWDSOURCED REPORT MODULE
// ============================================================
const CitizenReporter = {
    init() {
        const fileField = document.getElementById('citizenFileField');
        if (fileField) {
            fileField.addEventListener('change', (e) => {
                const name = e.target.files[0] ? e.target.files[0].name : "No file chosen";
                document.getElementById('citizenFileNamePreview').textContent = name;
            });
        }

        const form = document.getElementById('citizenReportForm');
        if (form) {
            form.addEventListener('submit', (e) => this.submitReport(e));
        }
    },

    async submitReport(e) {
        e.preventDefault();
        
        const loc = document.getElementById('citizenLocation').value.trim();
        const lat = document.getElementById('citizenLat').value;
        const lng = document.getElementById('citizenLng').value;
        const fileField = document.getElementById('citizenFileField');
        
        if (!loc || !lat || !lng) {
            App.notify("⚠️ Coordinates and location description are required.");
            return;
        }
        if (fileField.files.length === 0) {
            App.notify("⚠️ Please attach a photo of the litter heap.");
            return;
        }

        const submitBtn = document.getElementById('citizenSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = "Uploading Report...";

        const file = fileField.files[0];
        const res = await API.submitCitizenReport(loc, lat, lng, file);

        if (res && res.success) {
            App.notify("🎉 Thank you! Citizen report submitted. Dispatched to crew.");
            document.getElementById('citizenReportForm').reset();
            document.getElementById('citizenFileNamePreview').textContent = "No file chosen";
            App.syncWithServer(); // Reload Leaflet and pending lists
        } else {
            App.notify("❌ Failed to upload citizen report.");
        }

        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Public Report";
    }
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
    App.init();
    CitizenReporter.init();
});