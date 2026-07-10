# -*- coding: utf-8 -*-
"""
================================================================================
  ███████╗ ██████╗ ██████╗  ██████╗ ██████╗  ██████╗ ██████╗ ███████╗██████╗  █████╗ 
  ██╔════╝██╔════╝██╔═══██╗██╔════╝██╔═══██╗██╔════╝██╔═══██╗██╔════╝██╔══██╗██╔══██╗
  █████╗  ██║     ██║   ██║██║     ██║   ██║██║     ██║   ██║█████╗  ██████╔╝███████║
  ██╔══╝  ██║     ██║   ██║██║     ██║   ██║██║     ██║   ██║██╔══╝  ██╔══██╗██╔══██║
  ███████╗╚██████╗╚██████╔╝╚██████╗╚██████╔╝╚██████╗╚██████╔╝███████╗██║  ██║██║  ██║
  ╚══════╝ ╚═════╝ ╚═════╝  ╚═════╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝
================================================================================

EcoCollar Central Server - Core Operating Service & Telemetry Centralizer
Concept: Digital India Smart Municipal Waste Management Initiative
Architecture: Single-Threaded HTTP REST Service & SQLite Database Coordinator

Designed to serving:
  - Static front-end assets (HTML, CSS, JS, Images, Uploads)
  - REST JSON API endpoints for Collar diagnostics (ESP32-CAM, IR sensors)
  - Secure municipality administration and field worker portals
  - Persistent SQLite databases storing alerts, device fleets, and SMS logs
  
Requirements:
  - Python 3.8+ (Strictly built-in libraries)
  - Zero external dependencies (pip install is NOT required)

================================================================================
"""

import os
import sys
import json
import sqlite3
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import time
import datetime

# ==============================================================================
# 1. APPLICATION CONSTANTS & CONTEXT
# ==============================================================================
PORT = 8000
DB_FILE = "database.db"
UPLOAD_DIR = "uploads"
SERVER_VERSION = "2.2.0-STABLE"

# Ensure crucial runtime folders exist
if not os.path.exists(UPLOAD_DIR):
    try:
        os.makedirs(UPLOAD_DIR)
        print(f"[SYSTEM] Created uploads directory: {UPLOAD_DIR}")
    except Exception as e:
        print(f"[FATAL] Failed to create uploads folder: {e}")
        sys.exit(1)

# ==============================================================================
# 2. FUTURISTIC LOGGING ENGINE
# ==============================================================================
class Logger:
    """
    Console log emitter formatted to bypass Cp1252 Windows encoding crashes.
    Strictly uses ASCII tags and clean terminal formats.
    """
    @staticmethod
    def info(message):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [INFO] {message}")

    @staticmethod
    def success(message):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [OK  ] {message}")

    @staticmethod
    def warning(message):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [WARN] {message}")

    @staticmethod
    def error(message):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [ERR ] {message}")

    @staticmethod
    def database(message):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [DB  ] {message}")

