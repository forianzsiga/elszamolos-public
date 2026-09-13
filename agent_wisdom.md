# Agent Wisdom: Launching Chrome with Persistent IndexedDB Debugging

This document details how to launch a persistent, debuggable Google Chrome instance on Windows that shares or copies your main profile's `IndexedDB` data, allowing an LLM or coding agent to interact with the application state directly.

---

## The Core Problem on Windows
Chrome uses a single-instance architecture. If any background Chrome processes are running under your Windows user account, launching Chrome with the `--remote-debugging-port=9222` flag will be **silently ignored**. The new window will simply attach to the existing background process, which does not have debugging enabled.

To bypass this, we must launch Chrome with a **dedicated user data directory** while copying over the persistent database files.

---

## Step-by-Step Launch Guide

### Step 1: Terminate Existing Chrome Processes
Ensure all background Chrome processes are completely closed so they do not lock the profile files:
```powershell
taskkill /F /IM chrome.exe
```

### Step 2: Copy Your Main IndexedDB Database (Optional)
If you want to debug using your real-world data from your main Chrome profile, copy the `IndexedDB` folder to the debug profile directory:
```powershell
Copy-Item -Path "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\IndexedDB" -Destination "$env:LOCALAPPDATA\Google\Chrome\User Data Debug\Default\" -Recurse -Force
```

### Step 3: Launch Chrome with Debugging Enabled
Launch Chrome using the dedicated debug profile and expose port `9222`:
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\Google\Chrome\User Data Debug"
```

### Step 4: Start the Vite Development Server
In your project directory, start the local development server:
```powershell
npm run dev
```

### Step 5: Connect the MCP Server
Ensure your `mcp.json` configuration points to the active debugging port:
```json
"io.github.ChromeDevTools/chrome-devtools-mcp": {
    "type": "stdio",
    "command": "npx",
    "args": [
        "--registry",
        "https://registry.npmjs.org",
        "chrome-devtools-mcp@1.1.1",
        "--browser-url=http://127.0.0.1:9222"
    ]
}
```

---

## Verification Commands

To verify that the port is active and listening:
```powershell
netstat -ano | findstr 9222
```

To list the open pages via the MCP server:
*   **Tool:** `mcp_io_github_chr_list_pages`
*   **Expected Output:** A list of active tabs, including `http://localhost:5173/elszamolos/`.

---

## Debugging Quirks & Gotchas (Lessons Learned)

When working with Windows, PowerShell, and Chrome debugging, keep these critical quirks in mind:

### 1. PowerShell 5.1 UTF-8 Mojibake (Accented Characters)
*   **The Quirk:** PowerShell 5.1 defaults to Windows-1252 (ANSI) encoding when reading or writing files. This corrupts Hungarian accented characters (e.g., `Éva Megyeri` becomes `Ã‰va Megyeri`).
*   **The Fix:** Avoid native PowerShell cmdlets like `Get-Content` or `Out-File` without explicit encoding. Instead, use **.NET File Methods** which default to clean UTF-8:
    ```powershell
    # Read UTF-8
    $content = [System.IO.File]::ReadAllText("file.json")
    # Write UTF-8
    [System.IO.File]::WriteAllText("file.json", $content)
    ```

### 2. PowerShell Call Operator (`&`) for Quoted Paths
*   **The Quirk:** Running a quoted executable path directly in PowerShell (e.g., `"C:\Program Files\...\chrome.exe" --flags`) results in a parser error: `The '--' operator works only on variables or on properties.`
*   **The Fix:** Always prepend the **PowerShell Call Operator (`&`)** when executing quoted paths:
    ```powershell
    & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
    ```

### 3. Chrome Single-Instance Port Locking
*   **The Quirk:** If any background Chrome processes are running under your Windows user account, launching Chrome with the debugging flag will silently fail to open port `9222`.
*   **The Fix:** You must forcefully terminate all Chrome processes before launching:
    ```powershell
    taskkill /F /IM chrome.exe
    ```
    If background apps are enabled in Chrome settings, they may auto-restart instantly. In this case, launch Chrome with a dedicated user data directory to guarantee port binding:
    ```powershell
    --user-data-dir="$env:LOCALAPPDATA\Google\Chrome\User Data Debug"
    ```

