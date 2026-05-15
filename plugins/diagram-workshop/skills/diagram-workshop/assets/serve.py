#!/usr/bin/env python3
"""
diagram-workshop dev server
Serves the current directory, injects /annotate.js, opens the browser.

Usage:
    python serve.py [diagram.html] [port]

Examples:
    python ~/.claude/skills/diagram-workshop/assets/serve.py diagram.html
    python ~/.claude/skills/diagram-workshop/assets/serve.py diagram.html 8080
"""
import http.server
import subprocess
import sys
from pathlib import Path

# Parse args: any .html arg is the file to open; any int arg is the port
html_file = next((a for a in sys.argv[1:] if a.endswith(".html")), None)
port_args  = [a for a in sys.argv[1:] if a.isdigit()]
PORT = int(port_args[0]) if port_args else 8000

ANNOTATE_JS = (Path(__file__).parent / "annotate.js").read_bytes()


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0] == "/annotate.js":
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(ANNOTATE_JS)))
            self.end_headers()
            self.wfile.write(ANNOTATE_JS)
        else:
            super().do_GET()

    def log_message(self, fmt, *args):
        pass  # suppress per-file noise


def open_browser(url):
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", url])
        elif sys.platform.startswith("linux"):
            subprocess.Popen(["xdg-open", url])
        elif sys.platform == "win32":
            subprocess.Popen(["start", url], shell=True)
    except Exception:
        pass  # best-effort


if __name__ == "__main__":
    url = f"http://localhost:{PORT}/{html_file or ''}"
    print(url)
    open_browser(url)
    with http.server.HTTPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()
