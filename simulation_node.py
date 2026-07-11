#!/usr/bin/env python3
"""
=============================================================================
ECOCOLLAR PROJECT: MULTI-AGENT IoT TELEMETRY & GPS SIMULATOR
=============================================================================
This script simulates multiple stray animals equipped with EcoCollar IoT nodes.
Each virtual node runs independently, executing:
  - Random-walk GPS roaming across geographic bounds (Delhi NCR sectors)
  - Sensor fusion modeling (IR Reflectance noise, battery drain, temperature)
  - Autonomic environmental plastic waste scanning
  - REST API synchronization with the centralized server gateway
  - Local actuator feedback loops (actuating buzzers/motors on high IR scans)

Author: Antigravity AI Core Engine
Version: 1.0.0
=============================================================================
"""

import time
import random
import requests
import threading
import sys
from datetime import datetime

# Central server endpoint
GATEWAY_URL = "http://localhost:8000"

# Simulation configuration
NUM_AGENTS = 8
GPS_CENTER = (28.6139, 77.2090)  # Delhi center
ROAMING_STEP = 0.0005             # Step scale for random walk
TICK_INTERVAL = 3.0               # Loop interval in seconds
COOLDOWN_PULSE = 12.0             # Alerts interval limit per collar

# Seed animals database
ANIMAL_PROFILES = [
    {"name": "Rocky", "type": "Street Dog", "emoji": "🐕"},
    {"name": "Bella", "type": "Street Dog", "emoji": "🐶"},
    {"name": "Clyde", "type": "Stray Cattle", "emoji": "🐂"},
    {"name": "Ganga", "type": "Stray Cattle", "emoji": "🐄"},
    {"name": "Milo", "type": "Stray Cattle", "emoji": "🐃"},
    {"name": "Raja", "type": "Monkey", "emoji": "🐒"},
    {"name": "Chiku", "type": "Monkey", "emoji": "🐵"},
    {"name": "Sheru", "type": "Street Dog", "emoji": "🐕‍🦺"}
]

PLASTIC_MATERIALS = [
    "PET Plastic Bottle",
    "Single-Use Plastic Bag",
    "LDPE Wrap Film",
    "HDPE Milk Jug Container",
    "Polystyrene Cup",
    "PP Food Wrapper"
]

MUNICIPAL_SECTORS = [
    "Central Park Sector 4",
    "Connaught Place Block G",
    "Lodi Gardens East Sector",
    "Metro Station Junction 12",
    "Okhla Industrial Block B",
    "Siri Fort Residential Area",
    "Rajendra Nagar Market",
    "Karol Bagh Sector 3"
]

