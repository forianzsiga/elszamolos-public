#!/usr/bin/env python3
import os
import sys
import re

# Color formatting helpers for CLI
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
BOLD = '\033[1m'
ENDC = '\033[0m'

def analyze_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception:
        return None

    # Strip multi-line comments (/* ... */) for JS/TS/CSS
    content_no_multiline = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    # Split into lines
    lines = content_no_multiline.split('\n')
    
    logical_loc = 0
    max_indent = 0
    total_indent = 0
    non_empty_lines = 0

    for line in lines:
        stripped = line.strip()
        # Skip empty lines or single-line comments starting with //
        if not stripped or stripped.startswith('//'):
            continue
            
        non_empty_lines += 1
        logical_loc += 1
        
        # Count leading indentation (spaces or tab character counts)
        stripped_left = line.lstrip()
        indent_str = line[:len(line) - len(stripped_left)]
        indent_val = 0
        for char in indent_str:
            if char == ' ':
                indent_val += 1
            elif char == '\t':
                indent_val += 4
        
        # Indent depth level (assuming standard 4-space indent units)
        indent_level = indent_val / 4.0
        
        max_indent = max(max_indent, indent_level)
        total_indent += indent_level

    avg_indent = (total_indent / non_empty_lines) if non_empty_lines > 0 else 0.0

    return {
        "raw_loc": len(content.split('\n')),
        "logical_loc": logical_loc,
        "max_indent": max_indent,
        "avg_indent": avg_indent
    }

def run_counter(target_dirs):
    all_files = []
    
    for base_dir in target_dirs:
        if not os.path.exists(base_dir):
            continue
        for root, _, files in os.walk(base_dir):
            for file in files:
                if file.endswith(('.tsx', '.ts', '.css', '.js', '.jsx')):
                    file_path = os.path.join(root, file)
                    stats = analyze_file(file_path)
                    if stats:
                        all_files.append({
                            "path": file_path,
                            "name": os.path.relpath(file_path, start=os.getcwd()),
                            **stats
                        })
    
    # Sort by Logical LOC descending
    all_files.sort(key=lambda x: x['logical_loc'], reverse=True)
    
    print(f"{BOLD}{BLUE}========================================================={ENDC}")
    print(f"{BOLD}{BLUE}          LOC & INDENTATION ANALYSIS (TOP 10)            {ENDC}")
    print(f"{BOLD}{BLUE}========================================================={ENDC}")
    
    header = f"{'#':<3} | {'File Path':<45} | {'Logical LOC':<11} | {'Max Indent':<10} | {'Avg Indent':<10}"
    print(f"{BOLD}{header}{ENDC}")
    print("-" * len(header))
    
    failed_files = []
    
    for idx, f in enumerate(all_files, 1):
        # Print only top 10
        if idx <= 10:
            path_str = f['name']
            if len(path_str) > 45:
                path_str = "..." + path_str[-42:]
            print(f"{idx:<3} | {path_str:<45} | {f['logical_loc']:<11} | {f['max_indent']:<10.1f} | {f['avg_indent']:<10.2f}")
            
        # Hard threshold check: Fail if logical_loc > 500 AND max_indent > 10
        if f['logical_loc'] > 500 and f['max_indent'] > 10.0:
            failed_files.append(f)
            
    print(f"{BLUE}========================================================={ENDC}\n")
    
    if failed_files:
        print(f"{BOLD}{RED}🔴 COMPLIANCE FAILURE: File(s) exceeded the strict quality thresholds!{ENDC}")
        print(f"Thresholds: Logical LOC <= 500 AND Max Nesting Depth <= 10.0\n")
        for f in failed_files:
            print(f"  ❌ {BOLD}{f['name']}{ENDC}")
            print(f"     ├─ Logical LOC: {f['logical_loc']} (limit: 500)")
            print(f"     └─ Max Nesting Indent Depth: {f['max_indent']:.1f} (limit: 10.0)")
        print(f"\n{RED}Please refactor or split these files to resolve the violations.{ENDC}")
        sys.exit(1)
        
    print(f"{BOLD}{GREEN}✅ All files comply with LOC and nesting depth standards.{ENDC}")
    sys.exit(0)

if __name__ == '__main__':
    run_counter(['src/components', 'src/pages'])
