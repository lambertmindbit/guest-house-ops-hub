"""Structural authorization guarantees, checked at import time.

The public guest agent and the owner console agent are separate agents with
separate session namespaces, so a guest turn already cannot reach an owner tool.
This makes that guarantee provable rather than incidental: if someone ever adds
an owner-privileged tool to the guest agent's tool list (a one-line mistake), the
process refuses to start instead of quietly exposing owner data to the public
widget. Called once from server.py on startup; also exercised by the test suite.
"""

from __future__ import annotations

from typing import Iterable

from .core_agents.guest_agent import GUEST_TOOLS
from .core_agents.owner_agent import OWNER_ONLY_TOOLS


def _names(tools: Iterable) -> set[str]:
    out = set()
    for t in tools:
        name = getattr(t, "__name__", None) or getattr(t, "name", None) or str(t)
        out.add(name)
    return out


class ToolAuthorizationError(RuntimeError):
    """Raised when the guest agent is wired with an owner-privileged tool."""


def assert_tool_isolation(
    guest_tools: Iterable = GUEST_TOOLS,
    owner_only_tools: Iterable = OWNER_ONLY_TOOLS,
) -> None:
    """Fail loudly if any owner-privileged tool leaked onto the guest agent."""
    leaked = _names(guest_tools) & _names(owner_only_tools)
    if leaked:
        raise ToolAuthorizationError(
            "Owner-privileged tool(s) present on the PUBLIC guest agent: "
            + ", ".join(sorted(leaked))
            + ". Owner-only tools must never be reachable from the public widget."
        )
