"""M15 r12 wire trace: logging forward proxy in front of the throwaway gateway.

Listens on 9142, forwards to 127.0.0.1:9128, and appends every non-GET request
(method, path, headers minus Authorization, body) to a trace file. `adb reverse
tcp:9128 tcp:9142` points the device's 127.0.0.1:9128 here, so the app's stored
connection URL never changes.
"""
import http.server
import sys
import urllib.error
import urllib.request

UPSTREAM = "http://127.0.0.1:9128"
TRACE = sys.argv[1]
HOP = {"host", "content-length", "connection", "accept-encoding"}


def _log(text):
    with open(TRACE, "a", encoding="utf-8") as fh:
        fh.write(text + "\n")
    print(text, flush=True)


class Proxy(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _forward(self, method):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None

        if method != "GET":
            _log(f"\n--- {method} {self.path}")
            for k, v in self.headers.items():
                if k.lower() == "authorization":
                    v = v.split(" ")[0] + " <ELIDED>"
                if k.lower() not in ("host", "connection"):
                    _log(f"{k}: {v}")
            if body:
                _log("body: " + body.decode("utf-8", "replace"))

        req = urllib.request.Request(
            UPSTREAM + self.path, data=body, method=method,
            headers={k: v for k, v in self.headers.items() if k.lower() not in HOP})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload, status, headers = resp.read(), resp.status, resp.headers
        except urllib.error.HTTPError as err:
            payload, status, headers = err.read(), err.code, err.headers
        except Exception as err:  # upstream down
            _log(f"proxy error: {err}")
            self.send_error(502, str(err))
            return

        if method != "GET":
            _log(f"<-- {status} {payload[:900].decode('utf-8', 'replace')}")

        self.send_response(status)
        for k, v in headers.items():
            if k.lower() not in ("transfer-encoding", "content-length", "connection"):
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        self._forward("GET")

    def do_POST(self):
        self._forward("POST")

    def do_PUT(self):
        self._forward("PUT")

    def do_DELETE(self):
        self._forward("DELETE")

    def log_message(self, *args):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", 9142), Proxy).serve_forever()
