/* ============================================================
   EcoCollar - Digital India Smart Collar & Municipal Dashboard
   Premium Vanilla JS | ES6+ | Modular Architecture
   ============================================================ */

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    scanInterval: 8000,
    detectionChance: 0.35,
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
    severities: ['Low', 'Medium', 'High'],
    animalProfiles: [
        { name: 'Rocky', type: 'Street Dog', emoji: '🐕', heartRate: 72, temp: 38.2 },
        { name: 'Bella', type: 'Stray Cat', emoji: '🐱', heartRate: 110, temp: 38.5 },
        { name: 'Max', type: 'Street Dog', emoji: '🐕', heartRate: 75, temp: 38.0 },
        { name: 'Luna', type: 'Stray Cat', emoji: '🐱', heartRate: 108, temp: 38.3 },
        { name: 'Charlie', type: 'Monkey', emoji: '🐒', heartRate: 90, temp: 37.8 },
        { name: 'Daisy', type: 'Cow', emoji: '🐄', heartRate: 65, temp: 38.7 }
    ]
};

// ============================================================
// APPLICATION STATE
// ============================================================
const state = {
    alerts: [],
    scanCount: 0,
    detectionCount: 0,
    isScanning: false,
    timerValue: 8,
    timerInterval: null,
    currentAnimal: CONFIG.animalProfiles[0],
    currentLocation: { ...CONFIG.locations[0] },
    map: null,
    mapMarkers: [],
    filter: 'all'
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
const Utils = {
    randomBetween: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    randomItem: arr => arr[Math.floor(Math.random() * arr.length)],
    getTimestamp: () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    getDate: () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    generateId: () => 'EC-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
    getTimeAgo: (timestamp) => {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins === 1) return '1 min ago';
        if (mins < 60) return mins + ' mins ago';
        const hrs = Math.floor(mins / 60);
        return hrs + 'h ago';
    }
};

// ============================================================
// NAVIGATION
// ============================================================
const Navigation = {
    init() {
        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                document.getElementById('view-' + view).classList.add('active');
                if (view === 'dashboard' && state.map) {
                    setTimeout(() => state.map.invalidateSize(), 150);
                }
            });
        });
        // Clock
        setInterval(() => {
            document.getElementById('navTime').textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }, 1000);
    }
};