class VirtualCollarAgent:
    """
    Represents an autonomous EcoCollar IoT collar agent running EdgeML logic.
    """
    def __init__(self, agent_id, profile, start_lat, start_lng):
        self.collar_id = agent_id
        self.name = profile["name"]
        self.type = profile["type"]
        self.emoji = profile["emoji"]
        
        # Telemetry State
        self.lat = start_lat
        self.lng = start_lng
        self.battery = random.randint(75, 100)
        self.temperature = random.uniform(28.0, 36.0)
        self.ir_reflectance = 120  # Range: 0 - 1024
        
        # Actuators
        self.buzzer_active = False
        self.motor_active = False
        
        # Thread Controller
        self.running = False
        self.lock = threading.Lock()
        self.last_alert_time = 0
        
        print(f"[INIT] Spawned Agent {self.collar_id}: {self.emoji} {self.name} ({self.type})")

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self.run_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False

    def roam_step(self):
        """
        Executes a constrained random walk to simulate animal foraging.
        """
        with self.lock:
            # Constrain to reasonable city boundary
            delta_lat = random.uniform(-ROAMING_STEP, ROAMING_STEP)
            delta_lng = random.uniform(-ROAMING_STEP, ROAMING_STEP)
            self.lat += delta_lat
            self.lng += delta_lng
            
            # Minor battery drain
            self.battery = max(2, self.battery - random.choice([0, 1, 0, 0, 0, 2]))
            
            # Minor temp fluctuation
            self.temperature = max(20.0, min(42.0, self.temperature + random.uniform(-0.5, 0.5)))

    def simulate_sensors(self):
        """
        Models sensor values representing environmental interaction.
        """
        with self.lock:
            # Under normal roaming, IR values stay low (ground/dirt/grass).
            # When an animal approaches trash, IR values spike due to plastic reflectivity.
            if random.random() < 0.15:  # 15% chance of finding trash
                self.ir_reflectance = random.randint(650, 950)
            else:
                self.ir_reflectance = random.randint(80, 220)

            # Local Autonomic Closed-Loop Edge Rule
            if self.ir_reflectance > 600:
                self.buzzer_active = True
                self.motor_active = True
            else:
                self.buzzer_active = False
                self.motor_active = False

    def transmit_telemetry(self):
        """
        POST telemetry reports to the server.py database endpoints.
        """
        # Formulate API request payload
        payload = {
            "collar_id": self.collar_id,
            "animal_name": self.name,
            "animal_type": self.type,
            "animal_emoji": self.emoji,
            "lat": round(self.lat, 6),
            "lng": round(self.lng, 6),
            "battery": self.battery,
            "temperature": round(self.temperature, 1),
            "ir_reflectance": self.ir_reflectance,
            "status": "online" if self.battery > 5 else "low-battery",
            "buzzer_active": 1 if self.buzzer_active else 0,
            "motor_active": 1 if self.motor_active else 0
        }
        
        try:
            res = requests.post(f"{GATEWAY_URL}/api/telemetry", json=payload, timeout=2)
            if res.status_code != 200:
                print(f"[WARN] Agent {self.name} telemetry POST returned code {res.status_code}")
        except Exception as e:
            print(f"[ERROR] Telemetry sync failed for {self.name}: {e}")

    def evaluate_plastic_alert(self):
        """
        Simulates EdgeML object detection triggering a centralized municipal alert.
        """
        current_time = time.time()
        
        # Trigger condition: high IR sensor and not in cooldown
        if self.ir_reflectance > 600 and (current_time - self.last_alert_time > COOLDOWN_PULSE):
            self.last_alert_time = current_time
            material = random.choice(PLASTIC_MATERIALS)
            sector = random.choice(MUNICIPAL_SECTORS)
            
            payload = {
                "id": f"EC-SIM-{int(current_time * 100) % 100000}",
                "location": f"{sector}",
                "lat": round(self.lat, 6),
                "lng": round(self.lng, 6),
                "plastic_type": material,
                "severity": "HIGH" if random.random() > 0.4 else "MEDIUM",
                "status": "pending",
                "time": datetime.now().strftime("%I:%M:%S %p"),
                "date": datetime.now().strftime("%b %d, %Y"),
                "timestamp": int(current_time * 1000),
                "animal_name": self.name,
                "animal_emoji": self.emoji,
                "animal_type": self.type,
                "before_img": "images/plastic-alert-default.png",
                "after_img": ""
            }
            
            try:
                res = requests.post(f"{GATEWAY_URL}/api/alerts", json=payload, timeout=2)
                if res.status_code == 200:
                    print(f"[🚨 ALERT] {self.emoji} {self.name} detected '{material}' at {sector}! Sent to Dispatch.")
            except Exception as e:
                print(f"[ERROR] Alert dispatch failed for {self.name}: {e}")

    def run_loop(self):
        """
        Active thread runner executing loops.
        """
        # Initial jitter to desynchronize requests
        time.sleep(random.uniform(0.1, TICK_INTERVAL))
        
        while self.running:
            try:
                self.roam_step()
                self.simulate_sensors()
                self.transmit_telemetry()
                self.evaluate_plastic_alert()
            except Exception as e:
                print(f"[CRITICAL ERROR] Loop thread crash in agent {self.collar_id}: {e}")
            
            time.sleep(TICK_INTERVAL)

def start_simulation():
    """
    Spawns all virtual agents and executes the monitoring console.
    """
    print("=" * 60)
    print(" ECOCOLLAR MULTI-AGENT IoT TELEMETRY NODE SIMULATOR")
    print(" Press Ctrl+C in this window to stop telemetry stream.")
    print("=" * 60)
    
    agents = []
    
    # Spawn agents around Delhi bounds
    for i in range(NUM_AGENTS):
        profile = ANIMAL_PROFILES[i % len(ANIMAL_PROFILES)]
        start_lat = GPS_CENTER[0] + random.uniform(-0.04, 0.04)
        start_lng = GPS_CENTER[1] + random.uniform(-0.04, 0.04)
        agent = VirtualCollarAgent(f"EC-NODE-{100 + i}", profile, start_lat, start_lng)
        agents.append(agent)
        agent.start()

    try:
        # Keep main thread alive and print quick console telemetry overview
        while True:
            time.sleep(5.0)
            print(f"\n[CONSOLE SUMMARY] Time: {datetime.now().strftime('%H:%M:%S')}")
            for a in agents:
                status = "🔴 LOCK" if a.buzzer_active else "🟢 ROAM"
                print(f"  Node {a.collar_id} ({a.name}): Battery: {a.battery}% | Temp: {a.temperature:.1f}°C | IR: {a.ir_reflectance} | State: {status}")
    except KeyboardInterrupt:
        print("\n[INFO] Terminating all simulation agents...")
        for a in agents:
            a.stop()
        print("[SUCCESS] All virtual collars safely halted.")

if __name__ == "__main__":
    # Safety: Verify gateway is up
    try:
        requests.get(GATEWAY_URL, timeout=2)
    except Exception:
        print(f"[ERROR] Could not connect to EcoCollar Server at {GATEWAY_URL}!")
        print("Please make sure you have run 'python server.py' in a separate terminal before launching simulation.")
        sys.exit(1)
        
    start_simulation()
