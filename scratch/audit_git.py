import subprocess
import json

def run_git(args):
    try:
        res = subprocess.run(["git"] + args, capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except Exception as e:
        return f"Error: {e}"

print("=== GIT BRANCH ===")
print(run_git(["branch", "--show-current"]))

print("\n=== CURRENT COMMIT ===")
print(run_git(["log", "-1", "--format=%H %s (%cr)"]))

print("\n=== UNCOMMITTED CHANGES (STATUS) ===")
print(run_git(["status", "--porcelain"]))

print("\n=== RECENT COMMITS (LAST 10) ===")
print(run_git(["log", "-10", "--oneline"]))

print("\n=== DIFF OF UNCOMMITTED CHANGES ===")
print(run_git(["diff"]))