// ============================================================
// COLLAR MODULE
// ============================================================
const Collar = {
    init() {
        document.getElementById('scanBtn').addEventListener('click', () => this.performScan());
        document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearHistory());
        this.startTimer();
    },

    startTimer() {
        state.timerValue = 8;
        this.updateTimerDisplay();
        state.timerInterval = setInterval(() => {
            state.timerValue--;
            this.updateTimerDisplay();
            if (state.timerValue <= 0) {
                state.timerValue = 8;
                this.performScan();
            }
        }, 1000);
    },

    updateTimerDisplay() {
        const circumference = 263.89;
        const offset = circumference * (1 - state.timerValue / 8);
        document.getElementById('timerProgress').style.strokeDashoffset = offset;
        document.getElementById('timerCount').textContent = state.timerValue;
    },

    async performScan() {
        if (state.isScanning) return;
        state.isScanning = true;
        state.scanCount++;

        const btn = document.getElementById('scanBtn');
        btn.disabled = true;
        btn.querySelector('.scan-btn-text').textContent = 'Scanning...';

        // Reset timer
        clearInterval(state.timerInterval);
        state.timerValue = 8;
        this.updateTimerDisplay();

        // Scanning animation
        this.setSensors(0, 0, 0);
        this.setCollarLED('🟡', '#fbbf24');
        document.getElementById('scanResult').innerHTML = `
            <div style="color: var(--text-muted); font-weight: 500;">
                <span style="font-size: 22px; display: block; margin-bottom: 6px;">⏳</span>
                Analyzing environment for plastic polymers...
            </div>
        `;

        // Simulate scan delay
        await new Promise(r => setTimeout(r, 2000));

        const detected = Math.random() < CONFIG.detectionChance;

        if (detected) {
            this.handleDetection();
        } else {
            const ir = Utils.randomBetween(2, 18);
            const nir = Utils.randomBetween(3, 15);
            const ultra = Utils.randomBetween(1, 12);
            this.setSensors(ir, nir, ultra);
            this.setCollarLED('🟢', '#00f5a0');
            document.getElementById('scanResult').innerHTML = `
                <div class="result-safe">
                    <span class="result-icon">✅</span>
                    <span>Environment is clean. No plastic detected.</span>
                </div>
            `;
        }

        this.drainBattery();
        document.getElementById('lastScanTime').textContent = 'Just now';
        document.getElementById('heroScans').textContent = state.scanCount;

        btn.disabled = false;
        btn.querySelector('.scan-btn-text').textContent = 'Scan Now';
        state.isScanning = false;

        // Restart timer
        state.timerValue = 8;
        this.updateTimerDisplay();
        state.timerInterval = setInterval(() => {
            state.timerValue--;
            this.updateTimerDisplay();
            if (state.timerValue <= 0) {
                state.timerValue = 8;
                this.performScan();
            }
        }, 1000);
    },

    handleDetection() {
        const plasticType = Utils.randomItem(CONFIG.plasticTypes);
        const severity = Utils.randomItem(CONFIG.severities);
        const location = Utils.randomItem(CONFIG.locations);
        const animal = Utils.randomItem(CONFIG.animalProfiles);

        state.currentLocation = { ...location };
        state.currentAnimal = animal;
        state.detectionCount++;

        // Update sensors to danger levels
        this.setSensors(78, 85, 62);
        this.setCollarLED('🔴', '#ff4757');

        document.getElementById('scanResult').innerHTML = `
            <div class="result-danger">
                <span class="result-icon">🚨</span>
                <span>⚠️ PLASTIC DETECTED! ${plasticType}</span>
            </div>
        `;

        // Update animal profile
        this.updateAnimalProfile(animal, location);

        // Create alert
        const alert = {
            id: Utils.generateId(),
            location: location.name,
            lat: location.lat,
            lng: location.lng,
            plasticType,
            severity,
            time: Utils.getTimestamp(),
            date: Utils.getDate(),
            timestamp: Date.now(),
            status: 'pending',
            animalName: animal.name,
            animalType: animal.type,
            animalEmoji: animal.emoji
        };

        state.alerts.push(alert);

        // Update all UIs
        this.addAlertToHistory(alert);
        Dashboard.addAlertToTable(alert);
        Dashboard.updateStats();
        Dashboard.addMapMarker(alert);
        Dashboard.addToScheduler(alert);
        this.updateHeroDetections();

        // Show modal
        Modal.show(alert);

        // Flash title
        const orig = document.title;
        document.title = '🚨 PLASTIC DETECTED! - EcoCollar';
        setTimeout(() => document.title = orig, 3000);
    },

    setSensors(ir, nir, ultra) {
        const update = (id, val, isDanger) => {
            const fill = document.getElementById(id + 'BarFill');
            const read = document.getElementById(id + 'Read');
            const ring = document.getElementById(id + 'RingFill');
            fill.style.width = val + '%';
            read.textContent = val + '%';
            ring.style.setProperty('--p', val);
            if (isDanger) {
                fill.style.background = 'linear-gradient(90deg, #ff4757, #ff6b6b)';
                read.style.color = '#ff4757';
            } else {
                fill.style.background = 'linear-gradient(90deg, var(--mint), var(--blue))';
                read.style.color = 'var(--mint)';
            }
        };
        update('ir', ir, ir > 30);
        update('nir', nir, nir > 30);
        update('ultra', ultra, ultra > 30);
    },

    setCollarLED(emoji, color) {
        const led = document.getElementById('collarLedIndicator');
        led.textContent = emoji;
        led.style.filter = `drop-shadow(0 0 12px ${color})`;
    },

    updateAnimalProfile(animal, location) {
        document.getElementById('avatarEmoji').textContent = animal.emoji;
        document.getElementById('animalNameDisplay').textContent = animal.name;
        document.getElementById('animalTypeDisplay').textContent = animal.type;
        document.getElementById('heartRate').innerHTML = animal.heartRate + ' <small>bpm</small>';
        document.getElementById('bodyTemp').innerHTML = animal.temp + ' <small>°C</small>';
        document.getElementById('gpsCoords').textContent = `${location.lat}°N, ${location.lng}°E`;
        document.getElementById('animalLocationDisplay').textContent = location.name;
    },

    drainBattery() {
        const fill = document.getElementById('batteryFillBar');
        const pct = document.getElementById('batteryPercent');
        let current = parseInt(pct.textContent);
        let drain = Utils.randomBetween(1, 3);
        let newVal = Math.max(5, current - drain);
        fill.style.width = newVal + '%';
        pct.textContent = newVal + '%';
        if (newVal < 20) fill.style.background = 'linear-gradient(90deg, #ff4757, #ff6b6b)';
        else if (newVal < 50) fill.style.background = 'linear-gradient(90deg, #fbbf24, #f59e0b)';
    },

    addAlertToHistory(alert) {
        const body = document.getElementById('alertHistoryBody');
        const empty = body.querySelector('.alert-empty-state');
        if (empty) empty.remove();

        const item = document.createElement('div');
        item.className = 'alert-item';
        item.dataset.id = alert.id;
        item.innerHTML = `
            <span class="alert-icon">🚨</span>
            <div class="alert-info">
                <strong>${alert.plasticType}</strong>
                <span>${alert.location} · ${alert.animalName}</span>
            </div>
            <span class="alert-time">${alert.time}</span>
        `;
        body.insertBefore(item, body.firstChild);

        document.getElementById('alertBadge').textContent = state.alerts.length;
    },

    updateHeroDetections() {
        document.getElementById('heroDetections').textContent = state.detectionCount;
    },

    clearHistory() {
        state.alerts = [];
        state.detectionCount = 0;
        document.getElementById('alertHistoryBody').innerHTML = `
            <div class="alert-empty-state">
                <span class="empty-icon">🛡️</span>
                <p>No plastic detected yet. The area is clean!</p>
            </div>
        `;
        document.getElementById('alertBadge').textContent = '0';
        this.updateHeroDetections();
        Dashboard.clearAll();
    }
};

