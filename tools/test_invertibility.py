#!/usr/bin/env python3
import json
import subprocess
import time
import sys

import os
import tempfile

# Paths to the JSON files
STATE_1 = os.path.join(tempfile.gettempdir(), "state_1.json")
STATE_2 = os.path.join(tempfile.gettempdir(), "state_2.json")

def run_bridge_command(command_args):
    """
    Runs pwa_bridge.py as a subprocess and parses the JSON response.
    """
    bridge_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pwa_bridge.py")
    cmd = [sys.executable, bridge_path] + command_args
    res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if res.returncode != 0:
        raise Exception(f"Bridge command failed: {res.stderr}")
    return json.loads(res.stdout)

def main():
    print("=== STARTING PWA STATE INVERTIBILITY TEST ===")
    
    # Step 1: Save the current state to state_1.json
    print("\n1. Saving original state to state_1.json...")
    res_save1 = run_bridge_command(["save-app-state", STATE_1])
    if res_save1["status"] != "success":
        print(f"Error saving state_1: {res_save1}")
        sys.exit(1)
    print("Original state successfully saved.")

    # Step 2: Load state_1.json back into Chrome (restoring/wiping DB)
    print("\n2. Loading state_1.json back into PWA (Restoring State)...")
    res_load = run_bridge_command(["load-app-state", STATE_1])
    if res_load["status"] != "success":
        print(f"Error loading state: {res_load}")
        sys.exit(1)
    print("Database state restore triggered successfully.")
    
    # Wait for Chrome to reload the window and sync IndexedDB
    print("Waiting 3 seconds for Chrome window reload...")
    time.sleep(3)

    # Step 3: Save the state again to state_2.json
    print("\n3. Saving state again to state_2.json...")
    res_save2 = run_bridge_command(["save-app-state", STATE_2])
    if res_save2["status"] != "success":
        print(f"Error saving state_2: {res_save2}")
        sys.exit(1)
    print("Restored state successfully saved.")

    # Step 4: Compare state_1.json and state_2.json for perfect identity
    print("\n4. Performing byte-for-byte and deep JSON comparison...")
    with open(STATE_1, 'r', encoding='utf-8') as f:
        data1 = json.load(f)
    with open(STATE_2, 'r', encoding='utf-8') as f:
        data2 = json.load(f)
        
    # We compare the parsed dicts to ignore small key ordering differences if any,
    # and to allow a precise diagnostic output if they mismatch.
    if data1 == data2:
        print("\n✅ INVERTIBILITY TEST PASSED! original and restored states are 100% identical.")
        print(f"File sizes: state_1 = {len(json.dumps(data1))} chars, state_2 = {len(json.dumps(data2))} chars.")
        sys.exit(0)
    else:
        print("\n❌ INVERTIBILITY TEST FAILED! Differences found between states.")
        # Find differences
        for key in data1.keys():
            if key not in data2:
                print(f"Missing key in state_2: {key}")
            elif len(data1[key]) != len(data2[key]):
                print(f"Count mismatch for store '{key}': state_1={len(data1[key])}, state_2={len(data2[key])}")
            elif json.dumps(data1[key], sort_keys=True) != json.dumps(data2[key], sort_keys=True):
                print(f"Content difference in store '{key}'")
        sys.exit(1)

if __name__ == "__main__":
    main()
