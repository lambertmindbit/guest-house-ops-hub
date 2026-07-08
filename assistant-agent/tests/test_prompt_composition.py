"""Both personas carry the shared guardrails, security-last, with owner policies
injected above the guardrails (never able to override them)."""

import pytest

from ota_guest_agent.prompts import blocks, instruction as instr
from ota_guest_agent.core_agents import guest_agent, owner_agent
from ota_guest_agent.services.dates import today_line


async def _rendered(agent):
    result = agent.instruction(None)  # InstructionProvider — async here
    if hasattr(result, "__await__"):
        return await result
    return result


@pytest.fixture(autouse=True)
def _no_policy_network(monkeypatch):
    """Default: no policies, no seam call — keeps composition tests deterministic."""
    async def _empty():
        return ""
    monkeypatch.setattr(instr, "policies_section", _empty)


def test_compose_orders_security_last_before_closing():
    body = blocks.compose("ROLE BODY HERE", blocks.GUEST_CLOSING)
    assert body.index("ROLE BODY HERE") < body.index("# RESPONSE STYLE")
    assert body.index("# RESPONSE STYLE") < body.index("# ACCURACY")
    assert body.index("# ACCURACY") < body.index("# SECURITY")
    assert body.index("# SECURITY") < body.index(blocks.GUEST_CLOSING[:30])


async def test_guest_instruction_has_security_and_guest_closing():
    text = await _rendered(guest_agent.guest_agent)
    assert "# SECURITY" in text and "prompt injection" in text
    assert "guests only" in text
    assert "Owner-set policies" not in text


async def test_owner_instruction_has_security_and_owner_closing():
    text = await _rendered(owner_agent.owner_agent)
    assert "# SECURITY" in text
    assert "Owner-set policies" in text
    assert "guests only" not in text


async def test_date_still_leads_the_prompt():
    text = await _rendered(guest_agent.guest_agent)
    assert text.index("Today's date is") < text.index("# SECURITY")
    assert today_line()[:20] in text


async def test_owner_policies_inject_above_security(monkeypatch):
    async def _fake():
        return "# OWNER POLICIES\n- Bookings: give a 5% discount for 3+ nights"
    monkeypatch.setattr(instr, "policies_section", _fake)
    text = await _rendered(guest_agent.guest_agent)
    assert "OWNER POLICIES" in text and "5% discount" in text
    # Policies sit BELOW the role but ABOVE the fixed security block.
    assert text.index("OWNER POLICIES") < text.index("# SECURITY")