### 4. PowerShell JSON Array Wrapping
*   **The Quirk:** Converting a PowerShell array to JSON using `ConvertTo-Json` wraps the array inside a `value` property under a `PSCustomObject` (e.g., `{ "Count": 491, "value": [...] }`), making it non-iterable in JavaScript.
*   **The Fix:** Manually concatenate raw JSON strings from files instead of using `ConvertTo-Json` on arrays:
    ```powershell
    $combinedJson = "{`"jobs`": $jobs, `"rules`": $tariffs}"
    ```

---

## Debugging via the Global Debug Bridge (`window.__DEBUG_BRIDGE__`)

Once connected, you can execute commands directly in the browser console using the MCP tool `mcp_io_github_chr_evaluate_script`.

### Quick Commands:
*   **Get App Info:** `await __DEBUG_BRIDGE__.getAppInfo()`
*   **Fetch Database State:** `await __DEBUG_BRIDGE__.getJobs()`, `getRules()`, `getInvoices()`, `getLogs()`
*   **Test Pricing Engine (Dry Run):** `await __DEBUG_BRIDGE__.testPricingEngine()`
*   **Compare Import Methods (Parity Check):** `await __DEBUG_BRIDGE__.compareImportMethods()`
    *   *What it does:* Compares the pre-calculated database state (Force Import) against a fresh dry-run of the pricing engine (Checked Import) for all jobs, reporting any discrepancies in price or status.
*   **Restore Full Backup:** `await __DEBUG_BRIDGE__.restoreFullBackup(backupData)`
    *   *What it does:* Wipes the database and restores a complete state (jobs, rules, invoices, metadata) atomically.
*   **Inject Test Data:** `await __DEBUG_BRIDGE__.injectJobs(jobsArray)`
*   **Wipe Database:** `await __DEBUG_BRIDGE__.clearAllData()`

---

## Unreachable Elements (Limitations of the Debug Bridge)

While the debug bridge is highly powerful, certain elements remain **unreachable** through JavaScript execution alone and require visual/browser-level tools:

1.  **Native File Dialogs:** Triggering directory selection (`showDirectoryPicker`) or file uploads cannot be automated via JS console commands due to browser security sandboxing.
2.  **Google OAuth Popups:** The Google Drive sign-in flow opens a secure, isolated popup window that cannot be inspected or automated via the main page's console.
3.  **Visual Layout & CSS:** Verifying if elements are overlapping, responsive, or visually correct requires screenshots (`take_screenshot`) or accessibility tree snapshots (`take_snapshot`).
4.  **Service Worker Lifecycle:** Inspecting the PWA service worker registration, cache storage, or offline sync states requires direct Chrome DevTools Protocol (CDP) commands rather than standard page-level JS.

---

## Graphical Elements & Virtual Tables Debugging Workflow (Responsive Layouts)

When debugging collapsed, invisible, or broken graphical elements (especially virtual tables like `react-virtuoso` under CSS `zoom` and flexbox containers on mobile), follow this systematic diagnostics-and-fix workflow.

---

### Phase 1: Agentic Chromium Investigation Workflow
To debug graphical elements efficiently, use a self-verifying, live-debugging loop in the browser before writing any code:

1. **Verify Development Server Port:**
   Check if the dev server is active and note its port:
   ```bash
   lsof -i :5173
   ```
2. **Navigate and Emulate Mobile Viewport:**
   Direct the remote browser to the correct workspace routing and scale down to mobile dimensions:
   ```json
   // Tool: chrome_navigate_page
   { "type": "url", "url": "http://localhost:5173/elszamolos/#/jobs" }
   
   // Tool: chrome_resize_page
   { "width": 375, "height": 667 }
   ```
3. **Capture Initial State (Visual & Structural):**
   Take a visual screenshot and an accessibility tree snapshot to check if text nodes are loaded but scrolled/clipped outside the viewport bounds:
   ```json
   // Tool: chrome_take_screenshot
   {}
   
   // Tool: chrome_take_snapshot
   {}
   ```
4. **Identify Collapsed Layout Bounds:**
   Find the exact element hierarchy using `chrome_evaluate_script` to check bounding boxes, computed heights, flex values, and display types of all parent elements starting from the collapsed target up to the `<body>` element. This immediately pinpoints where the height collapses:
   ```javascript
   // Tool: chrome_evaluate_script
   () => {
       const target = document.querySelector('.MuiTableContainer-root'); // e.g., Scroller
       if (!target) return 'target not found';
       
       const lineage = [];
       let current = target;
       while (current && current.tagName !== 'BODY') {
           const style = window.getComputedStyle(current);
           lineage.push({
               tagName: current.tagName,
               className: current.className ? String(current.className) : '',
               rect: current.getBoundingClientRect(),
               height: style.height,
               minHeight: style.minHeight,
               flex: style.flex,
               display: style.display,
               position: style.position
           });
           current = current.parentElement;
       }
       return lineage;
   }
   ```
5. **Live Dry-Run CSS Fixes in Console:**
   Before changing application files, write temporary JS style overrides using `chrome_evaluate_script` to test proposed CSS modifications directly in the active browser view. Re-query bounding client rects to see if the element's height resolves:
   ```javascript
   // Tool: chrome_evaluate_script
   () => {
       const zoomBox = document.querySelector('.css-qcr25p'); // Target container
       if (!zoomBox) return 'zoomBox not found';
       
       // Force flex-grow layout rules
       zoomBox.style.display = 'block';
       zoomBox.style.flex = '1';
       
       const scroller = document.querySelector('.MuiTableContainer-root');
       scroller.style.flex = '1';
       
       return {
           scrollerHeight: scroller.getBoundingClientRect().height,
           scrollerStyle: window.getComputedStyle(scroller).height
       };
   }
   ```
6. **Take Live Visual Verifications:**
   Verify that items immediately render and are beautiful and aligned:
   ```json
   // Tool: chrome_take_screenshot
   {}
   ```
7. **Port the Changes to Code & Re-Build:**
   Now that the layout fix is verified, implement the changes inside the react codebase and compile:
   ```bash
   npm run build
   ```

---

### Phase 2: Common Collapsing Antipatterns
* **The Percentage Height Trap:** If an element uses `height: 100%` but its parent container has `height: auto` or only a `min-height` constraint, the percentage height resolves to `0px` or collapses in most browser layout engines.
* **The Zoom + Flexbox Chromium Bug:** Setting `zoom: zoomScale` on a flex container (`display: flex; flexDirection: column`) completely breaks the resolution of percentage heights (`height: 100%`) of its nested direct children, collapsing them to `0px`.
* **Squeezed Flex Items:** If parent flex containers have fixed height boundaries (like `calc(100vh - 100px)`) but nested non-scrollable header/filter boxes grow extremely tall on mobile due to wrapping, the browser is forced to squeeze children with `flex: 1` or `height: 100%` down to `0px` to respect the outer bound.

---

### Phase 3: Applied Fixes
* **Unlock Parent Bound:** Set responsive heights on outer layout wrapper boxes (e.g., `height: { xs: 'auto', md: 'calc(100vh - 100px)' }`) so they grow naturally on mobile screens.
* **Define Minimum Viewports:** Ensure virtualized elements inside scrolled page flows have a solid minimum height (e.g., `minHeight: { xs: 350, md: 0 }`).
* **Flex-Grow Chain:** Change collapsed descendant elements in the nesting chain from `height: '100%'` to `flex: 1` and `minHeight: 0`, and set `height: 'auto'` on mobile. This forces flexbox stretching to resolve layout heights cleanly.
* **Virtuoso Scroller Flex Override:** For custom scroller templates (like a `TableContainer` in Virtuoso), pass `flex: 1` explicitly to its inline styling:
  ```typescript
  style={{ ...style, flex: 1 }}
  ```
  This overrides Virtuoso's inline height calculations which might resolve to `0` when mounted inside a `zoom` container.


---

## Constructing Custom opencode Agents

opencode allows you to define custom specialized subagents or primary agents to automate recurring engineering tasks with tailored system prompts, model parameters, and permission rulesets.

### Where Agent Files Live
Custom agent files are written in Markdown with frontmatter and placed under:
* **Project scope**: `.opencode/agent/<name>.md` or `.opencode/agents/<name>.md`
* **Global scope**: `~/.config/opencode/agents/<name>.md`

### File Format & Structure (`refactor.md`)
Create a markdown file with YAML frontmatter. The frontmatter defines metadata, while the markdown body becomes the agent's system prompt:

```markdown
---
name: refactor
description: Unified, generalized subagent for executing targeted, file-level code refactoring, style extraction, internationalization, accessibility compliance, and quality improvements.
mode: subagent
model: google-vertex/gemini-3.1-flash-lite
temperature: 0.7
options:
  thinking:
    budget_tokens: 8192