# ==============================================================================
# 3. DATABASE INFRASTRUCTURE & MIGRATIONS
# ==============================================================================
def get_db_connection():
    """
    Spawns a new connection to the SQLite database.
    Configures Row factory for object key mappings.
    """
    try:
        conn = sqlite3.connect(DB_FILE, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        Logger.error(f"Failed to connect to SQLite DB: {e}")
        raise e

def init_db():
    """
    Initializes SQL tables. Runs migrations, creates indexes for optimized 
    lookups, and seeds the fleet list table with default collar settings.
    """
    Logger.info("Starting SQLite schema initialization...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Table A: Alerts (Central warning log)
        Logger.database("Checking Table: alerts")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            location TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            plastic_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('pending', 'in-progress', 'resolved')),
            time TEXT NOT NULL,
            date TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            animal_name TEXT NOT NULL,
            animal_emoji TEXT NOT NULL,
            animal_type TEXT NOT NULL,
            before_img TEXT,
            after_img TEXT
        )
        """)
        
        # Creating index on timestamp for fast sorting
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)")

        # Table B: Fleet (Active stray collar nodes)
        Logger.database("Checking Table: fleet")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS fleet (
            collar_id TEXT PRIMARY KEY,
            animal_name TEXT NOT NULL,
            animal_emoji TEXT NOT NULL,
            animal_type TEXT NOT NULL,
            battery INTEGER NOT NULL CHECK(battery >= 0 AND battery <= 100),
            status TEXT NOT NULL CHECK(status IN ('online', 'offline', 'charging')),
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            last_ping INTEGER NOT NULL
        )
        """)

        # Dynamically migrate database schema if last_ping column is missing from the existing user database
        cursor.execute("PRAGMA table_info(fleet)")
        columns = [row[1] for row in cursor.fetchall()]
        if columns and "last_ping" not in columns:
            Logger.database("Migrating Table: Adding last_ping to fleet")
            cursor.execute("ALTER TABLE fleet ADD COLUMN last_ping INTEGER DEFAULT 0")

        # Table C: Twilio SMS logs (Simulated SMS gateway auditing)
        Logger.database("Checking Table: sms_logs")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sms_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            recipient TEXT NOT NULL,
            message TEXT NOT NULL
        )
        """)

        # Table D: System Audit Logs (Telemetry audit trail)
        Logger.database("Checking Table: system_logs")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            log_level TEXT NOT NULL,
            module TEXT NOT NULL,
            message TEXT NOT NULL
        )
        """)

        # Seed initial collar devices if empty
        cursor.execute("SELECT COUNT(*) FROM fleet")
        if cursor.fetchone()[0] == 0:
            Logger.database("Seeding active collar fleet database records...")
            current_time = int(time.time())
            collars = [
                ("EC-2024-0042", "Rocky", "🐕", "Street Dog", 87, "online", 28.6139, 77.2090, current_time),
                ("EC-2024-0089", "Bella", "🐱", "Stray Cat", 92, "online", 28.5930, 77.2195, current_time),
                ("EC-2024-0125", "Max", "🐕", "Street Dog", 79, "online", 28.6129, 77.2295, current_time),
                ("EC-2024-0312", "Luna", "🐱", "Stray Cat", 84, "online", 28.5960, 77.2360, current_time),
                ("EC-2024-0450", "Charlie", "🐒", "Monkey", 68, "online", 28.5400, 77.1850, current_time),
                ("EC-2024-0711", "Daisy", "🐄", "Cow", 95, "online", 28.5740, 77.1640, current_time)
            ]
            cursor.executemany("""
            INSERT INTO fleet (collar_id, animal_name, animal_emoji, animal_type, battery, status, lat, lng, last_ping)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, collars)
            Logger.success("Database pre-populated with active collar trackers.")
            
        conn.commit()
        Logger.success("SQLite Database scheme validation complete.")
    except Exception as e:
        conn.rollback()
        Logger.error(f"Database schema initialization crash: {e}")
        sys.exit(1)
    finally:
        conn.close()

# Initialize Database Schema at Boot
init_db()

# ==============================================================================
# 4. MULTIPART FORM-DATA DECODER
# ==============================================================================
def parse_multipart_payload(body_bytes, boundary):
    """
    Advanced binary parser for multipart/form-data payloads.
    Directly extracts fields and saves uploaded files without third-party tools.
    """
    boundary_bytes = b'--' + boundary.encode('utf-8')
    parts = body_bytes.split(boundary_bytes)
    
    text_fields = {}
    extracted_files = {}

    for part in parts:
        # Ignore empty segments
        if not part or part == b'\r\n' or part == b'--\r\n' or part == b'--':
            continue
        
        # Locate CRLF splits between headers and binary body
        header_split = part.find(b'\r\n\r\n')
        if header_split == -1:
            continue
            
        header_chunk = part[:header_split]
        content_chunk = part[header_split + 4:]
        
        # Clean trailing CRLF added by browser
        if content_chunk.endswith(b'\r\n'):
            content_chunk = content_chunk[:-2]
            
        try:
            headers_str = header_chunk.decode('utf-8', errors='ignore')
        except Exception:
            continue

        # Extract name and filename attributes from Content-Disposition
        field_name = None
        attached_filename = None
        
        for line in headers_str.split('\r\n'):
            if line.lower().startswith('content-disposition:'):
                parameters = line.split(';')
                for param in parameters:
                    param = param.strip()
                    if param.startswith('name='):
                        field_name = param.split('=')[1].strip('"')
                    elif param.startswith('filename='):
                        attached_filename = param.split('=')[1].strip('"')
                        
        if field_name:
            if attached_filename:
                extracted_files[field_name] = {
                    'filename': attached_filename,
                    'content': content_chunk
                }
                Logger.info(f"Extracted file field '{field_name}': {attached_filename} ({len(content_chunk)} bytes)")
            else:
                text_fields[field_name] = content_chunk.decode('utf-8', errors='ignore')
                Logger.info(f"Extracted parameter field '{field_name}': {text_fields[field_name]}")
                
    return text_fields, extracted_files

# ==============================================================================
# 5. CORE ROUTING CONTROLLER
# ==============================================================================
class RequestController(BaseHTTPRequestHandler):
    """
    Main web controller. Maps incoming GET and POST requests.
    Includes custom static file serving and JSON REST APIs.
    """

    def log_message(self, format, *args):
        # Override BaseHTTPRequestHandler output logger to route via our clean Logger
        Logger.info(f"Request: {self.client_address[0]} - {format%args}")

    def send_cors_headers(self):
        """
        Injects standard cross-origin resource sharing headers.
        """
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def return_json(self, payload_dict, status_code=200):
        """
        Serializes and transmits JSON response payloads.
        """
        try:
            serialized_data = json.dumps(payload_dict).encode('utf-8')
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(serialized_data)
        except Exception as e:
            Logger.error(f"Error returning JSON payload: {e}")
            self.send_error_response("Internal Server Serialization Error", 500)

    def send_error_response(self, error_message, status_code=400):
        """
        Standard error response helper.
        """
        self.return_json({
            "success": False,
            "status": status_code,
            "message": error_message,
            "timestamp": int(time.time())
        }, status_code)

    def do_OPTIONS(self):
        """
        Handles pre-flight checks.
        """
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    # --------------------------------------------------------------------------
    # HTTP GET REQUEST INTERCEPTOR
    # --------------------------------------------------------------------------
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        route = parsed_path.path
        
        # --- API GATEWAY ROUTINGS ---
        
        # Route A: GET /api/alerts (Retrieves alert history log)
        if route == "/api/alerts":
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM alerts ORDER BY timestamp DESC")
                rows = cursor.fetchall()
                conn.close()
                
                alerts = [dict(r) for r in rows]
                return self.return_json(alerts)
            except Exception as e:
                Logger.error(f"Database read failure on GET /api/alerts: {e}")
                return self.send_error_response("Database read transaction failed", 500)

        # Route B: GET /api/fleet (Retrieves stray animal hardware settings)
        elif route == "/api/fleet":
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM fleet")
                rows = cursor.fetchall()
                conn.close()
                
                fleet_list = [dict(r) for r in rows]
                return self.return_json(fleet_list)
            except Exception as e:
                Logger.error(f"Database read failure on GET /api/fleet: {e}")
                return self.send_error_response("Database read transaction failed", 500)

        # Route C: GET /api/sms (Retrieves SMS logs)
        elif route == "/api/sms":
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM sms_logs ORDER BY id DESC LIMIT 50")
                rows = cursor.fetchall()
                conn.close()
                
                logs = [dict(r) for r in rows]
                return self.return_json(logs)
            except Exception as e:
                Logger.error(f"Database read failure on GET /api/sms: {e}")
                return self.send_error_response("Database read transaction failed", 500)

        # Route D: GET /api/stats (Efficacy aggregates calculations)
        elif route == "/api/stats":
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM alerts")
                alerts_rows = cursor.fetchall()
                conn.close()
                
                total = len(alerts_rows)
                pending = sum(1 for a in alerts_rows if a['status'] == 'pending')
                in_progress = sum(1 for a in alerts_rows if a['status'] == 'in-progress')
                resolved = sum(1 for a in alerts_rows if a['status'] == 'resolved')
                
                # Weight calculations (PET = 2.2kg, HDPE = 3.1kg, PVC = 4.5kg, LDPE = 1.8kg, default = 1.5kg)
                accumulated_weight = 0.0
                for alert in alerts_rows:
                    if alert['status'] == 'resolved':
                        ptype = alert['plastic_type'].lower()
                        if 'pet' in ptype:
                            accumulated_weight += 2.2
                        elif 'hdpe' in ptype:
                            accumulated_weight += 3.1
                        elif 'pvc' in ptype:
                            accumulated_weight += 4.5
                        elif 'ldpe' in ptype:
                            accumulated_weight += 1.8
                        else:
                            accumulated_weight += 1.5
                
                accumulated_weight = round(accumulated_weight, 1)
                co2_offset = round(accumulated_weight * 1.5, 1) # 1kg plastic recycling = 1.5kg CO2 offset
                area_cleaned = resolved * 25 # Each resolution = 25m2 sanitized area
                
                # Breakdown by polymer types
                polymer_counts = {}
                for alert in alerts_rows:
                    if alert['status'] == 'resolved':
                        ptype = alert['plastic_type'].split(' - ')[0].strip()
                        polymer_counts[ptype] = polymer_counts.get(ptype, 0) + 1
                
                # Turn counts to percentages
                total_res = max(1, resolved)
                polymer_splits = {k: round((v / total_res) * 100) for k, v in polymer_counts.items()}
                
                stats_payload = {
                    "total": total,
                    "pending": pending,
                    "in_progress": in_progress,
                    "resolved": resolved,
                    "weight": accumulated_weight,
                    "co2": co2_offset,
                    "area": area_cleaned,
                    "polymers": polymer_splits,
                    "version": SERVER_VERSION,
                    "server_time": int(time.time())
                }
                return self.return_json(stats_payload)
            except Exception as e:
                Logger.error(f"Database error on GET /api/stats: {e}")
                return self.send_error_response("Database read transaction failed", 500)

        # --- STATIC FILE SERVER CONTROLS ---
        else:
            # Map request path to local project workspace
            target_uri = route
            if target_uri == "/":
                target_uri = "/index.html"
                
            local_file_path = target_uri.lstrip("/")
            
            # Fallback to frontend/ directory if the file does not exist in root
            if not os.path.exists(local_file_path) and os.path.exists("frontend/" + local_file_path):
                local_file_path = "frontend/" + local_file_path
                
            # Prevent directory traversal attacks
            normalized_path = os.path.normpath(local_file_path)
            if normalized_path.startswith("..") or os.path.isabs(normalized_path):
                Logger.warning(f"Prevented directory traversal access: {route}")
                return self.send_error_response("Permission denied", 403)

            # Check if file exists and serve
            if os.path.exists(normalized_path) and os.path.isfile(normalized_path):
                extension = os.path.splitext(normalized_path)[1].lower()
                
                # Content type mappings
                mime_mappings = {
                    ".html": "text/html",
                    ".css": "text/css",
                    ".js": "application/javascript",
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".gif": "image/gif",
                    ".svg": "image/svg+xml",
                    ".json": "application/json",
                    ".db": "application/octet-stream"
                }
                
                content_type = mime_mappings.get(extension, "text/plain")
                
                try:
                    self.send_response(200)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                    self.end_headers()
                    
                    with open(normalized_path, "rb") as f:
                        self.wfile.write(f.read())
                except Exception as e:
                    Logger.error(f"Error serving static asset '{normalized_path}': {e}")
                    # If socket disconnected while writing, ignore
            else:
                Logger.warning(f"File not found on GET request: {normalized_path}")
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"404 Not Found")

    # --------------------------------------------------------------------------
    # HTTP POST REQUEST INTERCEPTOR
    # --------------------------------------------------------------------------
    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        route = parsed_path.path
        
        content_length = int(self.headers.get('Content-Length', 0))
        content_type = self.headers.get('Content-Type', '')
        
        # Read incoming request body bytes
        body_bytes = self.rfile.read(content_length)

        # Route E: POST /api/login (Validates employee role access)
        if route == "/api/login":
            try:
                login_payload = json.loads(body_bytes.decode('utf-8'))
                username = login_payload.get("username", "").strip()
                password = login_payload.get("password", "").strip()
                
                if not username or not password:
                    return self.send_error_response("Missing credential parameters", 400)
                
                # Check logins
                if username == "admin" and password == "admin":
                    Logger.success(f"Admin Authenticated successfully: {username}")
                    return self.return_json({"success": True, "role": "admin", "token": "MOCK-JWT-ADMIN"})
                elif username == "worker" and password == "worker":
                    Logger.success(f"Field Worker Authenticated successfully: {username}")
                    return self.return_json({"success": True, "role": "worker", "token": "MOCK-JWT-WORKER"})
                else:
                    Logger.warning(f"Failed login attempt for username: {username}")
                    return self.send_error_response("Invalid credentials. Try admin/admin or worker/worker", 401)
            except Exception as e:
                Logger.error(f"Error processing POST /api/login: {e}")
                return self.send_error_response("Invalid JSON parsing", 400)

        # Route F: POST /api/alerts (IoT Collar / ML Script webhook receiver)
        elif route == "/api/alerts":
            try:
                alert_payload = json.loads(body_bytes.decode('utf-8'))
                
                # Normalize snake_case keys to camelCase keys for compatibility with both PC ML scripts and browser payloads
                key_mappings = {
                    "plastic_type": "plasticType",
                    "animal_name": "animalName",
                    "animal_emoji": "animalEmoji",
                    "animal_type": "animalType",
                    "collarId": "collar_id"
                }
                for src_key, dest_key in key_mappings.items():
                    if src_key in alert_payload and dest_key not in alert_payload:
                        alert_payload[dest_key] = alert_payload[src_key]
                if "collar_id" in alert_payload and "collarId" not in alert_payload:
                    alert_payload["collarId"] = alert_payload["collar_id"]

                # Validate inputs
                required_fields = ["id", "location", "lat", "lng", "plasticType", "severity", "time", "date", "timestamp", "animalName", "animalEmoji", "animalType"]
                missing_fields = [f for f in required_fields if f not in alert_payload]
                
                if missing_fields:
                    Logger.warning(f"Alert rejected: Missing payload fields {missing_fields}")
                    return self.send_error_response(f"Missing required parameters: {missing_fields}", 400)

                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Update battery levels on matching collar device if ping payload has it
                if "collar_id" in alert_payload and "battery" in alert_payload:
                    cursor.execute("""
                    UPDATE fleet 
                    SET battery = ?, lat = ?, lng = ?, last_ping = ? 
                    WHERE collar_id = ?
                    """, (
                        alert_payload["battery"], 
                        alert_payload["lat"], 
                        alert_payload["lng"], 
                        int(time.time()), 
                        alert_payload["collar_id"]
                    ))
                
                # Record alert warning
                cursor.execute("""
                INSERT INTO alerts (
                    id, location, lat, lng, plastic_type, severity, status, 
                    time, date, timestamp, animal_name, animal_emoji, animal_type, 
                    before_img, after_img
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    alert_payload["id"],
                    alert_payload["location"],
                    alert_payload["lat"],
                    alert_payload["lng"],
                    alert_payload["plasticType"],
                    alert_payload["severity"],
                    "pending",
                    alert_payload["time"],
                    alert_payload["date"],
                    alert_payload["timestamp"],
                    alert_payload["animalName"],
                    alert_payload["animalEmoji"],
                    alert_payload["animalType"],
                    alert_payload.get("before_img", "images/plastic-alert-default.png"),
                    ""
                ))
                
                # Log audit log
                cursor.execute("""
                INSERT INTO system_logs (timestamp, log_level, module, message)
                VALUES (?, ?, ?, ?)
                """, (
                    time.strftime("%Y-%m-%d %H:%M:%S"),
                    "ALERTS",
                    "COLLAR_RECEIVER",
                    f"Collar {alert_payload['id']} reported {alert_payload['plasticType']} at {alert_payload['location']}"
                ))

                conn.commit()
                conn.close()
                
                Logger.success(f"New alert recorded: {alert_payload['id']} - {alert_payload['plasticType']} at {alert_payload['location']}")
                return self.return_json({"success": True, "message": "Alert payload logged successfully."})
            except Exception as e:
                Logger.error(f"Error processing POST /api/alerts: {e}")
                return self.send_error_response("Failed database insert transaction", 500)

        # Route G: POST /api/deploy (Assigns workers and sends Twilio SMS logs)
        elif route == "/api/deploy":
            try:
                deploy_payload = json.loads(body_bytes.decode('utf-8'))
                target_ids = deploy_payload.get("ids", [])
                
                if not target_ids:
                    return self.send_error_response("Missing target alert ID array 'ids'", 400)

                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Check alerts exist
                placeholders = ",".join("?" for _ in target_ids)
                existing = conn.execute(f"SELECT id, location, plastic_type FROM alerts WHERE id IN ({placeholders})", target_ids).fetchall()
                
                if not existing:
                    conn.close()
                    return self.send_error_response("No matching alert IDs found in database", 404)
                
                # Update status
                cursor.execute(f"UPDATE alerts SET status = 'in-progress' WHERE id IN ({placeholders})", target_ids)
                
                # Log SMS logs (Simulated Twilio dispatch messages)
                timestamp_str = time.strftime("%H:%M:%S")
                for row in existing:
                    alert_id = row["id"]
                    location = row["location"]
                    material = row["plastic_type"]
                    
                    sms_text = f"[SMS] Dispatched Crew Alpha to resolve {material} cluster at {location}. Route: http://localhost:8000/?portal=worker"
                    cursor.execute("INSERT INTO sms_logs (timestamp, recipient, message) VALUES (?, ?, ?)",
                                   (timestamp_str, "Crew Alpha", sms_text))
                    
                    Logger.info(f"Simulating Twilio Gateway dispatch for alert {alert_id}...")

                conn.commit()
                conn.close()
                
                Logger.success(f"Crews dispatched to {len(existing)} alert hotspots.")
                return self.return_json({"success": True, "message": f"Successfully dispatched crews to {len(existing)} nodes."})
            except Exception as e:
                Logger.error(f"Error processing POST /api/deploy: {e}")
                return self.send_error_response("Database dispatch transaction failed", 500)

        # Route H: POST /api/resolve (Worker proof upload receiver)
        elif route == "/api/resolve":
            try:
                # Retrieve multipart boundary from Content-Type header
                boundary = ""
                for segment in content_type.split(";"):
                    segment = segment.strip()
                    if segment.startswith("boundary="):
                        boundary = segment.split("=")[1].strip()
                        
                if not boundary:
                    Logger.warning("Resolve request rejected: Missing multipart boundary")
                    return self.send_error_response("Missing multipart boundary descriptor", 400)
                
                # Decode form parts
                fields, files = parse_multipart_payload(body_bytes, boundary)
                
                alert_id = fields.get("alertId")
                image_file = files.get("image")
                
                if not alert_id:
                    return self.send_error_response("Required form parameter 'alertId' is missing", 400)
                if not image_file:
                    return self.send_error_response("Required verification file attachment 'image' is missing", 400)

                # Save verification proof file to /uploads
                original_name = image_file['filename']
                sanitized_name = "".join(c for c in original_name if c.isalnum() or c in ['.', '_', '-']).strip()
                unique_filename = f"proof_{int(time.time())}_{sanitized_name}"
                destination_path = os.path.join(UPLOAD_DIR, unique_filename)
                
                with open(destination_path, "wb") as f:
                    f.write(image_file['content'])
                
                # Save path relative to root
                db_image_path = destination_path.replace("\\", "/")
                
                conn = get_db_connection()
                cursor = conn.cursor()
                
                # Check alert existence
                row = conn.execute("SELECT location, plastic_type FROM alerts WHERE id = ?", (alert_id,)).fetchone()
                if not row:
                    conn.close()
                    # Delete uploaded file if DB has no record
                    if os.path.exists(destination_path):
                        os.remove(destination_path)
                    return self.send_error_response(f"No alert found in database for ID: {alert_id}", 404)
                
                loc = row["location"]
                material = row["plastic_type"]
                
                # Update status
                cursor.execute("UPDATE alerts SET status = 'resolved', after_img = ? WHERE id = ?", (db_image_path, alert_id))
                
                # Log audit log
                cursor.execute("""
                INSERT INTO system_logs (timestamp, log_level, module, message)
                VALUES (?, ?, ?, ?)
                """, (
                    time.strftime("%Y-%m-%d %H:%M:%S"),
                    "ALERTS",
                    "WORKER_RESOLVER",
                    f"Alert {alert_id} resolved. Verification image stored: {db_image_path}"
                ))
                
                conn.commit()
                conn.close()
                
                Logger.success(f"Hotspot resolved by worker: {alert_id} at {loc} - Image: {db_image_path}")
                return self.return_json({
                    "success": True, 
                    "message": "Resolution verified successfully. SQLite database records updated.",
                    "image_url": db_image_path
                })
            except Exception as e:
                Logger.error(f"Error processing POST /api/resolve: {e}")
                return self.send_error_response("Database resolution transaction failed", 500)
                
        else:
            Logger.warning(f"Resource not found: POST {route}")
            return self.send_error_response("API endpoint path not found", 404)

# ==============================================================================
# 6. RUN ENGINE
# ==============================================================================
def start_server():
    """
    Spawns the HTTP listener on Port 8000.
    Runs indefinitely until closed.
    """
    Logger.info("Starting EcoCollar Centralized IoT Gateway Web Service...")
    Logger.info(f"Target Port: {PORT}")
    
    server_address = ('', PORT)
    try:
        http_daemon = ThreadingHTTPServer(server_address, RequestController)
    except Exception as e:
        Logger.error(f"Port binding failure: {e}")
        sys.exit(1)
        
    Logger.success(f"System Operational! Interface: http://localhost:{PORT}")
    
    try:
        http_daemon.serve_forever()
    except KeyboardInterrupt:
        Logger.info("Keyboard interrupt received. Shutting down system nodes...")
        http_daemon.server_close()
        Logger.success("Server stopped successfully.")
        sys.exit(0)

if __name__ == "__main__":
    start_server()
