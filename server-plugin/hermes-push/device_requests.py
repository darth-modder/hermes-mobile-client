"""Pure request-validation and response-redaction helpers for the ``/devices`` routes
(``dashboard/api.py``).

Split out into their own module — stdlib only, no ``fastapi``/``pydantic`` import — for one
reason: ``dashboard/api.py`` needs those two packages just to be imported at all (its
``RegisterDeviceBody``/``PresenceBody`` request models), but this repo has no Python test
infrastructure and no reason to add a web-framework dependency just to unit test input
validation and token redaction. Keeping the actual decision logic here, framework-free, means
``tests/test_device_requests.py`` can exercise it directly. ``dashboard/api.py`` is thin
plumbing around this — parse the request, call these, translate the result into an HTTP
response — verified live in the M11 round's own throwaway-server pass rather than by a unit
test, the same tradeoff this project already makes for other framework-wiring code
(``useNotifications.ts``, ``attachments.ts``).
"""

from __future__ import annotations

from typing import Any, Dict, Tuple


class InvalidDeviceRequest(ValueError):
    """A 400-worthy request body. The route layer catches this and raises HTTPException."""


def validate_register_device(token: str, platform: str) -> Tuple[str, str]:
    """Trims and validates a device-registration request. Raises ``InvalidDeviceRequest`` with
    the exact message the route turns into a 400 detail string."""
    trimmed_token = (token or "").strip()
    if not trimmed_token:
        raise InvalidDeviceRequest("token is required")

    trimmed_platform = (platform or "").strip()
    if not trimmed_platform:
        raise InvalidDeviceRequest("platform is required")

    return trimmed_token, trimmed_platform


def redact_device(device: Dict[str, Any]) -> Dict[str, Any]:
    """A device row with its push token removed — the shape every /devices response returns."""
    return {key: value for key, value in device.items() if key != "token"}
