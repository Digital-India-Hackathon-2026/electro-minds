import cv2
import numpy as np
import requests

# 1. Network Endpoint Paths
CAMERA_URL = "http://192.168.29.211/capture" 
API_URL = "http://192.168.29.87:8000/predict"

print(f"Starting Integrated Edge-AI Client Loop...")
print("Press 'q' in the camera window to stop the system safely.")

try:
    while True:
        # Step A: Capture a snapshot frame from the wireless camera module
        cam_response = requests.get(CAMERA_URL, timeout=2)
        
        if cam_response.status_code == 200:
            raw_bytes = cam_response.content
            
            # Convert to visual format so we can see it on our screen
            img_array = np.frombuffer(raw_bytes, dtype=np.uint8)
            frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            
            if frame is not None:
                cv2.imshow("Edge AI Device - Live Feed View", frame)
            
            # Step B: Package the raw image bytes and send an HTTP POST request to our Laptop API Server
            # We pass the bytes directly as a form data file object
            files = {"file": ("frame.jpg", raw_bytes, "image/jpeg")}
            
            try:
                api_response = requests.post(API_URL, files=files, timeout=10)
                
                if api_response.status_code == 200:
                    # Parse the server's JSON text response back into a Python dictionary
                    result = api_response.json()
                    print(f"Server Reply -> Found Plastic: {result['plastic_found']} | Confidence: {result['confidence']} | Action: {result['action']}")
                else:
                    print(f"Server communication error. Status code: {api_response.status_code}")
                    
            except requests.exceptions.RequestException as api_err:
                print(f"Failed to communicate with Local API Server: {api_err}")
                
        else:
            print(f"Failed to grab frame from camera. Status code: {cam_response.status_code}")
            
        # Break out if 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

except Exception as e:
    print(f"System loop error: {e}")

cv2.destroyAllWindows()
print("System disconnected.")