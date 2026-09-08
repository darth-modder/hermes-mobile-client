"""Publishes to Expo's push API.

The request body is always ``{ kind, session_id, title }`` — never a `body` field, never the
approval command/description or reply text. That is a hard constraint from M11's design, not
an oversight: Expo's servers are a third party, and approval/session content must never reach
them. Callers in this plugin never even read that content into memory for this purpose (see
watcher.py and __init__.py — they check *whether* something is pending, not what it says).

``urllib.request`` (stdlib), matching hermes_cli/web_routers/audio.py's own convention for
outbound HTTP to a third-party API, so this plugin adds no new pip dependency.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Iterable

logger = logging.getLogger("hermes_push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
REQUEST_TIMEOUT_SECONDS = 10


def send_push(tokens: Iterable[str], *, kind: str, session_id: str, title: str) -> None:
    to = [t for t in tokens if t]
    if not to:
        return

    messages = [
        {"to": token, "title": title, "data": {"kind": kind, "session_id": session_id}, "priority": "high"}
        for token in to
    ]

    request = urllib.request.Request(
        EXPO_PUSH_URL,
        data=json.dumps(messages).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            response.read()
    except urllib.error.URLError as exc:
        logger.warning("hermes-push: Expo push send failed: %s", exc)
    except Exception:
        logger.exception("hermes-push: Expo push send failed")
