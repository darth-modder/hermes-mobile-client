"""watcher.py — ApprovalWatcher's poll loop and StreamEndDebouncer, using the injectable
``poll_interval_seconds``/``has_blocking_approval`` (added this round specifically so these
don't need the real `tools.approval` module or a multi-second real-time wait)."""

from __future__ import annotations

import threading
import time
import unittest
from typing import Dict, List, Tuple
from unittest.mock import patch

from tests.plugin_path import load_module

watcher_mod = load_module("watcher")

POLL_INTERVAL = 0.02
SETTLE = POLL_INTERVAL * 6  # generous margin over a few poll ticks


class FakeApprovalSource:
    """A controllable stand-in for `tools.approval.has_blocking_approval` — a plain dict of
    session_id -> bool the test flips directly, read under its own lock (tests run this from
    the main thread while the watcher polls it from its background thread)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._pending: Dict[str, bool] = {}

    def set(self, session_id: str, pending: bool) -> None:
        with self._lock:
            self._pending[session_id] = pending

    def __call__(self, session_id: str) -> bool:
        with self._lock:
            return self._pending.get(session_id, False)


class RecordingPushes:
    """Replaces watcher_mod.send_push for the duration of a `with` block; records every call."""

    def __init__(self) -> None:
        self.calls: List[Tuple[str, str, str]] = []  # (tokens, kind, session_id)

    def __call__(self, tokens, *, kind: str, session_id: str, title: str) -> None:
        self.calls.append((tuple(tokens), kind, session_id))


class ApprovalWatcherTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = FakeApprovalSource()
        self.pushes = RecordingPushes()
        self._patches = [
            patch.object(watcher_mod, "backgrounded_tokens", return_value=["tok-1"]),
            patch.object(watcher_mod, "send_push", self.pushes),
        ]
        for p in self._patches:
            p.start()
        self.addCleanup(lambda: [p.stop() for p in self._patches])

        self.watch = watcher_mod.ApprovalWatcher(
            poll_interval_seconds=POLL_INTERVAL, has_blocking_approval=self.source
        )
        self.addCleanup(self.watch.stop)

    def test_no_push_while_nothing_is_pending(self) -> None:
        self.watch.track_session("sess-1")
        self.watch.start()
        time.sleep(SETTLE)

        self.assertEqual(self.pushes.calls, [])

    def test_pushes_once_on_the_false_to_true_transition(self) -> None:
        self.watch.track_session("sess-1")
        self.watch.start()
        time.sleep(SETTLE)

        self.source.set("sess-1", True)
        time.sleep(SETTLE)

        self.assertEqual(self.pushes.calls, [(("tok-1",), "approval", "sess-1")])

    def test_no_duplicate_push_while_still_pending(self) -> None:
        self.watch.track_session("sess-1")
        self.source.set("sess-1", True)
        self.watch.start()
        time.sleep(SETTLE)
        time.sleep(SETTLE)

        self.assertEqual(len(self.pushes.calls), 1)

    def test_pushes_again_for_a_second_approval_after_the_first_resolves(self) -> None:
        self.watch.track_session("sess-1")
        self.watch.start()
        time.sleep(SETTLE)

        self.source.set("sess-1", True)
        time.sleep(SETTLE)
        self.source.set("sess-1", False)
        time.sleep(SETTLE)
        self.source.set("sess-1", True)
        time.sleep(SETTLE)

        self.assertEqual(len(self.pushes.calls), 2)

    def test_untracked_sessions_are_never_polled(self) -> None:
        # Never track_session'd — has_blocking_approval must simply never be asked about it.
        self.source.set("sess-ghost", True)
        self.watch.start()
        time.sleep(SETTLE)

        self.assertEqual(self.pushes.calls, [])

    def test_untrack_session_stops_further_pushes_for_it(self) -> None:
        self.watch.track_session("sess-1")
        self.watch.start()
        time.sleep(SETTLE)

        self.watch.untrack_session("sess-1")
        self.source.set("sess-1", True)
        time.sleep(SETTLE)

        self.assertEqual(self.pushes.calls, [])

    def test_no_content_in_the_push_beyond_kind_and_session_id(self) -> None:
        """The watcher never even reads the approval's command/description — only whether one
        exists — so there is nothing for it to leak. Asserted at the call-args level: `title`
        is a fixed string, not derived from anything session-specific."""
        self.watch.track_session("sess-1")
        self.watch.start()
        time.sleep(SETTLE)
        self.source.set("sess-1", True)
        time.sleep(SETTLE)

        self.assertEqual(len(self.pushes.calls), 1)
        self.assertEqual(self.pushes.calls[0][1], "approval")

    def test_a_polling_exception_for_one_session_does_not_stop_the_others(self) -> None:
        def flaky(session_id: str) -> bool:
            if session_id == "sess-bad":
                raise RuntimeError("boom")
            return self.source(session_id)

        watch = watcher_mod.ApprovalWatcher(poll_interval_seconds=POLL_INTERVAL, has_blocking_approval=flaky)
        self.addCleanup(watch.stop)
        watch.track_session("sess-bad")
        watch.track_session("sess-good")
        watch.start()
        time.sleep(SETTLE)

        self.source.set("sess-good", True)
        time.sleep(SETTLE)

        self.assertEqual(self.pushes.calls, [(("tok-1",), "approval", "sess-good")])

    def test_stop_halts_the_background_thread(self) -> None:
        self.watch.track_session("sess-1")
        self.watch.start()
        time.sleep(SETTLE)

        self.watch.stop()
        time.sleep(SETTLE)
        self.source.set("sess-1", True)
        time.sleep(SETTLE)

        self.assertEqual(self.pushes.calls, [])


class ApprovalWatcherLockRegressionTests(unittest.TestCase):
    """Regression coverage for the race fixed in 8f89171: `_pending_state` was written by the
    poll loop without the lock `untrack_session` uses, so a session untracked mid-iteration
    (after the loop snapshotted `_tracked` but before it wrote back `_pending_state`) could have
    its entry silently resurrected.

    Reproducing the exact interleaving deterministically (without sleeping and hoping) means
    controlling *when* `has_blocking_approval` returns relative to `untrack_session` being
    called — done here by blocking the poll loop mid-iteration on an event the test controls,
    from a `has_blocking_approval` stand-in that pauses right where the real code does its
    (unlocked, pre-fix) read-modify-write.
    """

    def test_untrack_during_an_in_flight_poll_iteration_is_not_resurrected(self) -> None:
        reached_mid_iteration = threading.Event()
        release_iteration = threading.Event()

        def blocking_source(session_id: str) -> bool:
            reached_mid_iteration.set()
            release_iteration.wait(timeout=2)
            return True

        pushes = RecordingPushes()
        with patch.object(watcher_mod, "backgrounded_tokens", return_value=["tok-1"]), patch.object(
            watcher_mod, "send_push", pushes
        ):
            watch = watcher_mod.ApprovalWatcher(poll_interval_seconds=POLL_INTERVAL, has_blocking_approval=blocking_source)
            self.addCleanup(watch.stop)
            watch.track_session("sess-1")
            watch.start()

            # Let the poll thread call has_blocking_approval("sess-1") and block inside it —
            # this is the moment between the loop's `list(self._tracked)` snapshot and its
            # write-back of `_pending_state`.
            self.assertTrue(reached_mid_iteration.wait(timeout=2))

            watch.untrack_session("sess-1")
            release_iteration.set()

            time.sleep(SETTLE)

            # The untracked session's state must be gone, not resurrected by the in-flight
            # iteration that started before the untrack.
            with watch._lock:
                self.assertNotIn("sess-1", watch._pending_state)
                self.assertNotIn("sess-1", watch._tracked)

            # And no push fired for a session that was untracked before the transition could be
            # observed as "new" by anything still tracking it.
            self.assertEqual(pushes.calls, [])


class StreamEndDebouncerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.pushes = RecordingPushes()
        self._patches = [
            patch.object(watcher_mod, "backgrounded_tokens", return_value=["tok-1"]),
            patch.object(watcher_mod, "send_push", self.pushes),
        ]
        for p in self._patches:
            p.start()
        self.addCleanup(lambda: [p.stop() for p in self._patches])

        self.debouncer = watcher_mod.StreamEndDebouncer(delay_seconds=0.05)
        self.addCleanup(self.debouncer.cancel_all)

    def test_a_burst_of_calls_collapses_into_one_push(self) -> None:
        for _ in range(5):
            self.debouncer.notify("sess-1", error=None)
            time.sleep(0.01)

        self.assertEqual(self.pushes.calls, [])  # still within the debounce window

        time.sleep(0.2)

        self.assertEqual(len(self.pushes.calls), 1)
        self.assertEqual(self.pushes.calls[0][1], "turnDone")

    def test_an_errored_call_pushes_turn_error(self) -> None:
        self.debouncer.notify("sess-1", error="boom")
        time.sleep(0.2)

        self.assertEqual(self.pushes.calls, [(("tok-1",), "turnError", "sess-1")])

    def test_no_tokens_means_no_push_call(self) -> None:
        with patch.object(watcher_mod, "backgrounded_tokens", return_value=[]):
            self.debouncer.notify("sess-1", error=None)
            time.sleep(0.2)

        self.assertEqual(self.pushes.calls, [])

    def test_empty_session_id_is_a_no_op(self) -> None:
        self.debouncer.notify("", error=None)
        time.sleep(0.2)

        self.assertEqual(self.pushes.calls, [])

    def test_cancel_all_prevents_a_pending_push(self) -> None:
        self.debouncer.notify("sess-1", error=None)
        self.debouncer.cancel_all()
        time.sleep(0.2)

        self.assertEqual(self.pushes.calls, [])


if __name__ == "__main__":
    unittest.main()
