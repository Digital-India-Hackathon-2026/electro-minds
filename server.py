from http.server import BaseHTTPRequestHandler, HTTPServer
import json

# This variable fakes our ML model output!
current_status = "ONLINE"

class MockMLServer(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        # Send the status data straight over the network to the Pi
        response = {"status": current_status}
        self.wfile.write(json.dumps(response).encode('utf-8'))

def run():
    global current_status
    server = HTTPServer(('0.0.0.0', 8080), MockMLServer)
    print("=" * 50)
    print("🚀 FAKE ML MODEL SERVER RUNNING ON PORT 8080")
    print("Press 'c' to fake PLASTIC DETECTED, 'o' to reset to normal.")
    print("=" * 50)
    
    # Simple loop to let you manually trigger the alert
    import threading
    def handle_input():
        global current_status
        while True:
            cmd = input().strip().lower()
            if cmd == 'c':
                current_status = "CRITICAL"
                print("⚠️ State changed to: CRITICAL (Faking Plastic Found!)")
            elif cmd == 'o':
                current_status = "ONLINE"
                print("✅ State changed to: ONLINE (Normal mode)")

    threading.Thread(target=handle_input, daemon=True).start()
    server.serve_forever()

if __name__ == '__main__':
    run()