// ============================================================
// DASHBOARD MODULE
// ============================================================
const Dashboard = {
    init() {
        this.initMap();
        document.getElementById('alertsTbody').addEventListener('click', (e) => this.handleAction(e));
        document.getElementById('dispatchBtn').addEventListener('click', () => this.dispatchCrew());

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.filter = btn.dataset.filter;
                this.renderTable();
                this.updateMapMarkers();
            });
        });
    },

    initMap() {
        state.map = L.map('map', {
            center: [28.6139, 77.2090],
            zoom: 12,
            zoomControl: true
        });

        // Dark tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 19
        }).addTo(state.map);
    },

    addMapMarker(alert) {
        if (!state.map) return;

        const color = alert.status === 'pending' ? '#ff4757' :
                      alert.status === 'in-progress' ? '#fbbf24' : '#00f5a0';

        const marker = L.circleMarker([alert.lat, alert.lng], {
            radius: 10,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
            className: 'pulsing-marker'
        }).addTo(state.map);

        const sevEmoji = alert.severity === 'High' ? '🔴' : alert.severity === 'Medium' ? '🟡' : '🟢';

        marker.bindPopup(`
            <div style="font-family:Inter,sans-serif;min-width:200px;">
                <h3 style="margin:0 0 8px;font-size:14px;font-weight:700;">🚨 Plastic Alert</h3>
                <p style="margin:2px 0;font-size:12px;"><strong>Animal:</strong> ${alert.animalEmoji} ${alert.animalName}</p>
                <p style="margin:2px 0;font-size:12px;"><strong>Location:</strong> ${alert.location}</p>
                <p style="margin:2px 0;font-size:12px;"><strong>Type:</strong> ${alert.plasticType}</p>
                <p style="margin:2px 0;font-size:12px;"><strong>Severity:</strong> ${sevEmoji} ${alert.severity}</p>
                <p style="margin:2px 0;font-size:12px;"><strong>Status:</strong> <span style="color:${color};font-weight:700;">${alert.status.toUpperCase()}</span></p>
                <p style="margin:2px 0;font-size:12px;"><strong>Time:</strong> ${alert.time} · ${alert.date}</p>
            </div>
        `);

        state.mapMarkers.push({ marker, alertId: alert.id });
    },

    updateMapMarkers() {
        state.mapMarkers.forEach(({ marker }) => state.map.removeLayer(marker));
        state.mapMarkers = [];

        const filtered = state.filter === 'all'
            ? state.alerts
            : state.alerts.filter(a => a.status === state.filter);

        filtered.forEach(a => this.addMapMarker(a));
    },

    addAlertToTable(alert) {
        this.renderTable();
    },

    renderTable() {
        const tbody = document.getElementById('alertsTbody');
        tbody.innerHTML = '';

        const filtered = state.filter === 'all'
            ? state.alerts
            : state.alerts.filter(a => a.status === state.filter);

        if (filtered.length === 0) {
            const msg = state.filter === 'all'
                ? 'No alerts yet. Waiting for collar detections...'
                : `No ${state.filter.replace('-', ' ')} alerts.`;
            tbody.innerHTML = `
                <tr><td colspan="7" class="empty-row">
                    <span class="empty-row-icon">🗺️</span>
                    <p>${msg}</p>
                </td></tr>
            `;
            return;
        }

        filtered.forEach(a => {
            const sevEmoji = a.severity === 'High' ? '🔴' : a.severity === 'Medium' ? '🟡' : '🟢';
            const statusClass = a.status === 'pending' ? 'status-badge-pending' :
                               a.status === 'in-progress' ? 'status-badge-progress' : 'status-badge-resolved';
            const statusText = a.status === 'pending' ? 'Pending' :
                              a.status === 'in-progress' ? 'Active' : 'Done';

            let action = '';
            if (a.status === 'pending') action = `<button class="btn-action accept" data-id="${a.id}">Accept</button>`;
            else if (a.status === 'in-progress') action = `<button class="btn-action resolve" data-id="${a.id}">Resolve</button>`;
            else action = `<button class="btn-action delete" data-id="${a.id}">Delete</button>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><small>${a.id.slice(0, 10)}</small></td>
                <td>${a.animalEmoji} ${a.animalName}</td>
                <td>${a.plasticType}</td>
                <td>${a.location}</td>
                <td class="severity-${a.severity.toLowerCase()}">${sevEmoji} ${a.severity}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>${action}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    handleAction(e) {
        const target = e.target;
        if (!target.classList.contains('btn-action')) return;

        const id = target.dataset.id;
        const alert = state.alerts.find(a => a.id === id);
        if (!alert) return;

        if (target.classList.contains('accept')) {
            alert.status = 'in-progress';
            this.updateHistoryItem(id, '🟡', 'rgba(251,191,36,0.08)', '(In Progress)');
            this.updateSchedulerItem(id, 'In Progress', 'scheduled', '#fbbf24');
            this.notify('✅ Alert accepted! Cleanup crew dispatched.');
        } else if (target.classList.contains('resolve')) {
            alert.status = 'resolved';
            this.updateHistoryItem(id, '✅', 'rgba(0,245,160,0.08)', '(Resolved)');
            this.updateSchedulerItem(id, 'Completed ✓', 'completed', '#00f5a0');
            this.notify('✅ Plastic waste cleaned up! Area is safe.');
        } else if (target.classList.contains('delete')) {
            const idx = state.alerts.findIndex(a => a.id === id);
            if (idx > -1) state.alerts.splice(idx, 1);
            const hItem = document.querySelector(`.alert-item[data-id="${id}"]`);
            if (hItem) hItem.remove();
            const sItem = document.querySelector(`.schedule-item[data-id="${id}"]`);
            if (sItem) sItem.remove();
            document.getElementById('alertBadge').textContent = state.alerts.length;
        }

        this.renderTable();
        this.updateStats();
        this.updateMapMarkers();
    },

    updateHistoryItem(id, icon, bg, label) {
        const item = document.querySelector(`.alert-item[data-id="${id}"]`);
        if (item) {
            item.style.background = bg;
            const strong = item.querySelector('.alert-info strong');
            if (!strong.innerHTML.includes(label)) {
                strong.innerHTML += ` <span style="font-size:10px;color:${bg.includes('251') ? '#fbbf24' : '#00f5a0'};font-weight:600;">${label}</span>`;
            }
        }
    },

    updateSchedulerItem(id, text, cls, color) {
        const item = document.querySelector(`.schedule-item[data-id="${id}"]`);
        if (item) {
            const status = item.querySelector('.schedule-status');
            status.textContent = text;
            status.className = 'schedule-status ' + cls;
            status.style.background = `rgba(${cls === 'scheduled' ? '59,130,246' : '0,245,160'},0.1)`;
            status.style.color = color;
        }
    },

    updateStats() {
        const total = state.alerts.length;
        const pending = state.alerts.filter(a => a.status === 'pending').length;
        const inProgress = state.alerts.filter(a => a.status === 'in-progress').length;
        const resolved = state.alerts.filter(a => a.status === 'resolved').length;

        document.getElementById('kpiTotal').textContent = total;
        document.getElementById('kpiPending').textContent = pending;
        document.getElementById('kpiInProgress').textContent = inProgress;
        document.getElementById('kpiResolved').textContent = resolved;
    },

    addToScheduler(alert) {
        const body = document.getElementById('schedulerBody');
        const empty = body.querySelector('.scheduler-empty');
        if (empty) empty.remove();

        const date = new Date();
        date.setDate(date.getDate() + Utils.randomBetween(1, 3));
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const item = document.createElement('div');
        item.className = 'schedule-item';
        item.dataset.id = alert.id;
        item.innerHTML = `
            <span class="sched-icon">🧹</span>
            <div class="sched-info">
                <strong>Cleanup: ${alert.location}</strong>
                <span>${alert.plasticType} · ${alert.animalEmoji} ${alert.animalName} · ${dateStr}</span>
            </div>
            <span class="schedule-status scheduled">Scheduled</span>
        `;
        body.insertBefore(item, body.firstChild);
    },

    dispatchCrew() {
        const pending = state.alerts.filter(a => a.status === 'pending');
        if (pending.length === 0) {
            this.notify('⚠️ No pending alerts to dispatch. All clear!');
            return;
        }
        pending.forEach(a => {
            a.status = 'in-progress';
            this.updateHistoryItem(a.id, '🟡', 'rgba(251,191,36,0.08)', '(In Progress)');
            this.updateSchedulerItem(a.id, 'In Progress', 'scheduled', '#fbbf24');
        });
        this.renderTable();
        this.updateStats();
        this.updateMapMarkers();
        this.notify(`🚛 ${pending.length} cleanup crew${pending.length > 1 ? 's' : ''} dispatched!`);
    },

    clearAll() {
        this.renderTable();
        this.updateStats();
        this.updateMapMarkers();
        document.getElementById('schedulerBody').innerHTML = `
            <div class="scheduler-empty">
                <span class="sched-empty-icon">🧹</span>
                <p>No pending alerts to schedule. All clear!</p>
            </div>
        `;
    },

    notify(message) {
        const el = document.createElement('div');
        el.className = 'notification';
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.3s';
            setTimeout(() => el.remove(), 300);
        }, 3000);
    }
};

// ============================================================
// MODAL MODULE
// ============================================================
const Modal = {
    init() {
        document.getElementById('modalClose').addEventListener('click', () => this.close());
        document.getElementById('modalDismiss').addEventListener('click', () => this.close());
        document.getElementById('modalNotify').addEventListener('click', () => this.notify());
        document.getElementById('alertModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.close();
        });
    },

    show(alert) {
        document.getElementById('modalLocation').textContent = alert.location;
        document.getElementById('modalPlastic').textContent = alert.plasticType;
        document.getElementById('modalSeverity').textContent = alert.severity;
        document.getElementById('modalTime').textContent = alert.time + ' · ' + alert.date;
        document.getElementById('modalAnimal').textContent = alert.animalEmoji + ' ' + alert.animalName + ' (' + alert.animalType + ')';
        document.getElementById('alertModal').classList.add('active');
        this._currentAlert = alert;
    },

    close() {
        document.getElementById('alertModal').classList.remove('active');
    },

    notify() {
        this.close();
        Dashboard.notify('🔔 Municipality notified! Cleanup crew is on the way.');
        document.querySelector('[data-view="dashboard"]').click();
    }
};

// ============================================================
// INITIALIZATION
// ============================================================
function init() {
    Navigation.init();
    Collar.init();
    Dashboard.init();
    Modal.init();
    console.log('🐾 EcoCollar v2.0 initialized');
    console.log(`📍 ${CONFIG.locations.length} locations · 🔄 ${CONFIG.scanInterval/1000}s interval`);
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState === 'complete' || document.readyState === 'interactive') init();