import os
import sys
import json
import shutil
import subprocess
import argparse

def slugify_path(path):
    # Create a unique, clean, filesystem-safe identifier from the path
    clean_path = path.replace('src/', '').replace('/', '-').replace('.', '-').lower()
    return clean_path

def get_associated_files(file_path):
    # Identify the target file and closely associated sibling files (editable assets)
    target_dir = os.path.dirname(file_path)
    base_name = os.path.splitext(os.path.basename(file_path))[0]
    
    files_to_copy = []
    
    if not os.path.exists(target_dir):
        return [file_path]
        
    # Check if the folder name matches the component name (encapsulated component directory)
    folder_name = os.path.basename(target_dir)
    if folder_name == base_name:
        # Encapsulated folder - copy all files inside this directory
        for f in os.listdir(target_dir):
            full_path = os.path.join(target_dir, f)
            if os.path.isfile(full_path):
                files_to_copy.append(full_path)
    else:
        # Flat folder or page - copy target file and any files starting with the same base name prefix
        for f in os.listdir(target_dir):
            if f.startswith(base_name):
                full_path = os.path.join(target_dir, f)
                if os.path.isfile(full_path):
                    files_to_copy.append(full_path)
                    
    # Guarantee the target file is in the list
    if file_path not in files_to_copy:
        files_to_copy.append(file_path)
        
    return files_to_copy

def get_dependencies(file_path):
    # Run madge on the target file to solve the dependency graph
    print(f"🔍 Running dependency analysis on '{file_path}'...")
    result = subprocess.run(
        f"npx madge --json {file_path}",
        shell=True, capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"⚠️ Warning: Madge failed to find dependencies for '{file_path}': {result.stderr.strip()}")
        return []
        
    try:
        dep_data = json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"⚠️ Warning: Madge output was not valid JSON: {result.stdout}")
        return []
        
    target_dir = os.path.dirname(file_path)
    dependencies = []
    
    for key, deps in dep_data.items():
        for dep in deps:
            # 1. Try resolving relative to the project root (Madge default output)
            resolved = os.path.normpath(os.path.join(os.getcwd(), dep))
            if not os.path.exists(resolved):
                # 2. Try resolving relative to target file directory
                resolved = os.path.normpath(os.path.join(target_dir, dep))
                
            # If the resolved file exists and is indeed a file, record it
            if os.path.exists(resolved) and os.path.isfile(resolved):
                dependencies.append(resolved)
                
    # Deduplicate
    dependencies = list(set(dependencies))
    return dependencies

def create_sandbox(file_path, slug, issues):
    sandbox_root = f".opencode/sandboxes/task-{slug}"
    print(f"📦 Creating isolated sandbox environment at '{sandbox_root}'...")
    
    # Clean up existing sandbox
    if os.path.exists(sandbox_root):
        shutil.rmtree(sandbox_root)
        
    os.makedirs(sandbox_root, exist_ok=True)
    
    # 1. Get associated files (editable target component assets)
    associated_files = get_associated_files(file_path)
    print(f"   ↳ Identified {len(associated_files)} associated editable assets to copy.")
    
    for src_file in associated_files:
        if not os.path.exists(src_file):
            continue
        dest_file = os.path.join(sandbox_root, src_file)
        os.makedirs(os.path.dirname(dest_file), exist_ok=True)
        shutil.copy2(src_file, dest_file)
        print(f"     [EDITABLE] {src_file} ➔ {dest_file}")
        
    # 2. Get dependencies (read-only reference files needed to compile/understand code)
    dependencies = get_dependencies(file_path)
    print(f"   ↳ Identified {len(dependencies)} dependency reference files to copy.")
    
    for dep_file in dependencies:
        if not os.path.exists(dep_file):
            continue
        # Skip if already copied as editable asset
        if dep_file in associated_files:
            continue
        dest_file = os.path.join(sandbox_root, dep_file)
        os.makedirs(os.path.dirname(dest_file), exist_ok=True)
        shutil.copy2(dep_file, dest_file)
        print(f"     [READ-ONLY] {dep_file} ➔ {dest_file}")
        
    return sandbox_root

