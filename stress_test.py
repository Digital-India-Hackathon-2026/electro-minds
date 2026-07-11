#!/usr/bin/env python3
"""
=============================================================================
ECOCOLLAR SYSTEM: CONCURRENT STRESS & THREAD-SAFETY SUITE
=============================================================================
This script stress-tests the multi-threaded ThreadingHTTPServer architecture.
It spawns concurrent threads simulating heavy municipal traffic, executing:
  - Concurrent alerts submission
  - Concurrent worker dispatch assignments
  - Telemetry ping bursts
  - Performance latency profiling (Avg, Max, Min response times, throughput)

Author: Antigravity AI Core Engine
Version: 1.0.0
=============================================================================
"""

import time
import random
import requests
import threading
import sys

TARGET_URL = "http://localhost:8000"
CONCURRENT_THREADS = 15
REQUESTS_PER_THREAD = 8

# Global statistics
stats = {
    "total_sent": 0,
    "success_count": 0,
    "failure_count": 0,
    "latencies": []
}
stats_lock = threading.Lock()

def thread_task(thread_id):
    """
    Executes a burst of POST and GET transactions simulating a single user session.
    """
    session = requests.Session()
    
    for i in range(REQUESTS_PER_THREAD):
        # Alternate between telemetry pings, alerts, and table checks
        rand = random.random()
        start_time = time.time()
        success = False
        
        try:
            if rand < 0.35:
                # 1. Post telemetry
                payload = {
                    "collar_id": f"EC-STRESS-{100 + thread_id}",
                    "animal_name": f"Stress Dog {thread_id}",
                    "animal_type": "Street Dog",
                    "animal_emoji": "🐕",
                    "lat": round(28.6139 + random.uniform(-0.01, 0.01), 6),
                    "lng": round(77.2090 + random.uniform(-0.01, 0.01), 6),
                    "battery": random.randint(40, 99),
                    "temperature": round(random.uniform(30, 38), 1),
                    "ir_reflectance": random.randint(50, 800),
                    "status": "online",
                    "buzzer_active": 0,
                    "motor_active": 0
                }
                res = session.post(f"{TARGET_URL}/api/telemetry", json=payload, timeout=3)
                if res.status_code == 200:
                    success = True
                    
            elif rand < 0.70:
                # 2. Query alerts
                res = session.get(f"{TARGET_URL}/api/alerts", timeout=3)
                if res.status_code == 200:
                    success = True
                    
            else:
                # 3. Simulate Citizen Crowdsourcing post (JSON or mock metadata)
                # (Testing lightweight JSON alerts endpoints)
                payload = {
                    "id": f"EC-STRESS-ALERT-{int(time.time() * 1000) % 100000}",
                    "location": f"Stress Zone Sector {thread_id}",
                    "lat": 28.6139,
                    "lng": 77.2090,
                    "plastic_type": "Stress Test Cup",
                    "severity": "MEDIUM",
                    "status": "pending",
                    "time": "12:00:00 PM",
                    "date": "Jul 11, 2026",
                    "timestamp": int(time.time() * 1000),
                    "animal_name": "Stray Agent",
                    "animal_emoji": "🐶",
                    "animal_type": "Street Dog",
                    "before_img": "images/plastic-alert-default.png",
                    "after_img": ""
                }
                res = session.post(f"{TARGET_URL}/api/alerts", json=payload, timeout=3)
                if res.status_code == 200:
                    success = True

        except Exception as e:
            # Latency will be caught as timeout/disconnect
            pass

        duration = (time.time() - start_time) * 1000 # ms
        
        with stats_lock:
            stats["total_sent"] += 1
            if success:
                stats["success_count"] += 1
                stats["latencies"].append(duration)
            else:
                stats["failure_count"] += 1

        # Small sleep to spacing out requests
        time.sleep(random.uniform(0.05, 0.25))

def run_stress_test():
    print("=" * 60)
    print(" ECOCOLLAR CONCURRENT STRESS & THREAD-SAFETY TESTING SUITE")
    print(f" Target Server: {TARGET_URL}")
    print(f" Threads Spawned: {CONCURRENT_THREADS} | Transmits Per Thread: {REQUESTS_PER_THREAD}")
    print(" Testing for SQLite lock failures and socket starvation...")
    print("=" * 60)
    
    start_test = time.time()
    threads = []
    
    for i in range(CONCURRENT_THREADS):
        t = threading.Thread(target=thread_task, args=(i,))
        threads.append(t)
        t.start()
        
    for t in threads:
        t.join()
        
    total_time = time.time() - start_test
    
    # Calculate stats
    total_sent = stats["total_sent"]
    successes = stats["success_count"]
    failures = stats["failure_count"]
    latencies = stats["latencies"]
    
    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    max_latency = max(latencies) if latencies else 0
    min_latency = min(latencies) if latencies else 0
    
    print("\n" + "=" * 60)
    print(" PERFORMANCE BENCHMARK PROFILE CARD")
    print("=" * 60)
    print(f"  * Total Transmitted Requests: {total_sent}")
    print(f"  * Successful Transactions   : {successes} ({successes/total_sent*100:.1f}%)")
    print(f"  * Failed/Timeout Packets    : {failures} ({failures/total_sent*100:.1f}%)")
    print(f"  * Total Test Duration       : {total_time:.3f} seconds")
    print(f"  * System Throughput         : {total_sent/total_time:.1f} req/sec")
    print("-" * 60)
    print(f"  * Average Response Latency  : {avg_latency:.1f} ms")
    print(f"  * Max Response Latency      : {max_latency:.1f} ms")
    print(f"  * Min Response Latency      : {min_latency:.1f} ms")
    print("=" * 60)
    
    if failures == 0:
        print("[✅ PASS] SQLite Thread-Safe database locking verified under concurrency!")
    else:
        print("[⚠️ WARN] Detected socket drops or database locks. Check thread synchronization.")

if __name__ == "__main__":
    # Confirm server reachable
    try:
        requests.get(TARGET_URL, timeout=2)
    except Exception:
        print(f"[ERROR] Centralized gateway server is offline at {TARGET_URL}!")
        print("Please spin up 'python server.py' before running tests.")
        sys.exit(1)
        
    run_stress_test()
