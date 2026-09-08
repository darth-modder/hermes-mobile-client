"""hermes-push dashboard plugin backend, mounted at ``/api/plugins/hermes-push/`` (behind the
normal dashboard auth gate — see ``hermes_cli/web_server_dashboard.py``'s
``_mount_plugin_api_routes``, the same mechanism every other dashboard plugin's ``api.py``
uses).

``POST /devices``   — register or upsert an Expo push token (idempotent: id = sha256(token)).
``DELETE /devices/{id}`` — unregister a device.
``POST /devices/{id}/presence`` — ``{ foreground: bool }``. The only thing that gates push
  delivery (registry.backgrounded_tokens) — never socket/connection state (D10).
``GET /devices`` — list registered devices, tokens redacted. Install-doc smoke test target.

This file is imported by the web server via ``importlib.util.spec_from_file_location`` as a
standalone module (see ``_mount_plugin_api_routes``), not as part of the ``hermes-push``
package the hook side (``__init__.py``) belongs to — a plain ``from . import registry`` would
fail here. It loads ``registry.py`` from the plugin root the same way, by file path, so both
halves of the plugin share one storage implementation instead of two copies drifting apart.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent


def _load_sibling(name: str):
    module_name = f"hermes_push_dashboard_{name}"
    if module_name in sys.modules:
        return sys.modules[module_name]
    spec = importlib.util.spec_from_file_location(module_name, _PLUGIN_ROOT / f"{name}.py")
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load hermes-push sibling module {name!r}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


registry = _load_sibling("registry")

router = APIRouter()


class RegisterDeviceBody(BaseModel):
    token: str
    platform: str
    label: str | None = None


class PresenceBody(BaseModel):
    foreground: bool


def _redact(device: dict) -> dict:
    return {key: value for key, value in device.items() if key != "token"}


@router.get("/devices")
async def list_devices():
    return {"devices": [_redact(d) for d in registry.list_devices()]}


@router.post("/devices")
async def register_device(body: RegisterDeviceBody):
    token = body.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="token is required")
    if not body.platform.strip():
        raise HTTPException(status_code=400, detail="platform is required")
    device = registry.upsert_device(token, body.platform.strip(), body.label)
    return {"ok": True, "device": _redact(device)}


@router.delete("/devices/{device_id}")
async def remove_device(device_id: str):
    if not registry.remove_device(device_id):
        raise HTTPException(status_code=404, detail="device not found")
    return {"ok": True}


@router.post("/devices/{device_id}/presence")
async def update_presence(device_id: str, body: PresenceBody):
    device = registry.set_presence(device_id, body.foreground)
    if device is None:
        raise HTTPException(status_code=404, detail="device not found")
    return {"ok": True, "device": _redact(device)}
