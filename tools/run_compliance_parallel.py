import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
import sys
import argparse

def run_test(test_cmd, test_name):
    start_time = time.time()
    print(f"[START] {test_name}...")
    
    # Run the test command and capture output
    result = subprocess.run(test_cmd, shell=True, capture_output=True, text=True)
    
    duration = time.time() - start_time
    print(f"[FINISH] {test_name} completed in {duration:.2f}s")
    return {
        "name": test_name,
        "duration": duration,
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr
    }

def main():
    parser = argparse.ArgumentParser(description="Run compliance tests in parallel")
    parser.add_argument("-v", "--verbose", action="store_true", help="Print detailed stdout/stderr of tests (including code snippets)")
    args = parser.parse_args()

    python_bin = sys.executable
    tests = [
        (f'"{python_bin}" tools/tooltip_compliance.py', "Tooltip Compliance"),
        (f'"{python_bin}" tools/css_compliance.py', "CSS Compliance"),
        (f'"{python_bin}" tools/i11n_compliance.py', "Translation Parity"),
        (f'"{python_bin}" tools/loc_indentation_counter.py', "LOC & Indentation Counter"),
        (f'"{python_bin}" tools/doxygen_compliance.py', "Doxygen Compliance")
    ]
    
    overall_start = time.time()
    print("=========================================================")
    print("       RUNNING DESIGN-SYSTEM COMPLIANCE IN PARALLEL      ")
    print("=========================================================")
    
    # Run tests concurrently
    with ThreadPoolExecutor(max_workers=len(tests)) as executor:
        futures = [executor.submit(run_test, cmd, name) for cmd, name in tests]
        results = [future.result() for future in futures]
        
    overall_duration = time.time() - overall_start
    
    print("\n=========================================================")
    print("                    INDIVIDUAL RESULTS                    ")
    print("=========================================================")
    
    failed = False
    for res in results:
        status = "PASSED" if res["returncode"] == 0 else "FAILED"
        # Support colors if terminal supports them
        color = "\033[92m" if res["returncode"] == 0 else "\033[91m"
        reset = "\033[0m"
        print(f"* {res['name']}: {color}{status}{reset} (Duration: {res['duration']:.2f}s)")
        
        if res["name"] == "LOC & Indentation Counter":
            # Indent the output slightly for neat formatting
            formatted_output = "\n".join("  " + line for line in res["stdout"].strip().split("\n"))
            print(formatted_output)
        
        if res["returncode"] != 0:
            failed = True
            if res["name"] != "LOC & Indentation Counter": # Skip redundant error summary if LOC failed
                output_to_parse = res["stderr"].strip() if res["stderr"] else res["stdout"].strip()
                
                if args.verbose:
                    print(f"\n--- {res['name']} Error Log ---")
                    print(output_to_parse)
                    print("-" * 40)
                else:
                    # Intelligently parse the error output to extract only a clean, high-density summary
                    if "Connection refused" in output_to_parse or "ConnectionRefusedError" in output_to_parse:
                        print("  +- \033[93mConnection Refused:\033[0m Is Chrome running with remote debugging port 9222 active?")
                    else:
                        lines = [line.strip() for line in output_to_parse.split('\n') if line.strip()]
                        summary_lines = []
                        # Search from bottom-up for key score/violation summary metrics
                        for line in reversed(lines):
                            if any(term in line for term in ["Score", "Violations", "Scanned", "failed", "Error"]):
                                summary_lines.insert(0, line)
                            if len(summary_lines) >= 3:
                                break
                        if summary_lines:
                            print("  +- " + "\n  +- ".join(summary_lines))
                        else:
                            print(f"  +- {lines[-1] if lines else 'Unknown error context.'}")
            
    print("\n=========================================================")
    print(f"Total Parallel Duration: {overall_duration:.2f}s")
    print("=========================================================")
    
    if failed:
        if not args.verbose:
            print("[Tip] Run with '--verbose' or '-v' to view the full detailed code analysis snippets.")
        print("\033[91mCompliance check failed!\033[0m")
        sys.exit(1)
    else:
        print("\033[92mAll compliance checks passed successfully!\033[0m")
        sys.exit(0)

if __name__ == "__main__":
    main()