permission:
  edit: allow
  bash: allow
  read: allow
  glob: allow
  grep: allow
---

You are a generalized, highly adaptive refactoring subagent. Your purpose is to...
```

### Key Frontmatter Properties:
* `name`: Suffix name of the agent (alphanumeric, lowercase, hyphen-separated).
* `description`: Simple explanation of what this agent does and when to summon it.
* `mode`: Set to `"subagent"` (to make it a specialized utility) or `"primary"` (the default agent used for initial user queries).
* `model`: The model ID prefix, e.g., `"google-vertex/gemini-3.1-flash-lite"`.
* `temperature`: Floating point parameter for model diversity (0.0 to 1.0).
* `options.thinking.budget_tokens`: High-thinking models (like Gemini or Claude) can have their dedicated reasoning/thinking token budgets configured here separately from temperature.
* `permission`: Granular security policies (such as `"allow"`, `"ask"`, `"deny"`) for individual tools (e.g. `edit`, `bash`, `task`).

### ⚠️ IMPORTANT: Loading Custom Agents
opencode loads its configuration, skills, and agents **exactly once on startup**. It does not dynamically watch or hot-reload custom agent configuration files while a session is running.
* **Always prompt/remind the user to quit and restart opencode (closing and reopening the CLI terminal) after creating or modifying a custom agent.**
* The newly created agent will initialize and become fully operational only upon restart.

---

## Codebase Quality & Design-System Compliance Test Suites

To preserve PWA accessibility, clean stylesheets, translation symmetry, and architectural integrity, all engineering agents must respect, comply with, and execute our standard compliance test suites after any component modifications.

### 1. The Design-System Compliance Scripts (`tools/`)
- **Tooltip Usage Auditor (`tools/tooltip_compliance.py`):**
  - *Rule:* All interactive elements, buttons, clickable icons, and form controls must be wrapped inside a `<ResponsiveTooltip />` layout element to maintain 100% PWA screen-reader accessibility.
  - *Action:* Automatically skips utility components and scans for compliance.
- **CSS Delegation Auditor (`tools/css_compliance.py`):**
  - *Rule:* To prevent layout weight inflation and inline clutter, avoid inline `style` and `sx` declarations. Inline styling should be delegated to dedicated `.css` stylesheet files under the corresponding component directories.
- **Translation Parity Scanner (`tools/i11n_compliance.py`):**
  - *Rule:* Multi-lingual translation sheets (e.g., Hungarian and English) must remain perfectly symmetrical with matching keys.
- **Pricing Invertibility Checker (`tools/test_invertibility.py`):**
  - *Rule:* Validates the mathematical precision and backward-compatibility of rule pricing logic cascades.
- **Dynamic Imports Integrity (`tools/test_dynamic_import.py`):**
  - *Rule:* Audits code-splitting boundaries and bundle lazy loading paths.

### 2. Code Complexity & Indentation Rules (SonarJS & ESLint)
- **Cognitive Complexity:** Keep Cognitive Complexity of functions under `15` where possible to prevent unreadable, tangled branches.
- **Ternary Operators:** Avoid nesting ternary expressions (e.g., `condition1 ? (condition2 ? val1 : val2) : val3`). Extract nested ternary chains into clear, independent constants or conditional blocks.
- **Nesting Depth:** Do not nest functions more than 4 levels deep.
- **Indentation & Formatting:** Always run `npm run lint` and verify production building using `npm run build` before considering a task completed.

### 3. Execution Commands
To run the complete suite of compliance tests sequentially:
```bash
python3 tools/tooltip_compliance.py && python3 tools/css_compliance.py && python3 tools/i11n_compliance.py && python3 tools/test_invertibility.py && python3 tools/test_dynamic_import.py
```
And to run the static quality linter:
```bash
npm run lint
```




