"""The deterministic Book button-flow, end to end, in both modes — no LLM.

This is the safety net for the Phase-B refactor: it pins the CURRENT observable
behavior of /book -> /bookdetails -> /confirm so the extraction into flows/*
must not change it.
"""

import uuid

from conftest import post_chat, texts, cards

RID = "r201"
CI, CO = "2026-09-01", "2026-09-03"


def sid():
    return f"t-{uuid.uuid4().hex[:8]}"


async def test_book_shows_form_only(fake_ota):
    status, chunks = await post_chat(f"/book {RID} {CI} {CO}", sid(), "public")
    assert status == 200
    assert cards(chunks) == ["booking_form"]  # the room list is NOT re-rendered
    assert any("name and phone" in t.lower() for t in texts(chunks))


async def test_book_rejects_when_room_taken(fake_ota):
    fake_ota.free = False
    _, chunks = await post_chat(f"/book {RID} {CI} {CO}", sid(), "public")
    assert cards(chunks) == []  # no form
    assert any("no longer free" in t.lower() for t in texts(chunks))


async def test_bookdetails_produces_confirm_card(fake_ota):
    _, chunks = await post_chat(
        f"/bookdetails {RID} {CI} {CO} 9876543210 Asha Rao", sid(), "public"
    )
    assert cards(chunks) == ["confirm_booking"]


async def test_bookdetails_rejects_bad_phone(fake_ota):
    _, chunks = await post_chat(
        f"/bookdetails {RID} {CI} {CO} 12345 Asha", sid(), "public"
    )
    assert cards(chunks) == []
    assert any("phone" in t.lower() for t in texts(chunks))


async def test_public_confirm_files_escalation_not_reservation(fake_ota):
    s = sid()
    await post_chat(f"/bookdetails {RID} {CI} {CO} 9876543210 Asha Rao", s, "public")
    _, chunks = await post_chat(f"/confirm {RID} {CI} {CO}", s, "public")
    # Public path files a REQUEST — never a confirmed reservation.
    assert len(fake_ota.created_escalations) == 1
    assert len(fake_ota.created_reservations) == 0
    assert fake_ota.created_escalations[0]["metadata"]["kind"] == "booking_request"
    assert any("sent your request" in t.lower() or "thank you" in t.lower() for t in texts(chunks))


async def test_owner_confirm_writes_reservation(fake_ota):
    s = sid()
    await post_chat(f"/bookdetails {RID} {CI} {CO} 9876543210 Walkin Guest", s, "owner")
    _, chunks = await post_chat(f"/confirm {RID} {CI} {CO}", s, "owner")
    assert len(fake_ota.created_reservations) == 1
    assert len(fake_ota.created_escalations) == 0
    assert any("booked" in t.lower() for t in texts(chunks))


async def test_owner_confirm_conflict_is_surfaced(fake_ota):
    fake_ota.conflict = True
    s = sid()
    await post_chat(f"/bookdetails {RID} {CI} {CO} 9876543210 Walkin Guest", s, "owner")
    _, chunks = await post_chat(f"/confirm {RID} {CI} {CO}", s, "owner")
    assert len(fake_ota.created_reservations) == 0
    assert any("just booked" in t.lower() or "no longer free" in t.lower() for t in texts(chunks))


async def test_confirm_without_pending_is_graceful(fake_ota):
    # A /confirm with no prior /bookdetails must not crash or write anything.
    _, chunks = await post_chat(f"/confirm {RID} {CI} {CO}", sid(), "public")
    assert len(fake_ota.created_reservations) == 0
    assert len(fake_ota.created_escalations) == 0
    assert texts(chunks)  # some friendly text, not silence


async def test_confirm_rechecks_availability_before_filing(fake_ota):
    # Room taken between /bookdetails and /confirm -> request is NOT filed.
    s = sid()
    await post_chat(f"/bookdetails {RID} {CI} {CO} 9876543210 Asha", s, "public")
    fake_ota.free = False
    _, chunks = await post_chat(f"/confirm {RID} {CI} {CO}", s, "public")
    assert len(fake_ota.created_escalations) == 0
    assert any("no longer available" in t.lower() or "no longer free" in t.lower() for t in texts(chunks))


async def test_quote_card_is_deterministic(fake_ota):
    _, chunks = await post_chat(f"/quote {RID} {CI} {CO}", sid(), "public")
    assert "quote" in cards(chunks)
