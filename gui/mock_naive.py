import sys
import time
import signal
import json

def handler(signum, frame):
    print(f"\n[Mock] Received signal {signum}. Exiting...")
    sys.exit(0)

signal.signal(signal.SIGINT, handler)
signal.signal(signal.SIGTERM, handler)

print("[Mock] NaiveProxy Mock Version 0.0.1")
print("[Mock] Reading config...")

try:
    with open("config.json", "r") as f:
        config = json.load(f)
        print(f"[Mock] Loaded config: {json.dumps(config, indent=2)}")
except FileNotFoundError:
    print("[Mock] config.json not found!")
except Exception as e:
    print(f"[Mock] Error reading config: {e}")

print("[Mock] Listening on configured ports...")
print("[Mock] Proxy started successfully.")

counter = 0
while True:
    print(f"[Mock] Traffic processing... ({counter})")
    counter += 1
    sys.stdout.flush()
    time.sleep(2)
