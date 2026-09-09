"""Shared import setup for hermes-push's tests.

``hermes-push`` is not a valid dotted Python package name (the hyphen), so it's never reachable
via a plain ``import`` statement — the real plugin loader (``hermes_cli/plugins_loader.py``)
works around this with ``importlib.util.spec_from_file_location`` plus
``submodule_search_locations``; this does the same thing, standalone, so ``watcher.py``'s and
``__init__.py``'s relative imports (``from .publisher import send_push``) resolve correctly
under plain ``unittest`` too. Every test module calls ``load_module(name)`` rather than
importing directly.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import ModuleType

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
_PLUGIN_PARENT = str(PLUGIN_ROOT.parent)

if _PLUGIN_PARENT not in sys.path:
    sys.path.insert(0, _PLUGIN_PARENT)


def load_module(dotted_suffix: str = "") -> ModuleType:
    """``load_module()`` returns the ``hermes-push`` package itself (running ``__init__.py``);
    ``load_module("watcher")`` returns ``hermes-push.watcher``, etc. Cached by
    ``importlib``/``sys.modules`` the normal way, so repeated calls across test files return the
    same module object — tests that need a clean instance construct their own
    (``watcher.ApprovalWatcher(...)``) rather than relying on the module-level singleton.
    """
    name = "hermes-push" if not dotted_suffix else f"hermes-push.{dotted_suffix}"
    return importlib.import_module(name)
