# DentalRaktar Architecture Diagrams

This folder contains PlantUML diagrams documenting the architecture, behavior, and interactions of the DentalRaktar application.

## 📊 Diagram Overview

| # | Diagram | Type | Purpose | Preview |
|---|---------|------|---------|---------|
| 01 | [Component Architecture](01_component_architecture.puml) | **Component** | High-level view of React components, services, and their relationships | [View](rendered/01_component_architecture.png) |
| 02 | [Domain Model](02_class_domain_model.puml) | **Class** | Core domain entities (Job, Tooth, TariffRule, Invoice) and their relationships | [View](rendered/02_class_domain_model.png) |
| 03 | [Job State Machine](03_job_state_machine.puml) | **State Machine** | Job lifecycle states and transitions (Pending → Calculated → Invoiced) | [View](rendered/03_job_state_machine.png) |
| 04 | [Pricing Engine Activity](04_pricing_activity.puml) | **Activity** | Detailed flow of the `calculateJobPrice` algorithm | [View](rendered/04_pricing_activity.png) |
| 05 | [File Import Sequence](05_file_import_sequence.puml) | **Sequence** | Interaction flow when importing .dentalProject files | [View](rendered/05_file_import_sequence.png) |
| 06 | [Context State Flow](06_context_state_flow.puml) | **Communication** | React Context providers and state management data flow | [View](rendered/06_context_state_flow.png) |
| 07 | [Use Case Overview](07_usecase_overview.puml) | **Use Case** | System features categorized by user role | [View](rendered/07_usecase_overview.png) |
| 08 | [Invoice Creation Sequence](08_invoice_creation_sequence.puml) | **Sequence** | Interaction flow for creating invoices from jobs | [View](rendered/08_invoice_creation_sequence.png) |

## 🖼️ View Diagrams

### Option 1: Pre-rendered Images
The diagrams have been rendered to PNG format in the `rendered/` folder. Click the links above to view them.

### Option 2: VS Code Extension
Install the **PlantUML** extension (`jebbs.plantuml`) and open any `.puml` file. Press `Alt+D` to preview.

### Option 3: Online Editor
Copy the `.puml` content to [PlantUML Web Server](http://www.plantuml.com/plantuml/uml/)

### Option 4: Generate Images Locally
```bash
# Using Docker (recommended - no Java required)
docker run --rm -v "$(pwd):/data" plantuml/plantuml-server:latest -tpng docs/diagrams/*.puml -o docs/diagrams/rendered

# Or using PlantUML CLI (requires Java)
plantuml docs/diagrams/*.puml -tpng -o docs/diagrams/rendered
```

## 🏗️ Key Architectural Insights

### 1. Separation of Concerns
- **Components** (`src/components/`) - UI rendering only
- **Services** (`src/services/`) - Business logic (pricingEngine, fileScanner)
- **Context** (`src/context/`) - Global state management via useReducer
- **Hooks** (`src/hooks/`) - Reusable stateful logic

### 2. Unidirectional Data Flow
```
User Action → dispatch(Action) → Reducer → New State → Re-render
```

### 3. Pricing Engine Priority System
Rules are sorted by `priority` (ascending), then executed by rule kind:
- `base`: first matching base rule wins per tooth
- `toothExtra`: all matching tooth-level extra rules are added
- `jobExtra`: all matching job-level extra rules are added once per job
- Priority 1 rules execute before Priority 10 within each kind

### 4. Job Status Lifecycle
```
Pending → [Calculated | Review | Invalid] → Invoiced
                    ↓
                Discarded
```
- `Invoiced` and `Discarded` jobs are protected from recalculation

## 📁 File Structure
```
docs/diagrams/
├── 01_component_architecture.puml
├── 02_class_domain_model.puml
├── 03_job_state_machine.puml
├── 04_pricing_activity.puml
├── 05_file_import_sequence.puml
├── 06_context_state_flow.puml
├── 07_usecase_overview.puml
├── 08_invoice_creation_sequence.puml
├── rendered/                    # Generated PNG images
│   ├── 01_component_architecture.png
│   ├── 02_class_domain_model.png
│   └── ... (8 files)
└── README.md
```
