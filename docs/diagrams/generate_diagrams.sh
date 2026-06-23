#!/bin/bash
# Script to generate PNG images from PlantUML diagrams
# Requires: Java + Graphviz + PlantUML JAR, OR Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/rendered"
PLANTUML_JAR="$SCRIPT_DIR/plantuml.jar"

echo "🌱 Generating PlantUML diagrams..."
echo "Source: $SCRIPT_DIR"
echo "Output: $OUTPUT_DIR"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "✅ Using Docker (PlantUML Server)"
    docker run --rm \
        -v "$SCRIPT_DIR:/data" \
        plantuml/plantuml-server:latest \
        -tpng \
        /data/*.puml \
        -o /data/rendered
    
    echo "✅ Diagrams generated successfully!"
    ls -la "$OUTPUT_DIR"
    
elif command -v java &> /dev/null; then
    echo "⚠️  Docker not found, checking for Java + Graphviz..."
    
    # Check for Graphviz
    if ! command -v dot &> /dev/null; then
        echo "❌ Graphviz not found. Please install:"
        echo "   brew install graphviz"
        exit 1
    fi
    
    # Download PlantUML JAR if not exists
    if [ ! -f "$PLANTUML_JAR" ]; then
        echo "📥 Downloading PlantUML JAR..."
        curl -L -o "$PLANTUML_JAR" \
            "https://github.com/plantuml/plantuml/releases/download/v1.2024.5/plantuml-1.2024.5.jar" 2>/dev/null
    fi
    
    if [ -f "$PLANTUML_JAR" ]; then
        echo "Rendering diagrams..."
        
        # Clean and create output directory
        rm -rf "$OUTPUT_DIR"
        mkdir -p "$OUTPUT_DIR"
        
        # Render all diagrams
        java -jar "$PLANTUML_JAR" -tpng "$SCRIPT_DIR"/*.puml -o "$OUTPUT_DIR"
        
        # Rename files to match convention
        cd "$OUTPUT_DIR"
        for file in *.png; do
            case "$file" in
                "Component Architecture.png") mv "$file" "01_component_architecture.png" ;;
                "Domain Model.png") mv "$file" "02_class_domain_model.png" ;;
                "Job State Machine.png") mv "$file" "03_job_state_machine.png" ;;
                "Pricing Engine Activity.png") mv "$file" "04_pricing_activity.png" ;;
                "File Import Sequence.png") mv "$file" "05_file_import_sequence.png" ;;
                "Context State Flow.png") mv "$file" "06_context_state_flow.png" ;;
                "Use Case Overview.png") mv "$file" "07_usecase_overview.png" ;;
                "Invoice Creation Sequence.png") mv "$file" "08_invoice_creation_sequence.png" ;;
            esac
        done
        
        echo "✅ Diagrams generated successfully!"
        ls -la "$OUTPUT_DIR"
        
        # Clean up jar file
        rm -f "$PLANTUML_JAR"
    else
        echo "❌ Failed to download PlantUML JAR"
        exit 1
    fi
    
else
    echo "❌ Neither Docker nor Java found. Please install one of them:"
    echo "   - Docker: https://docs.docker.com/get-docker/"
    echo "   - Java: https://www.java.com/en/download/"
    echo ""
    echo "Or use the VS Code PlantUML extension for preview."
    exit 1
fi
