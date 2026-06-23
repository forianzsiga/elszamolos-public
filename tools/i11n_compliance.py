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

DISPLAY_ATTRIBUTES = ['label', 'placeholder', 'title', 'helperText', 'text', 'subtitle', 'alt', 'heading']

def get_line_number(file_content, char_index):
    """Converts a character index in a file to a 1-indexed line number."""
    return file_content.count('\n', 0, char_index) + 1

def analyze_i11n_file(file_path):
    """Analyzes a single TSX file for hardcoded display strings."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    string_violations = []

    # 1. Audit Text nodes: >Some Text< (ignoring braces, digits, spacing, or comments)
    text_node_pattern = re.compile(r'>\s*([^<>{}\d\s/][^<{}]*[^<>{}\s/])\s*<')
    for match in text_node_pattern.finditer(content):
        text = match.group(1).strip()
        # Ignore comments or obvious JS code/markers
        if text.startswith('/*') or text.endswith('*/') or text.startswith('*') or text.startswith('import ') or text.startswith('export '):
            continue
        line_num = get_line_number(content, match.start(1))
        string_violations.append((line_num, f"JSX Text Node: \"{text}\""))

    # 2. Audit Display-related attributes: label="Some Label", title="Some Title" (literal strings only)
    for attr in DISPLAY_ATTRIBUTES:
        attr_pattern = re.compile(rf'\b{attr}\s*=\s*"([^"]+)"')
        for match in attr_pattern.finditer(content):
            text = match.group(1).strip()
            # Ignore standard structural keywords or system IDs
            if '/' in text or text == 'div' or text == 'span' or text == 'primary' or text == 'secondary':
                continue
            line_num = get_line_number(content, match.start(1))
            string_violations.append((line_num, f"Prop [{attr}]: \"{text}\""))

    return string_violations

def run_i11n_compliance(target_dirs):
    print(f"{BOLD}{BLUE}========================================================={ENDC}")
    print(f"{BOLD}{BLUE}            DENTALRAKTAR i11n COMPLIANCE AUDITOR          {ENDC}")
    print(f"{BOLD}{BLUE}========================================================={ENDC}\n")

    all_components = []
    total_checks = 0
    passed_checks = 0
    violations_count = 0

    for base_dir in target_dirs:
        if not os.path.exists(base_dir):
            continue
        
        for root, dirs, files in os.walk(base_dir):
            for file in files:
                if not file.endswith('.tsx'):
                    continue

                file_path = os.path.join(root, file)
                comp_name = os.path.splitext(file)[0]
                
                if file in ['App.tsx', 'main.tsx', 'vite-env.d.ts']:
                    continue

                all_components.append(file_path)
                print(f"{BOLD}Auditing i11n for: {comp_name}{ENDC}")

                # 1. Structure check: folder & JSON sheet existence
                parent_dir_name = os.path.basename(root)
                i11n_file = os.path.join(root, f"{comp_name}-i11n.json")

                # Check folder encapsulation
                total_checks += 1
                if parent_dir_name != comp_name:
                    print(f"  {RED}X Folder Error:{ENDC} Component should be in '{comp_name}/' but is in '{parent_dir_name}/'")
                    violations_count += 1
                else:
                    passed_checks += 1

                # Check translation sheet existence
                total_checks += 1
                if not os.path.exists(i11n_file):
                    print(f"  {RED}X Missing File:{ENDC} Translation sheet '{comp_name}-i11n.json' is missing.")
                    violations_count += 1
                else:
                    passed_checks += 1

                # 2. Hardcoded strings check
                string_viols = analyze_i11n_file(file_path)
                total_checks += 1
                if string_viols:
                    print(f"  {RED}X Hardcoded Display Strings Found ({len(string_viols)}):{ENDC}")
                    for line, snippet in string_viols:
                        print(f"    - Line {line}: {YELLOW}{snippet}{ENDC}")
                    violations_count += len(string_viols)
                else:
                    print(f"  {GREEN}OK Internationalization Perfect (no hardcoded strings){ENDC}")
                    passed_checks += 1

                print("-" * 60)

    # Summary
    compliance_score = (passed_checks / max(total_checks, 1)) * 100
    print(f"\n{BOLD}{BLUE}========================================================={ENDC}")
    print(f"{BOLD}{BLUE}                 i11n COMPLIANCE SUMMARY                 {ENDC}")
    print(f"{BOLD}{BLUE}========================================================={ENDC}")
    print(f"Total Components Scanned : {len(all_components)}")
    print(f"Total Violations Found   : {RED if violations_count else GREEN}{violations_count}{ENDC}")
    score_color = GREEN if compliance_score >= 90 else (YELLOW if compliance_score >= 70 else RED)
    print(f"i11n Compliance Score    : {score_color}{BOLD}{compliance_score:.2f}%{ENDC}")
    print(f"{BLUE}========================================================={ENDC}\n")

    sys.exit(1 if violations_count else 0)

if __name__ == '__main__':
    run_i11n_compliance(['src/components', 'src/pages'])
