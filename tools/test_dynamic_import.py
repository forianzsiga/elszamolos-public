#!/usr/bin/env python3
import sys
import json
import urllib.request
import asyncio
import time

# --- Helper to poll Chrome for the active WebSocket Debugger URL ---
def get_chrome_ws_url():
    try:
        url = "http://127.0.0.1:9222/json"
        with urllib.request.urlopen(url, timeout=2) as response:
            pages = json.loads(response.read().decode())
            # Find the active PWA page tab
            target = next((p for p in pages if "localhost:5173/elszamolos/" in p.get("url", "") and p.get("type") == "page"), None)
            if target:
                return target.get("webSocketDebuggerUrl")
    except Exception as e:
        sys.stderr.write(f"Error connecting to Chrome: {e}\n")
    return None

# --- Executes JS via CDP WebSockets ---
async def evaluate_cdp(ws_url, js_code):
    import websockets
    try:
        async with websockets.connect(ws_url) as ws:
            request_id = int(time.time() * 1000) % 1000000
            payload = {
                "id": request_id,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": js_code,
                    "awaitPromise": True,
                    "returnByValue": True
                }
            }
            await ws.send(json.dumps(payload))
            
            async for message in ws:
                res = json.loads(message)
                if res.get("id") == request_id:
                    result = res.get("result", {})
                    if "exceptionDetails" in result:
                        return {"status": "error", "error": result["exceptionDetails"].get("exception", {}).get("description")}
                    return {"status": "success", "data": result.get("result", {}).get("value")}
    except Exception as e:
        return {"status": "error", "error": str(e)}

async def navigate_cdp(ws_url, url):
    import websockets
    try:
        async with websockets.connect(ws_url) as ws:
            request_id = int(time.time() * 1000) % 1000000
            payload = {
                "id": request_id,
                "method": "Page.navigate",
                "params": {
                    "url": url
                }
            }
            await ws.send(json.dumps(payload))
            await asyncio.sleep(3)
    except Exception as e:
        sys.stderr.write(f"Navigation failed: {e}\n")

async def main():
    ws_url = get_chrome_ws_url()
    if not ws_url:
        print("Chrome is not running or PWA page is not open. Ensure port 9222 is active.")
        sys.exit(1)
        
    print("Navigating active PWA tab to ensure it is loaded...")
    await navigate_cdp(ws_url, "http://localhost:5173/elszamolos/")
    
    print("Found active PWA tab. Executing dynamic imports from Chrome DevTools...")

    # Dynamic Console Import (Strategy 1)
    # Expose dbService dynamically, fetch active rules, and run calculations inside the running browser context.
    # No changes are made to the source files!
    js_code = """
    (async () => {
        try {
            // 1. Dynamically import source modules directly from the active Vite dev server
            const t = Date.now();
            const { dbService } = await import(`/elszamolos/src/services/db.ts?t=${t}`);
            const { calculateJobPrice } = await import(`/elszamolos/src/services/pricingEngine.ts?t=${t}`);
            
            // 2. Query IndexedDB using the imported production-ready DB service
            const rules = await dbService.getAllRules();
            const jobs = await dbService.getAllJobs();
            
            // 3. Find our target job
            const targetJob = jobs.find(j => j.id === '727kfegz9');
            
            if (!targetJob) {
                return {
                    success: false,
                    message: 'Target job 727kfegz9 was not found in IndexedDB.'
                };
            }
            
            // 4. Run the EXACT, UNMODIFIED production calculation logic
            const result = calculateJobPrice(targetJob, rules);
            
            return {
                success: true,
                message: 'Successfully executed native production logic inside Chrome console!',
                rules_count: rules.length,
                jobs_count: jobs.length,
                job_patient: result.patientName,
                calculated_price: result.price,
                applied_job_rules_count: result.appliedJobRules.length
            };
        } catch (err) {
            return {
                success: false,
                error: err.toString(),
                stack: err.stack,
                href: window.location.href
            };
        }
    })()
    """
    
    response = await evaluate_cdp(ws_url, js_code)
    
    print("\n--- RESPONSE FROM PWA NATIVE EXECUTION ---")
    print(json.dumps(response, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(main())
