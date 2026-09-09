"""registry.py — device storage and, most importantly, `backgrounded_tokens()`: the entire
push-delivery gate. A device this function wrongly includes gets pushed to while the user is
looking at their phone; a device it wrongly excludes never gets an approval push at all. This
is the highest-value test in the suite per the M11 verification note.
"""

from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from tests.plugin_path import load_module

registry = load_module("registry")


class RegistryTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp_dir = Path(tempfile.mkdtemp(prefix="hermes-push-test-"))
        registry._registry_dir_override = self._tmp_dir

    def tearDown(self) -> None:
        registry._registry_dir_override = None
        shutil.rmtree(self._tmp_dir, ignore_errors=True)


class BackgroundedTokensTests(RegistryTestCase):
    """The push-delivery gate. Every case here is one M11 cares about by name."""

    def test_no_devices_yields_no_tokens(self) -> None:
        self.assertEqual(registry.backgrounded_tokens(), [])

    def test_freshly_registered_device_is_excluded_until_it_reports_background(self) -> None:
        # upsert_device alone (no presence report yet) must never yield a token — this is the
        # "no push while foregrounded" exit criterion's actual mechanism: a device defaults to
        # not-pushable, not the other way around.
        registry.upsert_device("tok-fresh", "android", "phone")

        self.assertEqual(registry.backgrounded_tokens(), [])

    def test_foreground_device_yields_no_token(self) -> None:
        device = registry.upsert_device("tok-fg", "android", "phone")
        registry.set_presence(device["id"], foreground=True)

        self.assertEqual(registry.backgrounded_tokens(), [])

    def test_background_device_yields_its_token(self) -> None:
        device = registry.upsert_device("tok-bg", "android", "phone")
        registry.set_presence(device["id"], foreground=False)

        self.assertEqual(registry.backgrounded_tokens(), ["tok-bg"])

    def test_mixed_devices_only_background_ones_are_included(self) -> None:
        fg = registry.upsert_device("tok-fg", "android", "a")
        bg1 = registry.upsert_device("tok-bg-1", "android", "b")
        bg2 = registry.upsert_device("tok-bg-2", "ios", "c")
        registry.set_presence(fg["id"], foreground=True)
        registry.set_presence(bg1["id"], foreground=False)
        registry.set_presence(bg2["id"], foreground=False)

        self.assertCountEqual(registry.backgrounded_tokens(), ["tok-bg-1", "tok-bg-2"])

    def test_toggling_back_to_foreground_removes_it_from_the_list(self) -> None:
        device = registry.upsert_device("tok-flip", "android", "phone")
        registry.set_presence(device["id"], foreground=False)
        self.assertEqual(registry.backgrounded_tokens(), ["tok-flip"])

        registry.set_presence(device["id"], foreground=True)
        self.assertEqual(registry.backgrounded_tokens(), [])

    def test_removed_device_is_excluded_even_if_it_was_background(self) -> None:
        device = registry.upsert_device("tok-removed", "android", "phone")
        registry.set_presence(device["id"], foreground=False)
        registry.remove_device(device["id"])

        self.assertEqual(registry.backgrounded_tokens(), [])

    def test_a_device_with_no_token_field_is_defensively_excluded(self) -> None:
        # Not reachable through the public API (upsert_device always sets a token), but
        # backgrounded_tokens() guards against a malformed/hand-edited devices.json row rather
        # than pushing to an empty "to" address.
        data = registry._read()
        data["devices"]["malformed"] = {"id": "malformed", "presence": "background"}
        registry._write(data)

        self.assertEqual(registry.backgrounded_tokens(), [])


class UpsertDeviceTests(RegistryTestCase):
    def test_id_is_derived_from_the_token_deterministically(self) -> None:
        first = registry.upsert_device("same-token", "android", "a")
        second = registry.upsert_device("same-token", "android", "b")

        self.assertEqual(first["id"], second["id"])
        self.assertEqual(first["id"], registry.device_id_for_token("same-token"))

    def test_different_tokens_get_different_ids(self) -> None:
        first = registry.upsert_device("token-a", "android", "a")
        second = registry.upsert_device("token-b", "android", "a")

        self.assertNotEqual(first["id"], second["id"])

    def test_re_registering_the_same_token_is_idempotent_not_duplicating(self) -> None:
        registry.upsert_device("same-token", "android", "a")
        registry.upsert_device("same-token", "android", "a")

        self.assertEqual(len(registry.list_devices()), 1)

    def test_re_registering_preserves_presence(self) -> None:
        device = registry.upsert_device("tok", "android", "a")
        registry.set_presence(device["id"], foreground=False)

        registry.upsert_device("tok", "android", "a")

        self.assertEqual(registry.list_devices()[0]["presence"], "background")

    def test_fresh_registration_defaults_to_foreground(self) -> None:
        device = registry.upsert_device("tok", "android", "a")

        self.assertEqual(device["presence"], "foreground")

    def test_empty_label_falls_back_to_the_existing_one_not_blanking_it(self) -> None:
        registry.upsert_device("tok", "android", "My Phone")
        updated = registry.upsert_device("tok", "android", None)

        self.assertEqual(updated["label"], "My Phone")

    def test_re_registering_preserves_the_original_registered_at(self) -> None:
        first = registry.upsert_device("tok", "android", "a")
        second = registry.upsert_device("tok", "android", "a")

        self.assertEqual(first["registered_at"], second["registered_at"])


class RemoveDeviceTests(RegistryTestCase):
    def test_removing_an_existing_device_returns_true(self) -> None:
        device = registry.upsert_device("tok", "android", "a")

        self.assertTrue(registry.remove_device(device["id"]))
        self.assertEqual(registry.list_devices(), [])

    def test_removing_a_missing_device_returns_false(self) -> None:
        self.assertFalse(registry.remove_device("does-not-exist"))


class SetPresenceTests(RegistryTestCase):
    def test_returns_none_for_a_missing_device(self) -> None:
        self.assertIsNone(registry.set_presence("does-not-exist", foreground=False))

    def test_updates_updated_at(self) -> None:
        device = registry.upsert_device("tok", "android", "a")
        updated = registry.set_presence(device["id"], foreground=False)

        self.assertGreaterEqual(updated["updated_at"], device["updated_at"])


class PersistenceTests(RegistryTestCase):
    """The atomic-write crash-safety property: a second, independent read sees a fully written
    file — never a half-written one, since every write goes temp-file-then-rename."""

    def test_devices_survive_across_reads_as_if_from_a_fresh_process(self) -> None:
        device = registry.upsert_device("tok", "android", "a")
        registry.set_presence(device["id"], foreground=False)

        reloaded = registry._read()

        self.assertIn(device["id"], reloaded["devices"])
        self.assertEqual(reloaded["devices"][device["id"]]["presence"], "background")

    def test_a_missing_devices_json_reads_as_empty_not_an_error(self) -> None:
        # No upsert_device call yet — the file has never been created.
        self.assertEqual(registry.list_devices(), [])
        self.assertEqual(registry.backgrounded_tokens(), [])


if __name__ == "__main__":
    unittest.main()
