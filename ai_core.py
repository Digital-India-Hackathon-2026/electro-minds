import cv2
import time
import requests
import numpy as np
from ultralytics import YOLO

# =============================================================================
# ECO-COLLAR: AI VISION & TELEMETRY BRIDGE (ROBUST STREAM MODE)
# =============================================================================

# 1. Configuration 
ESP32_STREAM_URL = "http://192.168.31.85:81/stream"  # Your exact ESP32 IP
LOCAL_SERVER_URL = "http://localhost:8000/api/alerts" # Your server.py endpoint

print("[INFO] Loading YOLOv8 Neural Network...")
model = YOLO('yolov8n.pt') 

last_alert_time = 0
COOLDOWN_SECONDS = 10

print("[INFO] Connecting to ESP32 Camera Stream (Bypassing OpenCV limits)...")

try:
    # Open a raw network byte stream using 'requests' instead of cv2.VideoCapture
    stream = requests.get(ESP32_STREAM_URL, stream=True, timeout=5)
except Exception as e:
    print(f"[ERROR] Cannot reach ESP32. Ensure Chrome is closed and IP is correct!\n{e}")
    exit()

print("[SUCCESS] AI Engine Online. Watching for plastic waste...")
print("[INFO] Terminal spam muted. Alerts will print here when plastic is detected.")
print("[INFO] Press Ctrl+C in this terminal to safely stop the AI.")

bytes_data = b''

try:
    # Read the video data chunk by chunk
    for chunk in stream.iter_content(chunk_size=1024):
        bytes_data += chunk
        
        # Search for the start (\xff\xd8) and end (\xff\xd9) of a JPEG frame
        a = bytes_data.find(b'\xff\xd8')
        b = bytes_data.find(b'\xff\xd9')
        
        if a != -1 and b != -1:
            # Extract the exact JPEG picture bytes
            jpg = bytes_data[a:b+2]
            bytes_data = bytes_data[b+2:]
            
            # Convert the raw bytes into a picture OpenCV can read
            frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
            
            # Safety check: If the frame is corrupted by Wi-Fi drop, skip it
            if frame is None or frame.size == 0:
                continue
                
            # Run YOLOv8 inference SAFELY (stream=False fixes the PyTorch crash!)
            # Lowered confidence to 0.30 to make it super sensitive
            results = model.predict(source=frame, conf=0.30, verbose=False)
            
            plastic_detected = False
            detected_label = ""
            
            # Process the results
            for r in results:
                for box in r.boxes:
                    cls = int(box.cls[0])
                    class_name = model.names[cls]
                    conf_score = float(box.conf[0])
                    
                    # --- DEBUG MODE --- 
                    # Print EVERYTHING the AI sees to the terminal
                    print(f"[DEBUG AI] I see a '{class_name}' ({conf_score:.0%} confident)")
                    
                    # Target common plastic/waste items YOLO knows
                    if class_name in ['bottle', 'cup', 'backpack', 'handbag', 'sports ball', 'vase', 'cell phone', 'remote', 'mouse']:
                        plastic_detected = True
                        detected_label = class_name
                        
                        # Draw bounding box
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
                        cv2.putText(frame, f"PLASTIC: {class_name.upper()}", (x1, y1 - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

            # Show the live feed
            cv2.imshow("EcoCollar AI Vision", frame)
            
            # Alert the server if plastic is found
            current_time = time.time()
            if plastic_detected and (current_time - last_alert_time > COOLDOWN_SECONDS):
                print(f"\n[🚨 ALERT] {detected_label.upper()} DETECTED! Transmitting to EcoCollar Server...")
                
                # --- FIXED: PAYLOAD NOW MATCHES SQLite SCHEMA EXACTLY ---
                payload = {
                    "id": f"EC-ALERT-{int(current_time)}",
                    "location": "Sector 7, Live Demo Area",
                    "lat": round(28.6139 + (current_time % 100) / 10000, 6), 
                    "lng": round(77.2090 + (current_time % 50) / 10000, 6),  
                    "plastic_type": f"{detected_label.upper()} (PET/HDPE)", # Fixed key
                    "severity": "HIGH",
                    "status": "Pending", # Added missing column requirement
                    "time": time.strftime("%I:%M %p"),
                    "date": time.strftime("%Y-%m-%d"),
                    "timestamp": int(current_time),
                    "animal_name": "Rocky", # Fixed key
                    "animal_emoji": "🐕", # Fixed key
                    "animal_type": "Street Dog" # Fixed key
                }
                
                # --- DATABASE LOCK BYPASS ---
                # SQLite databases can temporarily lock if the website is reading it at the exact
                # same millisecond we try to write to it. This loop retries to punch through the lock.
                for attempt in range(3):
                    try:
                        response = requests.post(LOCAL_SERVER_URL, json=payload, timeout=3)
                        if response.status_code == 200:
                            print("[✅ SUCCESS] Database updated! Check your Leaflet map.")
                            break
                        else:
                            print(f"[WARN] Server rejected payload on attempt {attempt+1}. Retrying in 1s...")
                            time.sleep(1)
                    except Exception as e:
                        print(f"[ERROR] Could not reach server.py: {e}")
                        time.sleep(1)
                    
                last_alert_time = current_time
                
            # Prevent memory leaks if Wi-Fi drops packets
            if len(bytes_data) > 500000:
                bytes_data = b''

            # Press ESC to exit
            if cv2.waitKey(1) & 0xFF == 27:
                print("\n[INFO] ESC pressed. Shutting down AI...")
                break

except KeyboardInterrupt:
    # Safely catch the user pressing Ctrl+C so it doesn't throw a messy traceback
    print("\n[INFO] AI Engine manually stopped by user (Ctrl+C).")
finally:
    # Always guarantee the camera window closes when the script stops
    cv2.destroyAllWindows()
    print("[INFO] Camera stream safely closed.")