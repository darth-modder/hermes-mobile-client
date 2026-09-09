"""Device registry for the hermes-push plugin.

Stored at ``<hermes home>/hermes-push/devices.json`` — a single JSON object keyed by device
id. ``id`` is derived deterministically from the push token (``sha256(token)[:16]``) so
``POST /devices`` is naturally idempotent: registering the same Expo token on every login and
on every rotation upserts one row instead of accumulating duplicates, and the client never has
to durably remember a server-issued id.

Every write goes through a single process-wide lock plus a write-to-temp-then-rename, so a
crash mid-write can never leave ``devices.json`` truncated or half-written.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

_lock = threading.Lock()

# Set by tests (directly, e.g. `registry._registry_dir_override = tmp_path`) to redirect
# storage under a temp directory instead of the real Hermes home — `hermes_constants` is a
# hermes-agent module this repo's plain-Python test environment doesn't have installed, and
# nothing about this module's own logic needs the real one to be tested.
_registry_dir_override: Optional[Path] = None


def _registry_dir() -> Path:
    if _registry_dir_override is not None:
        return _registry_dir_override

    from hermes_constants import get_hermes_home

    return get_hermes_home() / "hermes-push"


def _registry_path() -> Path:
    return _registry_dir() / "devices.json"


def device_id_for_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]


def _read() -> Dict[str, Any]:
    path = _registry_path()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"devices": {}}
    if not isinstance(data, dict) or not isinstance(data.get("devices"), dict):
        return {"devices": {}}
    return data


def _write(data: Dict[str, Any]) -> None:
    path = _registry_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(path)


def upsert_device(token: str, platform: str, label: Optional[str]) -> Dict[str, Any]:
    """Register or update a device by its push token. Presence defaults to ``"foreground"``
    on first registration — a device that never reports otherwise is never pushed to
    (registry.backgrounded_tokens), the conservative default matching "no push while
    foregrounded" (D10: gate on reported presence, never on socket/connection state)."""
    device_id = device_id_for_token(token)
    with _lock:
        data = _read()
        devices = data["devices"]
        existing = devices.get(device_id, {})
        devices[device_id] = {
            "id": device_id,
            "token": token,
            "platform": platform,
            "label": label if label else existing.get("label", ""),
            "presence": existing.get("presence", "foreground"),
            "registered_at": existing.get("registered_at") or time.time(),
            "updated_at": time.time(),
        }
        _write(data)
        return dict(devices[device_id])


def remove_device(device_id: str) -> bool:
    with _lock:
        data = _read()
        devices = data["devices"]
        if device_id not in devices:
            return False
        del devices[device_id]
        _write(data)
        return True


def set_presence(device_id: str, foreground: bool) -> Optional[Dict[str, Any]]:
    with _lock:
        data = _read()
        devices = data["devices"]
        device = devices.get(device_id)
        if device is None:
            return None
        device["presence"] = "foreground" if foreground else "background"
        device["updated_at"] = time.time()
        _write(data)
        return dict(device)


def list_devices() -> List[Dict[str, Any]]:
    with _lock:
        return [dict(d) for d in _read()["devices"].values()]


def backgrounded_tokens() -> List[str]:
    """Push tokens for devices whose last reported presence is ``"background"`` — the only
    devices push ever goes to. Never derived from socket/connection liveness (D10: a
    backgrounded app can hold an open socket for well past a minute; only an explicit
    presence report means the app isn't on screen)."""
    with _lock:
        return [
            d["token"]
            for d in _read()["devices"].values()
            if d.get("presence") == "background" and d.get("token")
        ]
