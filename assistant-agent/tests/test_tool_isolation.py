"""C2: the public guest agent must never hold an owner-privileged tool."""

import pytest

from ota_guest_agent.guardrails import assert_tool_isolation, ToolAuthorizationError
from ota_guest_agent.core_agents.guest_agent import GUEST_TOOLS
from ota_guest_agent.core_agents.owner_agent import OWNER_ONLY_TOOLS


def test_current_wiring_is_isolated():
    # The real configuration must pass (also asserted at server import).
    assert_tool_isolation()


def test_no_owner_only_tool_on_guest():
    guest = {t.__name__ for t in GUEST_TOOLS}
    owner_only = {t.__name__ for t in OWNER_ONLY_TOOLS}
    assert guest.isdisjoint(owner_only)


def test_leak_is_detected():
    # Simulate the one-line mistake: an owner tool added to the guest list.
    bad_guest = list(GUEST_TOOLS) + [OWNER_ONLY_TOOLS[0]]
    with pytest.raises(ToolAuthorizationError):
        assert_tool_isolation(guest_tools=bad_guest, owner_only_tools=OWNER_ONLY_TOOLS)
