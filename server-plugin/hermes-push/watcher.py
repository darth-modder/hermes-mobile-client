"""Per-session state that turns two plugin hooks into push notifications.

**Why a poll loop exists at all — read this before touching the approval half.**

M11's own design note says a plugin can observe ``pre_approval_request`` for backgrounded
approvals. That is true for the CLI, and false for the gateway/mobile path this plugin
actually exists for. In upstream ``tools/approval.py`` (``request_approval``, roughly
lines 700-761), the gateway branch (``is_gateway or is_ask``) resolves through
``_await_gateway_decision`` (a live ``notify_cb``) or ``_pending_result`` (none) and returns
in both cases *before* reaching:

    hook_kwargs = dict(..., surface="cli")
    approval_context._fire_approval_hook("pre_approval_request", **hook_kwargs)

which sits further down, reachable only by the CLI-interactive fallthrough. So for a session
created with ``source: "android"`` — every session this plugin cares about — the hook never
fires. hermes-agent is read-only (AGENTS.md); no upstream edit is on the table to add a
gateway-side call site.

What gateway sessions *do* have is the same read-only accessor
``tui_gateway/server.py`` itself uses to answer ``session.resume``'s ``pending_approval``
field: ``tools.approval.has_blocking_approval(session_key)``. ``ApprovalWatcher`` polls that
for every session this process has seen start (tracked via the ``on_session_start`` /
``on_session_end`` hooks, which do fire for every surface — agent/conversation_loop.py) and
pushes once on the false -> true transition, i.e. once per newly-pending approval. It never
reads the approval's command or description — only its existence — so there is no content to
accidentally leak into a push body.

``pre_approval_request`` is still registered in ``__init__.py`` for CLI-interactive parity
(harmless, and correct there); it is simply not the mechanism that makes Android work.

**Why finished-turn pushes are debounced, not sent straight from `on_stream_end`.**

``on_stream_end`` (agent/stream_delivery.py's ``_emit_stream_end``, wired through
``_with_stream_emitters`` in agent/chat_completion_helpers.py) brackets *one model API call*,
not one whole agent turn — a turn that makes five tool calls fires it five times. Sending a
push per call would spam a multi-step turn. ``StreamEndDebouncer`` instead restarts a short
timer on every call for a session and only sends once the calls go quiet — a reasonable proxy
for "the turn is actually done" given no upstream hook marks a turn's true end, and this is a
task-list implementation detail, not one of M11's four exit criteria.
"""

from __future__ import annotations

import logging
import threading
from typing import Dict, Optional, Set

from .publisher import send_push
from .registry import backgrounded_tokens

logger = logging.getLogger("hermes_push")

APPROVAL_POLL_INTERVAL_SECONDS = 2.0
STREAM_END_DEBOUNCE_SECONDS = 6.0


class ApprovalWatcher:
    """Polls ``has_blocking_approval`` for tracked sessions; pushes on each new pending
    approval. See the module docstring for why this exists instead of a hook."""

    def __init__(self) -> None:
        self._tracked: Set[str] = set()
        self._pending_state: Dict[str, bool] = {}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def track_session(self, session_id: str) -> None:
        if not session_id:
            return
        with self._lock:
            self._tracked.add(session_id)

    def untrack_session(self, session_id: str) -> None:
        with self._lock:
            self._tracked.discard(session_id)
            self._pending_state.pop(session_id, None)

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="hermes-push-approval-watch", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _run(self) -> None:
        # Imported lazily so importing this module (e.g. from a unit test) never requires the
        # full hermes-agent runtime to be importable.
        from tools.approval import has_blocking_approval

        while not self._stop.wait(APPROVAL_POLL_INTERVAL_SECONDS):
            with self._lock:
                session_ids = list(self._tracked)

            for session_id in session_ids:
                try:
                    pending = has_blocking_approval(session_id)
                except Exception:
                    logger.debug("hermes-push: has_blocking_approval failed for %s", session_id, exc_info=True)
                    continue

                with self._lock:
                    # A session untracked between the snapshot above and here must not have its
                    # entry resurrected by this iteration (untrack_session pops it under the
                    # same lock) — re-check membership rather than blindly writing back.
                    if session_id not in self._tracked:
                        continue

                    was_pending = self._pending_state.get(session_id, False)
                    self._pending_state[session_id] = pending

                if pending and not was_pending:
                    self._notify_approval(session_id)

    @staticmethod
    def _notify_approval(session_id: str) -> None:
        tokens = backgrounded_tokens()
        if tokens:
            send_push(tokens, kind="approval", session_id=session_id, title="Hermes needs your approval")


class StreamEndDebouncer:
    """Collapses a burst of same-session ``on_stream_end`` calls (one per model API call in a
    multi-step turn) into a single push, sent after the calls go quiet. See the module
    docstring for why."""

    def __init__(self, delay_seconds: float = STREAM_END_DEBOUNCE_SECONDS) -> None:
        self._delay = delay_seconds
        self._timers: Dict[str, threading.Timer] = {}
        self._lock = threading.Lock()

    def notify(self, session_id: str, *, error: Optional[str]) -> None:
        if not session_id:
            return

        with self._lock:
            existing = self._timers.pop(session_id, None)
            if existing is not None:
                existing.cancel()

            timer = threading.Timer(self._delay, self._fire, args=(session_id, error))
            timer.daemon = True
            self._timers[session_id] = timer
            timer.start()

    def _fire(self, session_id: str, error: Optional[str]) -> None:
        with self._lock:
            self._timers.pop(session_id, None)

        tokens = backgrounded_tokens()
        if not tokens:
            return

        kind = "turnError" if error else "turnDone"
        title = "Hermes hit an error" if error else "Hermes finished"
        send_push(tokens, kind=kind, session_id=session_id, title=title)

    def cancel_all(self) -> None:
        with self._lock:
            timers, self._timers = self._timers, {}
        for timer in timers.values():
            timer.cancel()


watcher = ApprovalWatcher()
stream_end_debouncer = StreamEndDebouncer()
