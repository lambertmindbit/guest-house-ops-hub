"""Hardening for the request-filing path (pass_to_property / request_booking_change).

A customer-facing bug: a "book for 50 people" request errored repeatedly and filed
duplicate tickets. These pin the three defences: a stable idempotency key so the
app de-dupes, one automatic retry so a transient blip self-heals, and a graceful
(non-error) result the guest never sees as "system error".
"""

import ota_guest_agent.tools.booking_tools as bt


class _FakeCtx:
    def __init__(self, sid="sess-1"):
        self.session = type("S", (), {"id": sid})()
        self.state = {}


class _FakeClient:
    """Records escalation bodies; fails the first `fail_times` calls."""

    def __init__(self, fail_times=0):
        self.calls = []
        self.fail_times = fail_times

    async def create_escalation(self, body):
        self.calls.append(body)
        if len(self.calls) <= self.fail_times:
            raise bt.OtaError("transient")
        return {"id": f"esc-{len(self.calls)}", "status": "open"}


async def test_files_once_with_a_stable_external_id(monkeypatch):
    fake = _FakeClient()
    monkeypatch.setattr(bt, "_client", fake)
    ctx = _FakeCtx()

    r1 = await bt.pass_to_property(ctx, "book for 50 people", "large group in August")
    r2 = await bt.pass_to_property(ctx, "book for 50 people", "large group in August")

    assert r1["status"] == "filed"
    # Same session + same request → same externalId, so the app de-dupes the retry.
    assert fake.calls[0]["externalId"] == fake.calls[1]["externalId"]
    assert fake.calls[0]["externalId"].startswith("assist-req-sess-1-")


async def test_different_sessions_get_different_keys(monkeypatch):
    fake = _FakeClient()
    monkeypatch.setattr(bt, "_client", fake)
    await bt.pass_to_property(_FakeCtx("A"), "cab", "airport pickup")
    await bt.pass_to_property(_FakeCtx("B"), "cab", "airport pickup")
    assert fake.calls[0]["externalId"] != fake.calls[1]["externalId"]


async def test_one_automatic_retry_self_heals(monkeypatch):
    fake = _FakeClient(fail_times=1)  # first attempt fails, retry succeeds
    monkeypatch.setattr(bt, "_client", fake)
    r = await bt.pass_to_property(_FakeCtx(), "extra bed", "please add a cot")
    assert r["status"] == "filed"
    assert len(fake.calls) == 2


async def test_persistent_failure_is_graceful_not_an_error(monkeypatch):
    fake = _FakeClient(fail_times=9)
    monkeypatch.setattr(bt, "_client", fake)
    r = await bt.pass_to_property(_FakeCtx(), "extra bed", "please add a cot")
    # Never surfaces status "error"; tells the model NOT to claim it was filed.
    assert r["status"] == "pending"
    assert "not" in r["message"].lower()
    assert len(fake.calls) == 2  # exactly one retry, no infinite loop


async def test_booking_change_also_idempotent(monkeypatch):
    fake = _FakeClient()
    monkeypatch.setattr(bt, "_client", fake)
    ctx = _FakeCtx()
    await bt.request_booking_change(ctx, "cancel", "cancel my stay", booking_ref="BK-9")
    await bt.request_booking_change(ctx, "cancel", "cancel my stay", booking_ref="BK-9")
    assert fake.calls[0]["externalId"] == fake.calls[1]["externalId"]
    assert fake.calls[0]["externalId"].startswith("assist-change-sess-1-")
