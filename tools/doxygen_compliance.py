#!/usr/bin/env python3
import os
import re
import sys

# Color formatting helpers for CLI
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
BOLD = '\033[1m'
ENDC = '\033[0m'

def get_line_number(content, index):
    """Converts a character index in a file to a 1-indexed line number."""
    return content.count('\n', 0, index) + 1

def get_exclusion_ranges(content):
    """Identifies the index ranges of comments and string literals to exclude them from parsing."""
    ranges = []
    # Match block comments (/* ... */)
    for m in re.finditer(r'/\*.*?\*/', content, flags=re.DOTALL):
        ranges.append((m.start(), m.end()))
    # Match single line comments (// ...)
    for m in re.finditer(r'//.*', content):
        ranges.append((m.start(), m.end()))
    # Match string literals (double, single, and template quotes)
    for m in re.finditer(r'"[^"\n\\]*(?:\\.[^"\n\\]*)*"', content):
        ranges.append((m.start(), m.end()))
    for m in re.finditer(r"'[^'\n\\]*(?:\\.[^'\n\\]*)*'", content):
        ranges.append((m.start(), m.end()))
    for m in re.finditer(r'`[^`\\]*(?:\\.[^`\\]*)*`', content, flags=re.DOTALL):
        ranges.append((m.start(), m.end()))
    return ranges

def is_inside_range(idx, ranges):
    """Checks if a given character index falls inside any of the exclusion ranges."""
    for start, end in ranges:
        if start <= idx < end:
            return True
    return False

def is_top_level(content, match_start_idx):
    """Checks if a match is top-level (no indentation other than export/default keywords)."""
    line_start_idx = content.rfind('\n', 0, match_start_idx) + 1
    line_prefix = content[line_start_idx : match_start_idx]
    cleaned_prefix = re.sub(r'\b(export|default)\b', '', line_prefix).strip()
    return len(cleaned_prefix) == 0

def find_preceding_comment(content, decl_start_idx):
    """Scans backwards to find the immediately preceding Doxygen/JSDoc block comment."""
    left_content = content[:decl_start_idx]
    stripped_left = left_content.rstrip()
    if stripped_left.endswith("default"):
        stripped_left = stripped_left[:-7].rstrip()
    if stripped_left.endswith("export"):
        stripped_left = stripped_left[:-6].rstrip()
    if stripped_left.endswith("*/"):
        comment_start = stripped_left.rfind("/**")
        if comment_start != -1:
            comment_text = stripped_left[comment_start:]
            # Ensure there is no closing */ inside the comment body (i.e. we found the correct block)
            if "*/" not in comment_text[:-2]:
                return comment_text.strip()
    return None

def parse_params(params_str):
    """Parses parameter names from a TS/TSX function parameter signature string."""
    # Clean default values to avoid nested commas/equals issues
    params_str = re.sub(r'=[^,]+', '', params_str)
    
    parts = []
    current_part = []
    bracket_depth = 0
    brace_depth = 0
    
    for char in params_str:
        if char in ('<', '['):
            bracket_depth += 1
        elif char in ('>', ']'):
            bracket_depth -= 1
        elif char == '{':
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
        
        if char == ',' and bracket_depth == 0 and brace_depth == 0:
            parts.append("".join(current_part).strip())
            current_part = []
        else:
            current_part.append(char)
            
    if current_part:
        parts.append("".join(current_part).strip())

    names = []
    for part in parts:
        if not part:
            continue
        # Handle destructured object parameter: e.g. { state, action }
        if part.startswith('{') and '}' in part:
            inner = part.split('}')[0]
            for word in re.findall(r'\b\w+\b', inner):
                # Ignore keywords or common types
                if word not in ('any', 'string', 'number', 'boolean', 'object'):
                    names.append(word)
            continue
            
        subparts = part.split(':')
        name_part = subparts[0].strip().rstrip('?')
        if re.match(r'^[a-zA-Z_$][a-zA-Z0-9_$]*$', name_part):
            names.append(name_part)
            
    return names

def check_returns_value(return_type_str):
    """Heuristic to determine if a function's return type indicates a returned value."""
    if not return_type_str:
        return False
    ret_type = return_type_str.strip().lstrip(':').strip()
    if ret_type.startswith(('void', 'undefined', 'never', 'Promise<void>', 'Promise<undefined>')):
        return False
    return True