def integrate_sandbox(file_path, slug):
    sandbox_root = f".opencode/sandboxes/task-{slug}"
    if not os.path.exists(sandbox_root):
        print(f"❌ Sandbox not found at '{sandbox_root}'. Nothing to integrate.")
        sys.exit(1)
        
    print(f"🔄 Integrating sandbox '{sandbox_root}' back into primary codebase...")
    
    # Determine what files are the editable target assets (only integrate these back!)
    associated_files = get_associated_files(file_path)
    
    integrated_count = 0
    for rel_path in associated_files:
        sandbox_file = os.path.join(sandbox_root, rel_path)
        dest_file = os.path.join(os.getcwd(), rel_path)
        
        if os.path.exists(sandbox_file):
            os.makedirs(os.path.dirname(dest_file), exist_ok=True)
            shutil.copy2(sandbox_file, dest_file)
            print(f"     ✓ Integrated: {rel_path}")
            integrated_count += 1
        else:
            print(f"     ⚠️ Warning: Sandbox asset '{rel_path}' is missing.")
            
    # Clean up the sandbox directory
    print(f"🗑️ Cleaning up sandbox directory...")
    shutil.rmtree(sandbox_root)
    print(f"✨ Successfully integrated {integrated_count} files and cleaned up sandbox.")

def main():
    parser = argparse.ArgumentParser(description="Manage isolated sandboxes for refactoring tasks with dependency resolution.")
    parser.add_argument("--action", choices=["create", "integrate"], default="create", help="Action to perform (default: 'create')")
    parser.add_argument("--json", help="Path to a JSON file containing tasks.")
    parser.add_argument("--file", help="A single source file to target.")
    parser.add_argument("--issue", action="append", help="An issue to fix in the target file (can specify multiple times).")
    
    args, unknown = parser.parse_known_args()
    
    tasks_to_process = []
    
    if args.json:
        if not os.path.exists(args.json):
            print(f"❌ JSON task file not found at: '{args.json}'")
            sys.exit(1)
        with open(args.json, "r") as f:
            try:
                task_data = json.load(f)
                if isinstance(task_data, list):
                    tasks_to_process = task_data
                elif isinstance(task_data, dict) and "tasks" in task_data:
                    tasks_to_process = task_data["tasks"]
                else:
                    print("❌ JSON file structure invalid.")
                    sys.exit(1)
            except json.JSONDecodeError:
                print("❌ Failed to parse JSON task file.")
                sys.exit(1)
    elif args.file:
        tasks_to_process = [{
            "file": args.file,
            "issues": args.issue if args.issue else []
        }]
    else:
        # Fallback to positional arguments for backwards compatibility
        positional_files = unknown + ([sys.argv[1]] if len(sys.argv) > 1 and sys.argv[1] not in ["--json", "--file", "--issue", "--action"] and not sys.argv[1].startswith("-") else [])
        positional_files = list(set([f for f in positional_files if f and os.path.exists(f)]))
        for f in positional_files:
            tasks_to_process.append({
                "file": f,
                "issues": []
            })
            
    if not tasks_to_process:
        print("❌ No files or tasks specified.")
        sys.exit(1)
        
    print("=========================================================")
    print(f"      SANDBOXED TASK MANAGER - ACTION: {args.action.upper()}      ")
    print("=========================================================")
    
    for task_info in tasks_to_process:
        file_path = task_info.get("file")
        issues = task_info.get("issues", [])
        
        if not file_path:
            continue
            
        slug = slugify_path(file_path)
        print(f"\n📁 Target component: {file_path} (slug: {slug})")
        
        if args.action == "create":
            if not os.path.exists(file_path):
                print(f"❌ File not found: '{file_path}'")
                continue
            sandbox_path = create_sandbox(file_path, slug, issues)
            
            # Formulate clear instructions to display
            issue_list = ""
            for i, issue in enumerate(issues, 1):
                issue_list += f"  {i}. {issue}\\n"
            if not issue_list:
                issue_list = "  1. Perform general design system refactoring, accessibility, and quality compliance checks.\\n"
                
            prompt = f"Refactor `{file_path}` and its associated assets inside your workspace directory to resolve the following issues:\\n{issue_list}"
            
            print(f"\n🚀 To run the refactoring subagent for this file, execute the following task call:")
            print(f"\033[93m[tool_call: task with subagent_type='refactor' workdir='{sandbox_path}' prompt='{prompt}' description='Refactor {file_path}']\033[0m")
        elif args.action == "integrate":
            integrate_sandbox(file_path, slug)
            
    print("\n=========================================================")
    print("                     ACTION COMPLETE                     ")
    print("=========================================================")

if __name__ == "__main__":
    main()
