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

def get_line_number(file_content, char_index):
    """Converts a character index in a file to a 1-indexed line number."""
    return file_content.count('\n', 0, char_index) + 1

def analyze_css_file(file_path):
    """Analyzes a single TSX file for inline styles."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    style_violations = []

    # Audit Integrated Styles: style={{...}} or sx={{...}}
    style_pattern = re.compile(r'\b(sx|style)\s*=\s*\{')
    for match in style_pattern.finditer(content):
        line_num = get_line_number(content, match.start())
        snippet = content[match.start():match.start()+40].replace('\n', ' ').strip()
        style_violations.append((line_num, snippet))

    return style_violations

def run_css_compliance(target_dirs):
    print(f"{BOLD}{BLUE}========================================================={ENDC}")
    print(f"{BOLD}{BLUE}            DENTALRAKTAR CSS COMPLIANCE AUDITOR          {ENDC}")
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
                print(f"{BOLD}Auditing CSS for: {comp_name}{ENDC}")

                # 1. Structure check: folder & CSS sheet existence
                parent_dir_name = os.path.basename(root)
                css_file = os.path.join(root, f"{comp_name}.css")

                # Check folder encapsulation
                total_checks += 1
                if parent_dir_name != comp_name:
                    print(f"  {RED}X Folder Error:{ENDC} Component should be in '{comp_name}/' but is in '{parent_dir_name}/'")
                    violations_count += 1
                else:
                    passed_checks += 1

                # Check CSS stylesheet existence
                total_checks += 1
                if not os.path.exists(css_file):
                    print(f"  {RED}X Missing File:{ENDC} Delegated style sheet '{comp_name}.css' is missing.")
                    violations_count += 1
                else:
                    passed_checks += 1

                # 2. Inline style audit
                style_viols = analyze_css_file(file_path)
                total_checks += 1
                if style_viols:
                    print(f"  {RED}X Integrated Styles Found ({len(style_viols)}):{ENDC}")
                    for line, snippet in style_viols:
                        print(f"    - Line {line}: {YELLOW}{snippet}...{ENDC}")
                    violations_count += len(style_viols)
                else:
                    print(f"  {GREEN}OK Style Delegation Perfect (no inline sx/style){ENDC}")
                    passed_checks += 1

                print("-" * 60)

    # Summary
    compliance_score = (passed_checks / max(total_checks, 1)) * 100
    print(f"\n{BOLD}{BLUE}========================================================={ENDC}")
    print(f"{BOLD}{BLUE}                  CSS COMPLIANCE SUMMARY                 {ENDC}")
    print(f"{BOLD}{BLUE}========================================================={ENDC}")
    print(f"Total Components Scanned : {len(all_components)}")
    print(f"Total Violations Found   : {RED if violations_count else GREEN}{violations_count}{ENDC}")
    score_color = GREEN if compliance_score >= 90 else (YELLOW if compliance_score >= 70 else RED)
    print(f"CSS Compliance Score     : {score_color}{BOLD}{compliance_score:.2f}%{ENDC}")
    print(f"{BLUE}========================================================={ENDC}\n")

    sys.exit(1 if violations_count else 0)

if __name__ == '__main__':
    run_css_compliance(['src/components', 'src/pages'])
