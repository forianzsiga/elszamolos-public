# DentalRaktar Dental Accounting Software

React + TypeScript PWA for dental-laboratory job accounting. Reads .dentalProject folders from the local file system, prices each tooth by a user-editable rule list, stores everything in IndexedDB, generates invoices, exports vector PDFs.

[Setup](./SETUP.md) · [Architecture](./ARCHITECTURE.md)

Source: forianzsiga/elszamolos (private). This repo is a documentation-only mirror.

---

## Contents

1. [Stack](#stack)
2. [Features](#features)
   - 2.1 [File ingest](#21-file-ingest)
   - 2.2 [Pricing](#22-pricing)
   - 2.3 [Persistence](#23-persistence)
   - 2.4 [Visualisation](#24-visualisation)
   - 2.5 [Invoice + PDF](#25-invoice--pdf)
   - 2.6 [Backup](#26-backup)
   - 2.7 [Offline](#27-offline)
   - 2.8 [Dashboard](#28-dashboard)
3. [Pricing engine](#pricing-engine)
   - 3.1 [Rule kinds](#31-rule-kinds)
   - 3.2 [Operators](#32-operators)
   - 3.3 [Currency safety](#33-currency-safety)
   - 3.4 [Audit trail](#34-audit-trail)
   - 3.5 [Invertibility](#35-invertibility)
4. [Persistence](#persistence)
5. [Visualisation](#visualisation)
6. [Headless test bridge](#headless-test-bridge)
7. [Tooling](#tooling)
8. [Layout](#layout)
9. [Limitations](#limitations)
10. [Academic context](#academic-context)
11. [LLM-assisted development](#llm-assisted-development)
12. [License](#license)

---

## Stack

React, TypeScript (strict), Vite, Material UI, IndexedDB via idb, Three.js, Recharts, @dnd-kit, react-virtuoso, react-to-print.

Tests: Vitest, Testing Library, jsdom.

Lint / quality: ESLint, eslint-plugin-sonarjs, jscpd for duplication.

CI / CD: GitHub Actions, deploys to GitHub Pages on push to main.

Browser APIs in use: File System Access, IndexedDB, Service Worker, RequestAnimationFrame, WebGL, Chrome DevTools Protocol.

## Features

### 2.1 File ingest

Reads .dentalProject folders (XML) recursively via the File System Access API. The technician picks a folder in the browser; the app walks it. Falls back to drag-and-drop and to a developer-mode JSON import.

<details style="border:1px solid #30363d; border-left:4px solid #58a6ff; border-radius:6px; padding:10px 14px; margin:12px 0; background:#161b22;">
<summary style="cursor:pointer; font-weight:bold; font-size:1.05em; color:#58a6ff;">Importing and filtering (Demo)</summary>
<hr style="border-color:#30363d;">

<video src="https://github.com/user-attachments/assets/d69ae994-3c27-411a-a71c-ce426025aedb"
autoplay loop muted playsinline controls="false"
width="100%"></video>

<br><i>Import a .dentalProject folder, then filter the resulting jobs by doctor and material.</i>

</details>

### 2.2 Pricing

Each tooth in a job is priced by walking a user-editable rule list. See the [Pricing engine](#pricing-engine) section.

<details style="border:1px solid #30363d; border-left:4px solid #58a6ff; border-radius:6px; padding:10px 14px; margin:12px 0; background:#161b22;">
<summary style="cursor:pointer; font-weight:bold; font-size:1.05em; color:#58a6ff;">Rule editing (Demo)</summary>
<hr style="border-color:#30363d;">

<video src="https://github.com/user-attachments/assets/3d4c851d-add1-4697-8edb-63a948f048fa"
autoplay loop muted playsinline controls="false"
width="100%"></video>

<br><i>Edit tariff rules, change priorities, jump to the job the rule applies to.</i>

</details>

### 2.3 Persistence

Everything in IndexedDB. Six object stores. See the [Persistence](#persistence) section.

<details style="border:1px solid #30363d; border-left:4px solid #58a6ff; border-radius:6px; padding:10px 14px; margin:12px 0; background:#161b22;">
<summary style="cursor:pointer; font-weight:bold; font-size:1.05em; color:#58a6ff;">Job editor (Demo)</summary>
<hr style="border-color:#30363d;">

<video src="https://github.com/user-attachments/assets/b840aa27-8dbf-442f-ab7b-199bc2db9dd2"
autoplay loop muted playsinline controls="false"
width="100%"></video>

<br><i>Edit a job's teeth, materials, and notes. Writes go through IndexedDB transactions.</i>

</details>

### 2.4 Visualisation

Two layers: a 64-SVG dental arch atlas and a Three.js STL viewer per job. See the [Visualisation](#visualisation) section.

<details style="border:1px solid #30363d; border-left:4px solid #58a6ff; border-radius:6px; padding:10px 14px; margin:12px 0; background:#161b22;">
<summary style="cursor:pointer; font-weight:bold; font-size:1.05em; color:#58a6ff;">3D viewer (Demo)</summary>
<hr style="border-color:#30363d;">

<video src="https://github.com/user-attachments/assets/3b481bf6-88d0-475c-97cd-5b53e3605b64"
autoplay loop muted playsinline controls="false"
width="100%"></video>

<br><i>STL mesh viewer with orbit controls, auto-rotate, and procedural fallback.</i>

</details>

### 2.5 Invoice + PDF

A priced job can be added to an invoice. Invoices aggregate by doctor, sum totals, and render through react-to-print for the printable view. Vector PDF export goes through a headless Chrome via the [headless test bridge](#headless-test-bridge).

<details style="border:1px solid #30363d; border-left:4px solid #58a6ff; border-radius:6px; padding:10px 14px; margin:12px 0; background:#161b22;">
<summary style="cursor:pointer; font-weight:bold; font-size:1.05em; color:#58a6ff;">Invoice creation (Demo)</summary>
<hr style="border-color:#30363d;">

<video src="https://github.com/user-attachments/assets/83eb2208-4b00-41db-9894-c4c44c9b7355"
autoplay loop muted playsinline controls="false"
width="100%"></video>

<br><i>Select priced jobs, create an invoice, aggregate by doctor.</i>

</details>

### 2.6 Backup

Two paths. JSON export / import of the full database (jobs, rules, invoices, metadata, logs, assets base64-encoded). Optional Google Drive sync via OAuth, scoped to the user's own Drive.

<details style="border:1px solid #30363d; border-left:4px solid #58a6ff; border-radius:6px; padding:10px 14px; margin:12px 0; background:#161b22;">
<summary style="cursor:pointer; font-weight:bold; font-size:1.05em; color:#58a6ff;">Google Drive sync (Demo)</summary>
<hr style="border-color:#30363d;">

<video src="https://github.com/user-attachments/assets/2f3e72bc-883c-4014-bb23-38ab9420b07a"
autoplay loop muted playsinline controls="false"
width="100%"></video>

<br><i>OAuth flow, push and pull the local database to the user's own Drive.</i>

</details>

### 2.7 Offline

PWA, vite-plugin-pwa + Workbox. Service worker pre-caches the app shell. The app boots with no network. Online-only paths: the Google Drive sync and the test bridge.

<details style="border:1px solid #30363d; border-left:4px solid #58a6ff; border-radius:6px; padding:10px 14px; margin:12px 0; background:#161b22;">
<summary style="cursor:pointer; font-weight:bold; font-size:1.05em; color:#58a6ff;">Audit log (Demo)</summary>
<hr style="border-color:#30363d;">

<video src="https://github.com/user-attachments/assets/916207ce-05f1-47ae-b2f9-c7b85c797bd8"
autoplay loop muted playsinline controls="false"
width="100%"></video>

<br><i>Local audit log of all state changes; written to IndexedDB, no network required.</i>

</details>

### 2.8 Dashboard

Revenue timeline, pending jobs count, active rules.

<details style="border:1px solid #30363d; border-left:4px solid #58a6ff; border-radius:6px; padding:10px 14px; margin:12px 0; background:#161b22;">
<summary style="cursor:pointer; font-weight:bold; font-size:1.05em; color:#58a6ff;">Dashboard (Demo)</summary>
<hr style="border-color:#30363d;">

<video src="https://github.com/user-attachments/assets/89cb8bf4-0f03-4821-a971-63ad4562974e"
autoplay loop muted playsinline controls="false"
width="100%"></video>

<br><i>Revenue timeline, pending jobs count, active rules at a glance.</i>

</details>

## Pricing engine

Located at src/services/pricingEngine.ts. Pure TypeScript, no React dependencies, fully unit-testable in Node.

### 3.1 Rule kinds

- base: first match wins per tooth. Sets the starting unit price.
- toothExtra: all matches add up. Cumulative per-tooth fees (e.g. screw-retained surcharge).
- jobExtra: at most one add per job. Job-level flat fees (e.g. model setup).

Rules have a numeric priority (ascending). Lower numbers run first.

### 3.2 Operators

Six operators evaluated against a typed context object built per tooth and per job: equals, notEquals, contains, notContains, isOneOf, notOneOf.

Per-tooth and per-job exclusion lists let the user skip a specific rule for a specific scope without renumbering global priorities.

### 3.3 Currency safety

If a contributing rule's currency does not match the base currency, the rule is dropped and the job is flagged MIXED. The total is never silently summed across currencies.

### 3.4 Audit trail

Every applied rule is recorded in an AppliedRuleBreakdown and rendered in the UI ("Why this price?" popover). The technician can see which rule fired, which were skipped, and which were excluded manually.

### 3.5 Invertibility

tools/test_invertibility.py adds then removes every rule across 12 scenario files in test_data/ and asserts the job returns to its unpriced state. Catches bugs where a rule mutates a non-target field.

## Persistence

Located at src/services/db.ts. Typed schema over six object stores.

- jobs: core domain entity. Keyed by id.
- tariffs: rules (user + system). Keyed by id.
- invoices: generated invoices. Keyed by id.
- assets: STL files as BLOBs.
- metadata: auto-extracted dropdown values (materials, types, doctors, patients). User-keyed.
- logs: append-only audit log. Surfaced at /logs.

Multi-store writes are wrapped in transactions; the pricing engine runs in a read-only transaction. Migrations are additive in the upgrade callback; schema changes never drop data. Current schema version is 5.

The reconciliation pass walks the job store, clears parent-invoice references on jobs whose invoice no longer exists, and restores them to Calculated. Covered by db.reconcile.spec.ts.

## Visualisation

The SVG atlas at public/teeth/ contains 64 hand-tuned SVGs: 32 FDI teeth, each with a base anatomy layer and a filling overlay layer. The TeethVisualizer component composes them on the fly, color-codes by PricingStatus, and dispatches hover events back to the parent grid.

The Three.js viewer (ModelViewer3D.tsx) loads the .stl linked to a job from the assets store and mounts a perspective camera, renderer, ambient + 2 directional lights, and orbit controls via the useThreeScene hook. The mesh auto-rotates, orbit is damped, and geometry, materials, and renderer are disposed on unmount. Falls back to a procedural mesh if the STL is missing.

## Headless test bridge

tools/pwa_bridge.py is a ~40 KB stdlib-only Python CLI that opens a WebSocket to a Chrome launched with --remote-debugging-port=9222. It can fetch, inject, backup, restore, and render invoices as PDFs. Used for integration testing and scripted onboarding.

Commands: fetch-jobs, fetch-tariff-rules, fetch-invoices, fetch-logs, job-import-json, tariff-rules-import-json, save-app-state, load-app-state, create-invoice, render-invoice.

Requires a debug Chrome instance and Python 3.10+. Not a production PDF pipeline.

<details style="border:1px solid #30363d; border-left:4px solid #58a6ff; border-radius:6px; padding:10px 14px; margin:12px 0; background:#161b22;">
<summary style="cursor:pointer; font-weight:bold; font-size:1.05em; color:#58a6ff;">Debug tools (Demo)</summary>
<hr style="border-color:#30363d;">

<video src="https://github.com/user-attachments/assets/3ec7b5a9-9c2d-4550-8587-78582b020d0b"
autoplay loop muted playsinline controls="false"
width="100%"></video>

<br><i>Headless test bridge interacting with the running PWA over CDP.</i>

</details>

## Tooling

Compliance suite at tools/run_compliance_parallel.py orchestrates:

- tooltip_compliance.py: every interactive element is wrapped in a ResponsiveTooltip.
- css_compliance.py: no inline style / sx; styles delegate to .css files.
- i11n_compliance.py: HU and EN locale JSONs have matching keys.
- test_invertibility.py: pricing engine round-trips.
- test_dynamic_import.py: code-splitting boundaries intact.
- doxygen_compliance.py: TSDoc coverage on public services.
- loc_indentation_counter.py: per-file LOC and indentation budget.

Wired into npm run compliance and into GitHub Actions with continue-on-error: true so a drift is surfaced without breaking the build.

Worktree switcher at tools/vite-plugins/worktree-switcher.ts is a custom Vite plugin. On npm run dev, it enumerates sibling git worktrees, junctions the active one into src/, and exposes a WorktreeSwitcher dropdown in the UI. Branch switching without a restart. Uses NTFS junctions on Windows.

CI / CD in .github/workflows/deploy.yml. On push to main: checkout, Node LTS, npm ci, npm test with coverage, the compliance suite, npm run build with version and build date baked in, upload dist/, deploy to GitHub Pages.

## Layout

```
elszamolos/
  src/
    components/     # 80+ React components
    context/        # 7 Context providers
    data/           # teeth paths, dummy jobs
    hooks/          # 10 custom hooks
    locales/
      en/, hu/      # i18n dictionaries
    pages/          # 6 routed pages
    services/       # pricingEngine, db, conditionEvaluator, invoiceService, fileScanner, metadataService, googleDrive
    types/          # type definitions
    utils/          # pure helpers
    App.tsx, main.tsx, theme.ts
  tools/
    pwa_bridge.py
    run_compliance_parallel.py
    tooltip_compliance.py, css_compliance.py, i11n_compliance.py
    test_invertibility.py, test_dynamic_import.py
    doxygen_compliance.py, loc_indentation_counter.py
    import_3d_project.py
    vite-plugins/worktree-switcher.ts
  test_data/        # invertibility scenarios
  public/
    teeth/          # 64 SVG atlas
    example_data/   # sample .dentalProject folders
  business/
    HASZNALATI_UTMUTATO.md   # HU user guide
    SYSTEM_RULES.json        # hard-coded system rules
    pelda_munkak.json, pelda_szabalyok.json   # sample data
  scripts/          # PowerShell helpers
  agent_wisdom.md, semantic_codebase_index.md
  package.json, vite.config.ts, tsconfig*.json, eslint.config.js, sonar-project.properties
```

## Limitations

- No DRM. Data lives in the browser's IndexedDB. Clearing site data loses everything; backups are manual (JSON export or Google Drive).
- The Google Drive OAuth token is stored in IndexedDB unencrypted. Fine for a single-user workstation, not for shared machines.
- Mixed-currency jobs are flagged MIXED and not summed. Intentional, but the user resolves them manually.
- The test bridge PDF export requires a debug Chrome and Python. Not a production PDF pipeline; a real server-side renderer is the intended next step.
- The pricing engine runs in the browser. The intended long-term direction is server-side business logic, but that requires a backend this project does not have yet.
- No online billing integration. The app generates printable invoices only; uploading to an online invoicing provider is a planned next step.
- The STL viewer needs WebGL. Older tablets without WebGL 1.0 will not render the mesh.
- i18n is HU and EN. i11n_compliance.py enforces key parity, but adding a third language is a manual process.
- The unit-test suite covers the engines and the reconciliation paths. There is no Playwright / E2E suite; the test bridge is the closest thing.

## Academic context

BME, "Kliensoldali Rendszerek", 2025/26 fall. Final grade: 20/20 + IMSc. Full audit in kovetelmenyek.md of the source repository.

## LLM-assisted development

I used LLMs during this project. Where:

- Scaffolding: generated the initial Vite + React + MUI skeleton, the db.ts schema, the pricingEngine.ts skeleton.
- Refactoring: suggested dedup candidates, ran jscpd, proposed renames.
- Documentation: drafted parts of the user guide.
- Debugging: suggested CSS / flexbox fixes for the virtualised scroller, verified live in the browser.

The architectural decisions, the pricing engine semantics, the compliance suite, the worktree tooling, and the test design are mine. Code is reviewed line-by-line before commit. The LLM did not make product decisions.

## License

Source code: UNLICENSED. This public mirror is documentation-only and published for portfolio purposes. If you want a deeper look at the implementation, get in touch.
