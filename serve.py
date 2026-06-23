#!/usr/bin/env python3
"""Tiny static file server for local preview of the Machina Collective site.

Run from this folder:  python3 serve.py
Then open:             http://127.0.0.1:8753

Serves the directory this script lives in (so it works regardless of the
current working directory). Ctrl+C to stop.
"""
import http.server
import os

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", 8753))


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static handler with single-page-app fallback.

    Clean URLs like /artists/olgabaranova have no file on disk; for any path
    that isn't a real file/asset we serve index.html (HTTP 200), mirroring the
    Netlify _redirects rule so local preview behaves like production.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def send_head(self):
        # digital cards live at /card and /card/<name> (mirrors the Netlify redirect)
        _p = self.path.split("?")[0].rstrip("/")
        if _p == "/card" or _p.startswith("/card/"):
            self.path = "/card.html"
        path = self.translate_path(self.path)
        # a missing path with no file extension is an app route → serve the shell
        if not os.path.exists(path) and "." not in os.path.basename(path):
            self.path = "/index.html"
        return super().send_head()


# Threading server so one in-flight large file (a film) doesn't block every
# other request — a plain single-threaded server can only send one file at a time.
class Server(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    # bind all interfaces so phones/other devices on the same Wi-Fi can reach it
    with Server(("0.0.0.0", PORT), Handler) as httpd:
        print("Machina Collective — serving %s" % DIRECTORY)
        print("On this Mac:   http://127.0.0.1:%d" % PORT)
        print("On your phone (same Wi-Fi): http://<your-LAN-IP>:%d  (Ctrl+C to stop)" % PORT)
        httpd.serve_forever()
