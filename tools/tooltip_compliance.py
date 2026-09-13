#!/usr/bin/env python3
import os
import re
import sys
import json

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

def analyze_tooltips_and_clickables(file_path, comp_name, root_dir):
    """Analyzes a TSX file for tooltip wrapping and local i11n sheet key matching."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    violations = []
    
    # Load local component translation sheet if it exists
    i11n_file_path = os.path.join(root_dir, f"{comp_name}-i11n.json")
    i11n_data = {}
    if os.path.exists(i11n_file_path):
        try:
            with open(i11n_file_path, 'r', encoding='utf-8') as f_json:
                i11n_data = json.load(f_json)
        except Exception:
            pass

    # 1. Locate all Tooltip and ResponsiveTooltip blocks and capture their ranges & translation keys
    tooltip_ranges = []
    tooltip_starts = [m for m in re.finditer(r'<(Tooltip|ResponsiveTooltip)\b', content)]
    
    for start in tooltip_starts:
        # Simple scan to find matching close tag </Tooltip> or </ResponsiveTooltip>
        tag_type = start.group(1)
        close_tag = f"</{tag_type}>"
        close_match = content.find(close_tag, start.end())
        if close_match != -1:
            end_idx = close_match + len(close_tag)
            tooltip_range = (start.start(), end_idx)
            
            # Extract the opening tag block to parse the 'title' attribute
            tag_opening_end = content.find('>', start.end())
            if tag_opening_end != -1:
                opening_tag_text = content[start.start():tag_opening_end+1]
                
                # Check for localized title i11n, e.g. title={localT('key')} or title={t('key')}
                i11n_match = re.search(r'title\s*=\s*\{\s*(localT|t)\s*\(\s*[\x27"]([^\x27"]+)[\x27"]\s*\)\s*\}', opening_tag_text)
                literal_match = re.search(r'title\s*=\s*"([^"]+)"', opening_tag_text)
                
                title_key = None
                is_i11n = False
                
                if i11n_match:
                    title_key = i11n_match.group(2)
                    is_i11n = True
                elif literal_match:
                    title_key = literal_match.group(1)
                    is_i11n = False

                tooltip_ranges.append({
                    "range": tooltip_range,
                    "title_key": title_key,
                    "is_i11n": is_i11n,
                    "line": get_line_number(content, start.start()),
                    "tag": tag_type
                })

    # 2. Verify all clickable elements are covered by at least one tooltip range
    clickable_elements = [
        # Standard clickable components
        r'<IconButton\b', r'<Button\b', r'<ListItemButton\b', r'<CardActionArea\b', r'<MenuItem\b',
        # Any component with inline onClick handler
        r'\bonClick\s*=\s*\{'
    ]
    clickable_pattern = re.compile('|'.join(clickable_elements))
    
    for match in clickable_pattern.finditer(content):
        idx = match.start()
        line_num = get_line_number(content, idx)
        snippet = content[idx:idx+40].replace('\n', ' ').strip()
        
        # Check if this clickable element falls inside any of the tooltip ranges
        is_wrapped = False
        associated_tooltip = None
        for t_info in tooltip_ranges:
            t_start, t_end = t_info["range"]
            if t_start <= idx <= t_end:
                is_wrapped = True
                associated_tooltip = t_info
                break
                
        if not is_wrapped:
            # Clickable element missing a tooltip wrapper!
            violations.append(f"Line {line_num}: Clickable element missing tooltip wrapper -> \"{snippet}...\"")
        else:
            # Clickable element is wrapped, now audit the tooltip's translation keys!
            if associated_tooltip:
                key = associated_tooltip["title_key"]
                tag = associated_tooltip["tag"]
                t_line = associated_tooltip["line"]
                
                if not key:
                    violations.append(f"Line {t_line}: Tooltip <{tag}> is missing a 'title' attribute entirely!")
                elif not associated_tooltip["is_i11n"]:
                    violations.append(f"Line {t_line}: Tooltip <{tag}> has a hardcoded literal title \"{key}\" (must use i11n localT)!")
                else:
                    # Tooltip uses i11n. Now check if the key exists in the local Component-i11n.json
                    en_translations = i11n_data.get("en", {})
                    hu_translations = i11n_data.get("hu", {})
                    
                    if key not in en_translations or key not in hu_translations:
                        violations.append(f"Line {t_line}: Tooltip title key '{key}' is missing from local translation sheet '{comp_name}-i11n.json'!")

    return violations

def run_tooltip_compliance(target_dirs):
    print(f"{BOLD}{BLUE}========================================================={ENDC}")
    print(f"{BOLD}{BLUE}          DENTALRAKTAR TOOLTIP COMPLIANCE AUDITOR        {ENDC}")
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
                print(f"{BOLD}Auditing Tooltips for: {comp_name}{ENDC}")

                # Analyze tooltip wrapping and keys
                viols = analyze_tooltips_and_clickables(file_path, comp_name, root)
                total_checks += 1
                if viols:
                    print(f"  {RED}X Tooltip Violations Found ({len(viols)}):{ENDC}")
                    for v in viols:
                        print(f"    - {v}")
                    violations_count += len(viols)
                else:
                    print(f"  {GREEN}OK Clickable Elements & Tooltips compliant{ENDC}")
                    passed_checks += 1

                print("-" * 60)

    # Summary
    compliance_score = (passed_checks / max(total_checks, 1)) * 100
    print(f"\n{BOLD}{BLUE}========================================================={ENDC}")
    print(f"{BOLD}{BLUE}                TOOLTIP COMPLIANCE SUMMARY                {ENDC}")
    print(f"{BOLD}{BLUE}========================================================={ENDC}")
    print(f"Total Components Scanned : {len(all_components)}")
    print(f"Total Violations Found   : {RED if violations_count else GREEN}{violations_count}{ENDC}")
    score_color = GREEN if compliance_score >= 90 else (YELLOW if compliance_score >= 70 else RED)
    print(f"Tooltip Compliance Score : {score_color}{BOLD}{compliance_score:.2f}%{ENDC}")
    print(f"{BLUE}========================================================={ENDC}\n")

    sys.exit(1 if violations_count else 0)

if __name__ == '__main__':
    run_tooltip_compliance(['src/components', 'src/pages'])