def analyze_doxygen_compliance(file_path):
    """Audits a single TS/TSX file for Doxygen comment compliance."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    violations = []
    exclusion_ranges = get_exclusion_ranges(content)

    # 1. Check for File-Level Description (@file) near the top of the file
    file_comment_match = re.search(r'/\*\*(.*?)\*/', content, flags=re.DOTALL)
    has_file_doc = False
    if file_comment_match and file_comment_match.start() < 1000:
        comment_body = file_comment_match.group(1)
        if '@file' in comment_body or '\\file' in comment_body:
            has_file_doc = True
            
    if not has_file_doc:
        violations.append((1, "Missing file-level documentation block containing '@file' tag."))

    # 2. Check Structs (Interfaces, Classes, Type Aliases)
    struct_patterns = [
        (r'\binterface\s+(\w+)', "Interface"),
        (r'\bclass\s+(\w+)', "Class"),
        (r'\btype\s+(\w+)\s*=', "Type Alias")
    ]
    
    for pattern, label in struct_patterns:
        for match in re.finditer(pattern, content):
            idx = match.start()
            if is_inside_range(idx, exclusion_ranges) or not is_top_level(content, idx):
                continue
                
            name = match.group(1)
            line_num = get_line_number(content, idx)
            comment = find_preceding_comment(content, idx)
            
            if not comment:
                violations.append((line_num, f"{label} '{name}' is missing Doxygen/JSDoc documentation block (/** ... */)."))

    # 3. Check Functions and React Components
    function_patterns = [
        # Normal function declaration: function foo(bar)
        (r'\bfunction\s+(\w+)\s*\(([^)]*)\)', "Function"),
        # Arrow function declaration: const foo = (bar) =>
        (r'\bconst\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*([^=>]+))?\s*=>', "Arrow Function")
    ]

    for pattern, label in function_patterns:
        for match in re.finditer(pattern, content):
            idx = match.start()
            if is_inside_range(idx, exclusion_ranges) or not is_top_level(content, idx):
                continue
                
            name = match.group(1)
            params_str = match.group(2)
            
            # Extract optional return type if present (only in Arrow Function pattern)
            return_type_str = match.group(3) if len(match.groups()) >= 3 else None
            
            line_num = get_line_number(content, idx)
            comment = find_preceding_comment(content, idx)
            
            is_component = name[0].isupper() and label == "Arrow Function"
            item_label = "Component" if is_component else "Function"
            
            if not comment:
                violations.append((line_num, f"{item_label} '{name}' is missing Doxygen/JSDoc documentation block (/** ... */)."))
            else:
                # Validate parameters
                param_names = parse_params(params_str)
                for param in param_names:
                    # Check for @param <param_name>
                    param_pattern = rf'[@\\]param\s+{re.escape(param)}\b'
                    if not re.search(param_pattern, comment):
                        violations.append((line_num, f"{item_label} '{name}' parameter '{param}' is missing '@param' documentation."))
                
                # Validate return description (if applicable)
                # If there's an explicit non-void return type, or if it's a utility helper with a lowercase name and not returning void
                has_explicit_return = check_returns_value(return_type_str)
                
                if has_explicit_return and not is_component:
                    return_pattern = r'[@\\]returns?\b'
                    if not re.search(return_pattern, comment):
                        violations.append((line_num, f"Function '{name}' return value is missing '@return' documentation."))

    return sorted(violations, key=lambda x: x[0])

def run_doxygen_compliance(target_dirs):
    print(f"{BOLD}{BLUE}========================================================={ENDC}")
    print(f"{BOLD}{BLUE}            DOXYGEN COMPLIANCE AUDITOR (TS/TSX)          {ENDC}")
    print(f"{BOLD}{BLUE}========================================================={ENDC}\n")

    all_files = []
    total_checks = 0
    passed_checks = 0
    violations_count = 0

    for base_dir in target_dirs:
        if not os.path.exists(base_dir):
            continue
            
        for root, dirs, files in os.walk(base_dir):
            # Exclude tests and spec folders
            if "__tests__" in root or "tests" in root:
                continue
                
            for file in files:
                if not file.endswith(('.ts', '.tsx')):
                    continue
                # Skip specs, tests, or config files
                if any(ext in file for ext in ['.spec.ts', '.spec.tsx', '.test.ts', '.test.tsx', '-i11n.json', 'vite-env.d.ts']):
                    continue

                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, start=os.getcwd())
                all_files.append(file_path)
                
                print(f"{BOLD}Auditing Doxygen/JSDoc for: {rel_path}{ENDC}")
                
                viols = analyze_doxygen_compliance(file_path)
                total_checks += 1
                
                if viols:
                    print(f"  {RED}X Doxygen Violations Found ({len(viols)}):{ENDC}")
                    for line, msg in viols:
                        print(f"    - Line {line}: {YELLOW}{msg}{ENDC}")
                    violations_count += len(viols)
                else:
                    print(f"  {GREEN}OK Compliant Doxygen documentation{ENDC}")
                    passed_checks += 1
                    
                print("-" * 60)

    # Summary
    compliance_score = (passed_checks / max(total_checks, 1)) * 100
    print(f"\n{BOLD}{BLUE}========================================================={ENDC}")
    print(f"{BOLD}{BLUE}                DOXYGEN COMPLIANCE SUMMARY                {ENDC}")
    print(f"{BOLD}{BLUE}========================================================={ENDC}")
    print(f"Total Source Files Scanned : {len(all_files)}")
    print(f"Total Violations Found     : {RED if violations_count else GREEN}{violations_count}{ENDC}")
    score_color = GREEN if compliance_score >= 90 else (YELLOW if compliance_score >= 70 else RED)
    print(f"Doxygen Compliance Score   : {score_color}{BOLD}{compliance_score:.2f}%{ENDC}")
    print(f"{BLUE}========================================================={ENDC}\n")

    # Exit with code 1 if violations are found, else 0
    sys.exit(1 if violations_count else 0)

if __name__ == '__main__':
    run_doxygen_compliance(['src/components', 'src/pages', 'src/utils', 'src/services', 'src/context'])
