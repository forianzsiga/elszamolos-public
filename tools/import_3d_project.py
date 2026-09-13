#!/usr/bin/env python3
import os
import sys
import json
import base64
import urllib.request
import asyncio
import time

def get_chrome_ws_url():
    try:
        url = "http://127.0.0.1:9222/json"
        with urllib.request.urlopen(url, timeout=2) as response:
            pages = json.loads(response.read().decode())
            target = next((p for p in pages if "localhost:5173/elszamolos/" in p.get("url", "") and p.get("type") == "page"), None)
            if target:
                return target.get("webSocketDebuggerUrl")
    except Exception as e:
        sys.stderr.write(f"Error connecting to Chrome: {e}\n")
    return None

async def evaluate_cdp(ws_url, js_code):
    import websockets
    try:
        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
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

async def main():
    ws_url = get_chrome_ws_url()
    if not ws_url:
        print("Chrome is not running or PWA page is not open.")
        sys.exit(1)

    folder_path = os.path.join("example_data", "dentalProjectsWith3DContent", "2026-05-26_00002-003")
    if not os.path.exists(folder_path):
        print(f"Folder not found: {folder_path}")
        sys.exit(1)

    files_data = []
    for fname in os.listdir(folder_path):
        fpath = os.path.join(folder_path, fname)
        if os.path.isfile(fpath):
            with open(fpath, "rb") as f:
                b64_content = base64.b64encode(f.read()).decode("utf-8")
                files_data.append({
                    "name": fname,
                    "base64": b64_content
                })

    print(f"Read {len(files_data)} files from {folder_path}")

    # Construct JS code to mock showDirectoryPicker
    js_code = f"""
    (async () => {{
        const files = {json.dumps(files_data)};
        window.showDirectoryPicker = async () => {{
            return {{
                kind: 'directory',
                name: '2026-05-26_00002-003',
                values: async function* () {{
                    for (const f of files) {{
                        yield {{
                            kind: 'file',
                            name: f.name,
                            getFile: async () => {{
                                const bin = atob(f.base64);
                                const arr = new Uint8Array(bin.length);
                                for (let i = 0; i < bin.length; i++) {{
                                    arr[i] = bin.charCodeAt(i);
                                }}
                                return new File([arr], f.name);
                            }}
                        }};
                    }}
                }}
            }};
        }};
        return "Mocked showDirectoryPicker successfully";
    }})()
    """

    res = await evaluate_cdp(ws_url, js_code)
    print("Mocking result:", res)

if __name__ == "__main__":
    asyncio.run(main())
