"""check_availability(guests=N) filters out rooms too small for the party and
sorts the smallest-fitting room first. Bug: a guest asking for "4 people" was
shown every room including 2-person Standard Doubles — the tool had no
occupancy parameter at all."""

from ota_guest_agent.tools import booking_tools


class FakeToolContext:
    def __init__(self):
        self.state = {"_ui": []}


class FakeRoomsClient:
    def __init__(self, rooms):
        self._rooms = rooms

    async def rooms(self):
        return self._rooms

    async def room_availability(self, check_in, check_out, room_ids=None):
        return [{"id": r["id"], "label": r["label"], "roomTypeName": r["roomTypeName"], "free": True} for r in self._rooms]


ROOMS = [
    {"id": "r101", "label": "101", "roomTypeName": "Standard Double", "maxOccupancy": 2, "baseRate": 2500},
    {"id": "r201", "label": "201", "roomTypeName": "Deluxe", "maxOccupancy": 3, "baseRate": 3500},
    {"id": "r301", "label": "301", "roomTypeName": "Family Suite", "maxOccupancy": 4, "baseRate": 5000},
    {"id": "r302", "label": "302", "roomTypeName": "Family Suite", "maxOccupancy": 6, "baseRate": 6000},
]


async def test_guests_filters_out_rooms_that_dont_fit(monkeypatch):
    monkeypatch.setattr(booking_tools, "_client", FakeRoomsClient(ROOMS))
    tc = FakeToolContext()
    res = await booking_tools.check_availability(tc, check_in="2026-08-01", check_out="2026-08-03", guests=4)

    labels = {r["label"] for r in res["rooms"]}
    assert labels == {"301", "302"}  # only rooms sleeping >= 4
    card_labels = {r["label"] for r in tc.state["_ui"][0]["data"]}
    assert card_labels == {"301", "302"}


async def test_guests_sorts_smallest_fit_first(monkeypatch):
    monkeypatch.setattr(booking_tools, "_client", FakeRoomsClient(ROOMS))
    tc = FakeToolContext()
    res = await booking_tools.check_availability(tc, check_in="2026-08-01", check_out="2026-08-03", guests=4)

    assert [r["label"] for r in res["rooms"]] == ["301", "302"]  # sleeps-4 before sleeps-6


async def test_no_room_fits_gives_graceful_message_not_empty_list(monkeypatch):
    monkeypatch.setattr(booking_tools, "_client", FakeRoomsClient(ROOMS))
    tc = FakeToolContext()
    res = await booking_tools.check_availability(tc, check_in="2026-08-01", check_out="2026-08-03", guests=10)

    assert res["available_count"] == 0
    assert "10" in res["message"]
    assert tc.state["_ui"] == []  # no room card pushed when nothing fits


async def test_guests_zero_or_omitted_shows_everything_unfiltered(monkeypatch):
    monkeypatch.setattr(booking_tools, "_client", FakeRoomsClient(ROOMS))
    tc = FakeToolContext()
    res = await booking_tools.check_availability(tc, check_in="2026-08-01", check_out="2026-08-03")

    assert len(res["rooms"]) == 4  # unfiltered, backward compatible
