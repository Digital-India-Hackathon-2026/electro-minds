import cv2
import os
import sys

# --- CONFIGURATION ---
# Put your ESP32-S3 Camera's exact Wi-Fi IP address here!
# Make sure to keep the :81/stream or whatever endpoint your Arduino code outputs!
ESP32_URL = "http://192.168.31.85:81/stream" 

# Ensure the raw storage folder exists
os.makedirs("waste_dataset/raw_images", exist_ok=True)

print("[INFO] Attempting to connect to ESP32-S3 Cam Stream...")
cap = cv2.VideoCapture(ESP32_URL)

# Check if the network stream is reachable
if not cap.isOpened():
    print("=" * 60)
    print("[CRITICAL ERROR] Could not open the ESP32 video stream!")
    print(f"Verified URL attempted: {ESP32_URL}")
    print("Please check: ")
    print(" 1. Is your ESP32 turned on and plugged into power?")
    print(" 2. Are both your laptop and ESP32 on the EXACT same Wi-Fi network?")
    print(" 3. Did you copy the correct IP address from the Arduino Serial Monitor?")
    print("=" * 60)
    sys.exit()

img_counter = 0

print("=" * 50)
print(" ESP32 DATA COLLECTION MODULE ACTIVATED")
print(" Press [SPACEBAR] to snap an ESP32 training frame.")
print(" Press [ESC] to close data collection safely.")
print("=" * 50)

while True:
    ret, frame = cap.read()
    if not ret:
        print("[WARN] Dropped frame or stream interrupted. Retrying...")
        continue
        
    # Show the live feed coming directly from the ESP32 over Wi-Fi
    cv2.imshow("ESP32-S3 Hackathon Feed", frame)
    
    k = cv2.waitKey(1)
    if k % 256 == 27:  # ESC key pressed
        print("[INFO] Shutting down collection interface...")
        break
    elif k % 256 == 32:  # Spacebar pressed
        img_name = f"waste_dataset/raw_images/esp32_frame_{img_counter}.jpg"
        cv2.imwrite(img_name, frame)
        print(f"[SAVED TO DISK] {img_name}")
        img_counter += 1

cap.release()
cv2.destroyAllWindows()