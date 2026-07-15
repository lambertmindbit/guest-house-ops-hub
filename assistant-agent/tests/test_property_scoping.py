"""Multi-property: the agent scopes its reads to the conversation's property.

The property is carried in a contextvar (current_property_ref), set once per /chat
request from the body's propertyId, and injected into every seam GET by
_with_property. This is the Python twin of the app's withTenant() ALS context: one
place sets it, one place reads it, no threading through every tool.
"""

from ota_guest_agent.services.ota_client import _with_property, current_property_ref


def test_adds_property_ref_when_the_conversation_has_one():
    token = current_property_ref.set("prop-lawei")
    try:
        assert _with_property({"checkIn": "2030-01-01"}) == {
            "checkIn": "2030-01-01",
            "propertyRef": "prop-lawei",
        }
    finally:
        current_property_ref.reset(token)


def test_omits_property_ref_for_a_single_property_client():
    # Default is None — the seam then falls back to the sole property.
    assert "propertyRef" not in _with_property({"a": 1})


def test_never_overrides_an_explicit_property_ref():
    token = current_property_ref.set("prop-lawei")
    try:
        assert _with_property({"propertyRef": "explicit"})["propertyRef"] == "explicit"
    finally:
        current_property_ref.reset(token)


def test_does_not_mutate_the_caller_dict():
    token = current_property_ref.set("prop-x")
    try:
        original = {"checkIn": "2030-01-01"}
        _with_property(original)
        assert "propertyRef" not in original  # returned a copy, left the input alone
    finally:
        current_property_ref.reset(token)
