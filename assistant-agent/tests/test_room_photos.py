"""check_availability passes room photos/facing/view/amenities through to the
UI card (for the gallery/lightbox) AND to the model as text (facing/view/
amenities — never photo URLs, which are UI-only)."""

from ota_guest_agent.tools import booking_tools


class FakeToolContext:
    def __init__(self):
        self.state = {"_ui": []}


class FakeRoomsClient:
    def __init__(self, rooms, free=True):
        self._rooms = rooms
        self._free = free

    async def rooms(self):
        return self._rooms

    async def room_availability(self, check_in, check_out, room_ids=None):
        return [{"id": r["id"], "label": r["label"], "roomTypeName": r["roomTypeName"], "free": self._free} for r in self._rooms]


ROOM_WITH_CONTENT = {
    "id": "r201", "label": "201", "roomTypeName": "Deluxe", "maxOccupancy": 3, "baseRate": 3500,
    "photos": ["https://x/r201-a.jpg", "https://x/r201-b.jpg"],
    "facing": "East", "view": "Pool view", "amenities": ["AC", "WiFi"],
}
ROOM_NO_CONTENT = {"id": "r101", "label": "101", "roomTypeName": "Standard", "maxOccupancy": 2, "baseRate": 2500}


async def test_ui_card_carries_photos_facing_view_amenities(monkeypatch):
    monkeypatch.setattr(booking_tools, "_client", FakeRoomsClient([ROOM_WITH_CONTENT]))
    tc = FakeToolContext()
    await booking_tools.check_availability(tc, check_in="2026-08-01", check_out="2026-08-03")

    ui = tc.state["_ui"]
    assert len(ui) == 1 and ui[0]["type"] == "rooms"
    card = ui[0]["data"][0]
    assert card["photos"] == ["https://x/r201-a.jpg", "https://x/r201-b.jpg"]
    assert card["facing"] == "East"
    assert card["view"] == "Pool view"
    assert card["amenities"] == ["AC", "WiFi"]


async def test_model_gets_facing_view_amenities_but_not_photo_urls(monkeypatch):
    monkeypatch.setattr(booking_tools, "_client", FakeRoomsClient([ROOM_WITH_CONTENT]))
    tc = FakeToolContext()
    res = await booking_tools.check_availability(tc, check_in="2026-08-01", check_out="2026-08-03")

    room = res["rooms"][0]
    assert room["facing"] == "East"
    assert room["view"] == "Pool view"
    assert room["amenities"] == ["AC", "WiFi"]
    assert "photos" not in room


async def test_room_without_content_defaults_cleanly(monkeypatch):
    monkeypatch.setattr(booking_tools, "_client", FakeRoomsClient([ROOM_NO_CONTENT]))
    tc = FakeToolContext()
    res = await booking_tools.check_availability(tc, check_in="2026-08-01", check_out="2026-08-03")

    card = tc.state["_ui"][0]["data"][0]
    assert card["photos"] == []
    assert card["facing"] is None
    assert card["view"] is None
    assert card["amenities"] == []
    assert res["rooms"][0]["facing"] is None
