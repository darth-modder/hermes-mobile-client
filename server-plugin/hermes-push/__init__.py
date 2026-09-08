"""hermes-push: Expo push notifications for backgrounded Hermes Android/iOS clients.

Every push body is ``{ kind, session_id, title }`` — never message, approval, or reply
content (publisher.py). Push only ever reaches a device whose last reported presence is
"background" (registry.py) — never inferred from socket/connection state (D10 in the
hermes-android decision log: a backgrounded app can hold a live socket for well past a
minute).

Two triggers, both explained in full in watcher.py:
  - ``on_stream_end``, debounced per session, for "a turn finished" / "a turn errored".
  - a background poll on ``has_blocking_approval``, tracked via ``on_session_start`` /
    ``on_session_end``, for "an approval is now pending" — the actual mechanism for
    gateway/mobile sessions, because ``pre_approval_request`` never fires for that path.

``pre_approval_request`` is also registered below, correct and harmless for CLI-interactive
use; see watcher.py's module docstring before assuming it covers the mobile case too.
"""

from __future__ import annotations

from typing import Any, Optional

from .publisher import send_push
from .registry import backgrounded_tokens
from .watcher import stream_end_debouncer, watcher


def _on_session_start(session_id: str = "", **_kwargs: Any) -> None:
    watcher.track_session(session_id)


def _on_session_end(session_id: str = "", **_kwargs: Any) -> None:
    watcher.untrack_session(session_id)


def _on_stream_end(
    session_id: str = "", finished: bool = True, error: Optional[str] = None, **_kwargs: Any
) -> None:
    if not finished:
        return
    stream_end_debouncer.notify(session_id, error=error)


def _on_pre_approval_request(session_key: str = "", **_kwargs: Any) -> None:
    # CLI-interactive only (surface="cli") — the gateway/mobile mechanism is the poll watcher
    # above. See watcher.py's module docstring for the exact upstream code path that makes
    # this hook a no-op for `source: "android"` sessions.
    if not session_key:
        return
    tokens = backgrounded_tokens()
    if tokens:
        send_push(tokens, kind="approval", session_id=session_key, title="Hermes needs your approval")


def register(ctx) -> None:
    ctx.register_hook("on_session_start", _on_session_start)
    ctx.register_hook("on_session_end", _on_session_end)
    ctx.register_hook("on_stream_end", _on_stream_end)
    ctx.register_hook("pre_approval_request", _on_pre_approval_request)
    watcher.start()
