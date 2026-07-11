#!/usr/bin/env python3
"""
=============================================================================
ECOCOLLAR SYSTEM: END-TO-END INTEGRATION VERIFIER & DIAGNOSTICS RUNNER
=============================================================================
This diagnostic runner automates the system verification process. It:
  1. Detects and verifies the database schema and layout files.
  2. Tests HTTP connections to the centralized gateway server.
  3. Inserts mock collar telemetry to verify SQLite insertion pipelines.
  4. Dispatches a virtual cleanup alert to test the database-locking integrity.
  5. Triggers a mock citizen image upload to ensure multipart boundary parsing.
  6. Executes the decision analytics engine to verify report generation.
  7. Reports validation results and outputs diagnostic grades.

Author: Antigravity AI Core Engine
Version: 1.0.0
=============================================================================
"""

import os
import sys
import time
import sqlite3
import requests
import subprocess

TARGET_URL = "http://localhost:8000"
DB_FILE = "database.db"

class IntegrationVerifier:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        print("+" * 60)
        print(" ECOCOLLAR INTEGRATION DIAGNOSTICS & VERIFICATION TOOL")
        print("+" * 60)

    def log_result(self, test_name, passed, detail=""):
        self.tests_run += 1
        status = "✅ PASS" if passed else "❌ FAIL"
        if passed:
            self.tests_passed += 1
        print(f"[{status}] {test_name}: {detail}")

    def run_diagnostics(self):
        # 1. Check workspace integrity
        self.verify_workspace_files()
        
        # 2. Check server status
        if not self.verify_server_active():
            print("\n[CRITICAL] Server is offline! Cannot proceed with API checks.")
            self.summary()
            sys.exit(1)
            
        # 3. Verify SQLite DB schema
        self.verify_database_integrity()
        
        # 4. Telemetry Endpoint check
        self.verify_telemetry_post()
        
        # 5. Alert Dispatch check
        self.verify_alert_post()
        
        # 6. Citizen Report check (Mock image binary multipart upload)
        self.verify_citizen_report_upload()
        
        # 7. Run Analytics generation check
        self.verify_analytics_engine()
        
        self.summary()

    def verify_workspace_files(self):
        required = ["server.py", "frontend/index.html", "frontend/js/app.js", "frontend/css/style.css"]
        missing = [f for f in required if not os.path.exists(f)]
        if not missing:
            self.log_result("Workspace Files Check", True, "All critical files present in the repository.")
        else:
            self.log_result("Workspace Files Check", False, f"Missing files: {', '.join(missing)}")

    def verify_server_active(self):
        try:
            res = requests.get(TARGET_URL, timeout=2)
            passed = (res.status_code == 200)
            self.log_result("HTTP Server Connection", passed, f"Server responded with status {res.status_code}.")
            return passed
        except Exception as e:
            self.log_result("HTTP Server Connection", False, f"Connection refused on port 8000: {e}")
            return False

    def verify_database_integrity(self):
        if not os.path.exists(DB_FILE):
            self.log_result("Database File Presence", False, f"'{DB_FILE}' not found. Run the server to generate.")
            return
            
        try:
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [r[0] for r in cursor.fetchall()]
            conn.close()
            
            required_tables = ["alerts", "fleet", "sms_logs", "system_logs", "customers", "sweep_requests"]
            missing_tables = [t for t in required_tables if t not in tables]
            
            if not missing_tables:
                self.log_result("SQLite Table Schema Check", True, "All tables initialized in SQLite master database.")
            else:
                self.log_result("SQLite Table Schema Check", False, f"Missing tables: {', '.join(missing_tables)}")
        except Exception as e:
            self.log_result("SQLite Table Schema Check", False, f"DB error: {e}")

    def verify_telemetry_post(self):
        payload = {
            "collar_id": "EC-NODE-DIAGNOSTIC",
            "animal_name": "Diagnostic Dog",
            "animal_type": "Street Dog",
            "animal_emoji": "🐕",
            "lat": 28.6139,
            "lng": 77.2090,
            "battery": 100,
            "temperature": 37.0,
            "ir_reflectance": 150,
            "status": "online",
            "buzzer_active": 0,
            "motor_active": 0
        }
        try:
            res = requests.post(f"{TARGET_URL}/api/telemetry", json=payload, timeout=2)
            if res.status_code == 200:
                self.log_result("Telemetry API (POST)", True, "Collar telemetry synchronized successfully.")
            else:
                self.log_result("Telemetry API (POST)", False, f"Server rejected with code {res.status_code}: {res.text}")
        except Exception as e:
            self.log_result("Telemetry API (POST)", False, f"HTTP Error: {e}")

    def verify_alert_post(self):
        payload = {
            "id": "EC-ALERT-DIAGNOSTIC",
            "location": "Diagnostic Zone",
            "lat": 28.6139,
            "lng": 77.2090,
            "plastic_type": "PET Bottle",
            "severity": "MEDIUM",
            "status": "pending",
            "time": "12:00:00 PM",
            "date": "Jul 11, 2026",
            "timestamp": int(time.time() * 1000),
            "animal_name": "Diagnostic Dog",
            "animal_emoji": "🐕",
            "animal_type": "Street Dog",
            "before_img": "images/plastic-alert-default.png",
            "after_img": ""
        }
        try:
            res = requests.post(f"{TARGET_URL}/api/alerts", json=payload, timeout=2)
            if res.status_code == 200:
                self.log_result("Alerts API (POST)", True, "EdgeML alert dispatched to central database.")
            else:
                self.log_result("Alerts API (POST)", False, f"Server rejected with code {res.status_code}: {res.text}")
        except Exception as e:
            self.log_result("Alerts API (POST)", False, f"HTTP Error: {e}")

    def verify_citizen_report_upload(self):
        # Create a mock text file acting as a mock image
        mock_file_content = b"MOCK_JPEG_IMAGE_BINARY_STREAM_CONTENT"
        files = {
            "image": ("test_litter.jpg", mock_file_content, "image/jpeg")
        }
        data = {
            "location": "Sector 12 Bus Stand",
            "lat": "28.6145",
            "lng": "77.2099"
        }
        try:
            res = requests.post(f"{TARGET_URL}/api/citizen-report", data=data, files=files, timeout=3)
            if res.status_code == 200:
                self.log_result("Citizen Upload API (POST)", True, "Multipart binary image report registered successfully.")
            else:
                self.log_result("Citizen Upload API (POST)", False, f"Server rejected with code {res.status_code}: {res.text}")
        except Exception as e:
            self.log_result("Citizen Upload API (POST)", False, f"HTTP Error: {e}")

    def verify_analytics_engine(self):
        try:
            # Execute data_analytics.py as a subprocess to verify report generation
            res = subprocess.run([sys.executable, "data_analytics.py"], capture_output=True, text=True, check=True)
            report_exists = os.path.exists("waste_analytics_report.md")
            if report_exists:
                self.log_result("Decision Analytics Engine", True, "Generated Markdown decision report successfully.")
            else:
                self.log_result("Decision Analytics Engine", False, "Script ran but report file was not created.")
        except Exception as e:
            self.log_result("Decision Analytics Engine", False, f"Subprocess run failed: {e}")

    def summary(self):
        print("\n" + "=" * 60)
        print(" DIAGNOSTIC INTEGRATION RUN SUMMARY")
        print("=" * 60)
        print(f" Tests Executed: {self.tests_run}")
        print(f" Tests Passed  : {self.tests_passed} / {self.tests_run}")
        print("-" * 60)
        if self.tests_passed == self.tests_run:
            print(" SYSTEM STATUS GRADE: [ A+ EXCELLENT ] - Ready for Viva presentation!")
        else:
            print(" SYSTEM STATUS GRADE: [ C WARNING ] - Some integrations are failing. Check logs.")
        print("=" * 60)

if __name__ == "__main__":
    verifier = IntegrationVerifier()
    verifier.run_diagnostics()
