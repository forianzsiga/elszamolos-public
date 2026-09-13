# PlantUML Diagrams Summary

## 📋 Overview

This documentation set provides **8 comprehensive PlantUML diagrams** that visualize the DentalRaktar application's architecture, behavior, and interactions.

## 📁 Files Created

### Source Files (`.puml`)
| File | Type | Lines | Description |
|------|------|-------|-------------|
| `01_component_architecture.puml` | Component | 65 | React component hierarchy and service dependencies |
| `02_class_domain_model.puml` | Class | 105 | Core domain entities and relationships |
| `03_job_state_machine.puml` | State Machine | 70 | Job lifecycle states and transitions |
| `04_pricing_activity.puml` | Activity | 85 | Pricing engine algorithm flow |
| `05_file_import_sequence.puml` | Sequence | 55 | File import workflow |
| `06_context_state_flow.puml` | Communication | 60 | React Context data flow |
| `07_usecase_overview.puml` | Use Case | 80 | System features by user role |
| `08_invoice_creation_sequence.puml` | Sequence | 75 | Invoice creation workflow |

### Rendered Images (`.png`)
All diagrams have been rendered to high-resolution PNG files in `rendered/` folder.

### Documentation
- `README.md` - Main diagram documentation with viewing instructions
- `DIAGRAMS_SUMMARY.md` - This file
- `generate_diagrams.sh` - Script to regenerate images

## 🎯 Key Diagrams Explained

### 1. Component Architecture (01)
**Purpose**: Shows the complete React component tree
**Key Elements**:
- Provider nesting (ThemeProvider → LogProvider → JobProvider → TariffProvider → InvoiceProvider)
- Page → Component relationships
- Service layer dependencies
- Browser API connections

### 2. Domain Model (02)
**Purpose**: Documents the core business entities
**Key Entities**:
- `Job` - Contains multiple `Tooth` objects
- `Tooth` - Individual unit with pricing status
- `TariffRule` - Pricing logic with conditions and actions
- `Invoice` - Aggregates jobs for billing
- `PersonalDetails` - Company info for invoices

### 3. Job State Machine (03)
**Purpose**: Visualizes job lifecycle
**States**: Pending → Calculated/Review/Invalid → Invoiced
**Protected States**: Invoiced and Discarded prevent recalculation

### 4. Pricing Engine Activity (04)
**Purpose**: Detailed algorithm flow
**Key Logic**:
- Rule sorting by priority (ascending)
- Per-tooth evaluation
- Context creation (Job + Tooth properties)
- First-match-wins rule application

### 5. File Import Sequence (05)
**Purpose**: Complete import workflow
**Steps**: Folder selection → XML parsing → Hash generation → Duplicate detection → Price calculation → DB persistence

### 6. Context State Flow (06)
**Purpose**: React state management architecture
**Pattern**: useReducer + Context API
**Action Types**: 10+ action types across 4 contexts

### 7. Use Case Overview (07)
**Purpose**: Feature mapping to user roles
**Roles**: Technician, Administrator, Developer
**Features**: 27 use cases categorized

### 8. Invoice Creation Sequence (08)
**Purpose**: Invoice workflow
**Validation**: Status checks, duplicate prevention
**Updates**: Job and tooth status changes

## 🚀 Usage

### View Diagrams
```bash
# Open README with links
open docs/diagrams/README.md

# Or view rendered images directly
open docs/diagrams/rendered/01_component_architecture.png
```

### Regenerate Images
```bash
# Using the provided script
bash docs/diagrams/generate_diagrams.sh

# Requirements:
# - Java (for PlantUML)
# - Graphviz (for rendering)
# - OR Docker
```

### Edit Diagrams
1. Open any `.puml` file in VS Code
2. Install PlantUML extension
3. Press `Alt+D` for live preview
4. Save changes
5. Regenerate PNGs

## 📊 Statistics

- **Total Diagrams**: 8
- **Total Lines of PUML**: ~550
- **Rendered Images**: 8 PNG files
- **Total Image Size**: ~1.5 MB
- **Coverage**: Architecture, Domain, Behavior, Interactions

## 🔗 Integration

The diagrams are referenced from:
- `README.md` - Main project documentation
- `kovetelmenyek.md` - Requirements audit (architectural decisions)

## 🎓 Educational Value

These diagrams serve multiple purposes:
1. **Onboarding** - New developers understand the system quickly
2. **Architecture Review** - Visual validation of design decisions
3. **Documentation** - Maintenance and extension guidance
4. **Academic** - University project documentation requirements

## 📝 Maintenance

When making architectural changes:
1. Update the relevant `.puml` file
2. Run `generate_diagrams.sh` to update images
3. Update this summary if needed
4. Commit both source and rendered files

---

*Generated: 2025-12-26*
*PlantUML Version: 1.2024.5*
*Graphviz Version: 14.1.1*
