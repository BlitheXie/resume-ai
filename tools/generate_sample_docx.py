#!/usr/bin/env python3
"""Regenerate downloads/*.docx by driving the real in-page exporter.

The static samples must stay identical to what a visitor gets from the
"Download Word" button, so this script deliberately does NOT reimplement the
exporter: it serves the site locally, opens every template in a headless
browser and saves the file the page itself produces. That keeps a single
styling implementation (docx-export.js) instead of two that drift apart.

Requirements (development only; the site itself has no dependencies):

    pip install playwright
    playwright install chromium

Usage:

    python3 tools/generate_sample_docx.py
    python3 tools/generate_sample_docx.py --url http://localhost:8000
"""

import argparse
import functools
import http.server
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = ROOT / "downloads"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # keep the console readable
        pass


def start_server():
    """Serve the repository root on an ephemeral port."""
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, "http://127.0.0.1:%d" % httpd.server_address[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="use an already running server instead of starting one")
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("playwright is required: pip install playwright && playwright install chromium")

    templates = sorted(p.stem for p in (ROOT / "templates").glob("*.html"))
    if not templates:
        sys.exit("no templates found under %s" % (ROOT / "templates"))

    DOWNLOAD_DIR.mkdir(exist_ok=True)
    httpd = None
    base = args.url
    if not base:
        httpd, base = start_server()

    failures = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            context = browser.new_context(accept_downloads=True)
            page = context.new_page()
            page_errors = []
            page.on("pageerror", lambda error: page_errors.append(str(error)))

            print("exporting %d templates from %s" % (len(templates), base))
            for name in templates:
                page.goto("%s/templates/%s.html" % (base, name), wait_until="networkidle")
                if not page.evaluate("() => !!(window.ResumeDocx && window.ResumeDocx.exportDocument)"):
                    failures.append((name, "docx-export.js did not load"))
                    print("  FAIL  %-22s docx-export.js did not load" % name)
                    continue
                try:
                    with page.expect_download(timeout=20000) as pending:
                        page.click(".re-fab-docx")
                    destination = DOWNLOAD_DIR / ("%s.docx" % name)
                    pending.value.save_as(str(destination))
                    print("  ok    %-22s %7d bytes" % (name, destination.stat().st_size))
                except Exception as exc:  # noqa: BLE001 - report and continue
                    failures.append((name, str(exc)[:120]))
                    print("  FAIL  %-22s %s" % (name, str(exc)[:70]))

            browser.close()
            if page_errors:
                print("\npage errors: %s" % page_errors[:3])
    finally:
        if httpd:
            httpd.shutdown()
            httpd.server_close()

    print("\n%d/%d exported into %s" % (len(templates) - len(failures), len(templates), DOWNLOAD_DIR))
    for name, reason in failures:
        print("  %s: %s" % (name, reason))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
