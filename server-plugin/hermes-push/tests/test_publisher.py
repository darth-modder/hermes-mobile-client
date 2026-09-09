"""publisher.py — the payload shape sent to Expo's push API. This is the test that fails loudly
if a future edit adds a `body`/content field: the whole reason nothing sensitive reaches Expo's
servers is that this function structurally cannot carry more than `{ kind, session_id, title }`.
"""

from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from tests.plugin_path import load_module

publisher = load_module("publisher")


class _FakeResponse:
    def __init__(self, body: bytes = b"{}") -> None:
        self._body = body

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *exc_info: object) -> None:
        return None


class SendPushTests(unittest.TestCase):
    def test_empty_token_list_makes_no_request(self) -> None:
        with patch.object(publisher.urllib.request, "urlopen") as urlopen:
            publisher.send_push([], kind="approval", session_id="s1", title="Hi")

        urlopen.assert_not_called()

    def test_falsy_tokens_are_filtered_out_and_a_wholly_falsy_list_makes_no_request(self) -> None:
        with patch.object(publisher.urllib.request, "urlopen") as urlopen:
            publisher.send_push([None, "", False], kind="approval", session_id="s1", title="Hi")

        urlopen.assert_not_called()

    def test_request_goes_to_the_expo_push_endpoint(self) -> None:
        with patch.object(publisher.urllib.request, "urlopen", return_value=_FakeResponse()) as urlopen:
            publisher.send_push(["tok-1"], kind="approval", session_id="s1", title="Hi")

        request = urlopen.call_args[0][0]
        self.assertEqual(request.full_url, publisher.EXPO_PUSH_URL)

    def test_payload_is_exactly_kind_session_id_title_per_message(self) -> None:
        """The invariant: no `body`, no approval command/description, no reply text — ever."""
        with patch.object(publisher.urllib.request, "urlopen", return_value=_FakeResponse()) as urlopen:
            publisher.send_push(
                ["tok-1", "tok-2"], kind="turnDone", session_id="sess-42", title="Hermes finished"
            )

        request = urlopen.call_args[0][0]
        messages = json.loads(request.data.decode("utf-8"))

        self.assertEqual(len(messages), 2)
        for message, token in zip(messages, ["tok-1", "tok-2"]):
            self.assertEqual(message["to"], token)
            self.assertEqual(message["title"], "Hermes finished")
            self.assertEqual(message["data"], {"kind": "turnDone", "session_id": "sess-42"})
            self.assertNotIn("body", message)
            # Structural guarantee, not just "this test didn't add one": the message has no
            # field this function could have used to carry free-text content.
            self.assertEqual(set(message.keys()), {"to", "title", "data", "priority"})

    def test_a_url_error_is_swallowed_not_raised(self) -> None:
        import urllib.error

        with patch.object(publisher.urllib.request, "urlopen", side_effect=urllib.error.URLError("down")):
            try:
                publisher.send_push(["tok-1"], kind="approval", session_id="s1", title="Hi")
            except urllib.error.URLError:
                self.fail("send_push must not propagate a delivery failure")

    def test_an_unexpected_exception_is_also_swallowed(self) -> None:
        with patch.object(publisher.urllib.request, "urlopen", side_effect=RuntimeError("boom")):
            try:
                publisher.send_push(["tok-1"], kind="approval", session_id="s1", title="Hi")
            except RuntimeError:
                self.fail("send_push must not propagate an unexpected failure")


if __name__ == "__main__":
    unittest.main()
