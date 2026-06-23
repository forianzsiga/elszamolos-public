import sys
import re
import subprocess
import os

def strip_code(code):
    # This strips block comments and line comments, then all whitespace
    # It handles basic cases well enough to verify that the agent ONLY added comments.
    
    # Strip block comments
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
    # Strip line comments
    code = re.sub(r'//.*', '', code)
    # Strip all whitespace
    code = re.sub(r'\s+', '', code)
    return code

def verify(file_path):
    if not os.path.exists(file_path):
        print(f"FAIL: {file_path} deleted!")
        return False
        
    try:
        original = subprocess.check_output(['git', 'show', f'HEAD:{file_path}'], text=True, encoding='utf-8', stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        print(f"PASS (New file): {file_path}")
        return True
        
    with open(file_path, 'r', encoding='utf-8') as f:
        modified = f.read()
        
    orig_stripped = strip_code(original)
    mod_stripped = strip_code(modified)
    
    if orig_stripped == mod_stripped:
        print(f"PASS: {file_path}")
        return True
    else:
        print(f"FAIL: {file_path} contains non-comment changes!")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python verify_comments_only.py <filepath>")
        sys.exit(1)
        
    success = True
    for file_path in sys.argv[1:]:
        file_path = file_path.replace('\\', '/')
        if not verify(file_path):
            success = False
            
    sys.exit(0 if success else 1)
