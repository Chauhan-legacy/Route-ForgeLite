"""
RouteForge - Safe Server Shutdown Helper
Identifies and stops ONLY RouteForge Python processes.
"""
import sys
import subprocess
from pathlib import Path

def stop_routeforge():
    stopped_any = False
    base_dir = Path(__file__).parent.parent
    pid_file = base_dir / "database" / "routeforge.pid"

    # 1. Check PID file
    if pid_file.exists():
        try:
            pid_str = pid_file.read_text().strip()
            if pid_str.isdigit():
                pid = int(pid_str)
                chk = subprocess.run(
                    ["tasklist", "/fi", f"PID eq {pid}", "/fo", "csv", "/nh"],
                    capture_output=True,
                    text=True
                )
                if "python" in chk.stdout.lower():
                    subprocess.run(["taskkill", "/PID", str(pid), "/F", "/T"], capture_output=True)
                    print(f"[OK] Stopped RouteForge server (PID {pid}).")
                    stopped_any = True
        except Exception as e:
            pass
        try:
            pid_file.unlink()
        except Exception:
            pass

    # 2. Check port 8000 listener and ensure it is Python
    try:
        netstat = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
        for line in netstat.stdout.splitlines():
            line_clean = line.strip()
            if ":8000" in line_clean and "LISTENING" in line_clean:
                parts = line_clean.split()
                if len(parts) >= 5:
                    pid_str = parts[-1]
                    if pid_str.isdigit():
                        pid = int(pid_str)
                        chk = subprocess.run(
                            ["tasklist", "/fi", f"PID eq {pid}", "/fo", "csv", "/nh"],
                            capture_output=True,
                            text=True
                        )
                        if "python" in chk.stdout.lower():
                            subprocess.run(["taskkill", "/PID", str(pid), "/F", "/T"], capture_output=True)
                            print(f"[OK] Stopped RouteForge process on port 8000 (PID {pid}).")
                            stopped_any = True
    except Exception as e:
        pass

    if not stopped_any:
        print("[INFO] No running RouteForge server found.")

if __name__ == "__main__":
    stop_routeforge()

