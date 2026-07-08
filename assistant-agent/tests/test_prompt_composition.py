"""Both personas must carry the shared guardrail blocks, security-last."""

from ota_guest_agent.prompts import blocks
from ota_guest_agent.core_agents import guest_agent, owner_agent
from ota_guest_agent.services.dates import _today_line


def _rendered(agent):
    # The instruction is an InstructionProvider callable; render it (ctx unused
    # by dated_instruction, so None is fine).
    return agent.instruction(None) if callable(agent.instruction) else agent.instruction


def test_compose_orders_security_last_before_closing():
    body = blocks.compose("ROLE BODY HERE", blocks.GUEST_CLOSING)
    assert body.index("ROLE BODY HERE") < body.index("# RESPONSE STYLE")
    assert body.index("# RESPONSE STYLE") < body.index("# ACCURACY")
    assert body.index("# ACCURACY") < body.index("# SECURITY")
    # Only the persona closing may follow SECURITY.
    assert body.index("# SECURITY") < body.index(blocks.GUEST_CLOSING[:30])


def test_guest_instruction_has_security_and_guest_closing():
    text = _rendered(guest_agent.guest_agent)
    assert "# SECURITY" in text
    assert "prompt injection" in text
    assert "guests only" in text                 # guest closing present
    assert "Owner-set policies" not in text      # owner closing NOT on the guest


def test_owner_instruction_has_security_and_owner_closing():
    text = _rendered(owner_agent.owner_agent)
    assert "# SECURITY" in text
    assert "Owner-set policies" in text          # owner closing present
    assert "guests only" not in text             # guest closing NOT on the owner


def test_date_still_leads_the_prompt():
    text = _rendered(guest_agent.guest_agent)
    # dated_instruction() prepends the current date line before the composed body.
    assert text.index("Today's date is") < text.index("# SECURITY")
    assert _today_line()[:20] in text
