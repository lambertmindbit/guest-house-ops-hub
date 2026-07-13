"""Party size vs the property's REAL limits.

Reported: "I need booking for 60 people with pool" — the property has 7 rooms
sleeping 20 in total, yet the tools only ever compared a party against ONE room
and suggested "try two rooms". These pin the honest answers.
"""

import ota_guest_agent.tools.booking_tools as bt


class _Ctx:
    def __init__(self):
        self.session = type("S", (), {"id": "s1"})()
        self.state = {}


# The real shape: 7 rooms, 20 beds, largest sleeps 4.
CATALOG = [
    {"id": f"r{i}", "label": f"{100+i}", "roomTypeName": "Room", "baseRate": 2000,
     "maxOccupancy": occ, "photos": [], "facing": None, "view": None, "amenities": []}
    for i, occ in enumerate([4, 4, 3, 3, 2, 2, 2])
]


class _FakeClient:
    async def rooms(self):
        return CATALOG


def test_capacity_totals():
    count, total, largest = bt._capacity(CATALOG)
    assert (count, total, largest) == (7, 20, 4)


def test_over_capacity_blocks_impossible_party():
    r = bt._over_capacity(60, CATALOG)
    assert r is not None
    assert r["status"] == "over_capacity"
    assert r["property_sleeps"] == 20 and r["property_rooms"] == 7
    # A capacity number must never be mistaken for "rooms on offer".
    assert r["room_count"] == 0 and r["available_count"] == 0
    # The model must be told NOT to offer rooms or other dates.
    assert "cannot be hosted" in r["message"]
    assert "not imply" in r["message"].lower()


def test_party_within_total_is_not_over_capacity():
    assert bt._over_capacity(6, CATALOG) is None   # fits the property (needs 2 rooms)
    assert bt._over_capacity(4, CATALOG) is None   # fits one room


async def test_list_rooms_refuses_60(monkeypatch):
    monkeypatch.setattr(bt, "_client", _FakeClient())
    ctx = _Ctx()
    r = await bt.list_rooms(ctx, guests=60)
    assert r["status"] == "over_capacity"
    assert r["property_sleeps"] == 20 and r["property_rooms"] == 7
    assert r["room_count"] == 0
    assert ctx.state.get("_ui") in (None, [])  # no room cards for an impossible ask


async def test_list_rooms_suggests_multiple_rooms_for_6(monkeypatch):
    monkeypatch.setattr(bt, "_client", _FakeClient())
    r = await bt.list_rooms(_Ctx(), guests=6)
    assert r["status"] == "needs_multiple_rooms"
    assert r["largest_room_sleeps"] == 4


async def test_list_rooms_still_shows_rooms_that_fit(monkeypatch):
    monkeypatch.setattr(bt, "_client", _FakeClient())
    ctx = _Ctx()
    r = await bt.list_rooms(ctx, guests=4)
    assert r["status"] == "success"
    assert r["room_count"] == 2  # the two 4-person rooms
    assert ctx.state.get("_ui")  # cards ARE shown
