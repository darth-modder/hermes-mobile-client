"""device_requests.py — the pure validation/redaction logic dashboard/api.py's /devices routes
are thin wrappers around (see that module's docstring for why the split exists: fastapi/pydantic
aren't installed in this repo's plain-Python test environment, and don't need to be for this
part)."""

from __future__ import annotations

import unittest

from tests.plugin_path import load_module

device_requests = load_module("device_requests")


class ValidateRegisterDeviceTests(unittest.TestCase):
    def test_valid_input_is_trimmed_and_returned(self) -> None:
        token, platform = device_requests.validate_register_device("  tok-1  ", " android ")

        self.assertEqual(token, "tok-1")
        self.assertEqual(platform, "android")

    def test_empty_token_raises(self) -> None:
        with self.assertRaises(device_requests.InvalidDeviceRequest) as ctx:
            device_requests.validate_register_device("", "android")

        self.assertEqual(str(ctx.exception), "token is required")

    def test_whitespace_only_token_raises(self) -> None:
        with self.assertRaises(device_requests.InvalidDeviceRequest):
            device_requests.validate_register_device("   ", "android")

    def test_none_token_raises(self) -> None:
        with self.assertRaises(device_requests.InvalidDeviceRequest):
            device_requests.validate_register_device(None, "android")

    def test_empty_platform_raises(self) -> None:
        with self.assertRaises(device_requests.InvalidDeviceRequest) as ctx:
            device_requests.validate_register_device("tok-1", "")

        self.assertEqual(str(ctx.exception), "platform is required")

    def test_token_checked_before_platform(self) -> None:
        # Both invalid: the token error should surface first (matches the route's own
        # token-then-platform check order before this refactor).
        with self.assertRaises(device_requests.InvalidDeviceRequest) as ctx:
            device_requests.validate_register_device("", "")

        self.assertEqual(str(ctx.exception), "token is required")


class RedactDeviceTests(unittest.TestCase):
    def test_token_is_removed(self) -> None:
        redacted = device_requests.redact_device({"id": "d1", "token": "secret", "platform": "android"})

        self.assertNotIn("token", redacted)

    def test_every_other_field_survives(self) -> None:
        device = {"id": "d1", "token": "secret", "platform": "android", "presence": "background"}
        redacted = device_requests.redact_device(device)

        self.assertEqual(redacted, {"id": "d1", "platform": "android", "presence": "background"})

    def test_a_device_with_no_token_field_is_unaffected(self) -> None:
        redacted = device_requests.redact_device({"id": "d1"})

        self.assertEqual(redacted, {"id": "d1"})

    def test_does_not_mutate_the_input(self) -> None:
        device = {"id": "d1", "token": "secret"}
        device_requests.redact_device(device)

        self.assertIn("token", device)


if __name__ == "__main__":
    unittest.main()
