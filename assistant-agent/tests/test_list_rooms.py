"""list_rooms — browse rooms with photos WITHOUT dates (the reference's
rooms_get_details). Bug: "show me the rooms" was interrogated for dates and
shown nothing."""

from ota_guest_agent.tools import booking_tools


class FakeToolContext:
    def __init__(self):
        self.state = {"_ui": []}


class FakeRoomsClient:
    def __init__(self, rooms):
        self._rooms = rooms

    async def rooms(self):
        return self._rooms


class FakeEscalationClient:
    def __init__(self):
        self.escalations = []

    async def create_escalation(self, body):
        self.escalations.append(body)
        return {"id": "esc-1", **body}


ROOMS = [
    {"id": "r101", "label": "101", "roomTypeName": "Standard Double", "maxOccupancy": 2, "baseRate": 2500,
     "photos": ["https://x/101.jpg"], "facing": "West", "view": None, "amenities": ["WiFi"]},
    {"id": "r301", "label": "301", "roomTypeName": "Family Suite", "maxOccupancy": 4, "baseRate": 5000,
     "photos": [], "facing": None, "view": "Valley view", "amenities": []},
]


async def test_browse_card_has_photos_and_empty_dates(monkeypatch):
    monkeypatch.setattr(booking_tools, "_client", FakeRoomsClient(ROOMS))
    tc = FakeToolContext()
    res = await booking_tools.list_rooms(tc)

    assert res["room_count"] == 2
    card = tc.state["_ui"][0]
    assert card["type"] == "rooms"
    assert card["checkIn"] == "" and card["checkOut"] == ""  # browse mode — no Book buttons
    assert card["data"][0]["photos"] == ["https://x/101.jpg"]


async def test_browse_respects_party_size(monkeypatch):
    monkeypatch.setattr(booking_tools, "_client", FakeRoomsClient(ROOMS))
    tc = FakeToolContext()
    res = await booking_tools.list_rooms(tc, guests=4)

    assert [r["label"] for r in res["rooms"]] == ["301"]


async def test_browse_no_fit_message(monkeypatch):
    monkeypatch.setattr(booking_tools, "_client", FakeRoomsClient(ROOMS))
    tc = FakeToolContext()
    res = await booking_tools.list_rooms(tc, guests=9)

    assert res["room_count"] == 0
    assert tc.state["_ui"] == []


async def test_pass_to_property_files_escalation(monkeypatch):
    fake = FakeEscalationClient()
    monkeypatch.setattr(booking_tools, "_client", fake)
    tc = FakeToolContext()
    res = await booking_tools.pass_to_property(
        tc, topic="Early check-in request", details="Guest arriving 8am, asks for early check-in",
        guest_name="Asha", guest_phone="9876543210",
    )

    assert res["status"] == "filed"
    assert len(fake.escalations) == 1
    e = fake.escalations[0]
    assert e["category"] == "customer"
    assert e["title"] == "Early check-in request"
    assert "9876543210" in e["summary"]
    assert e["raisedBy"]["name"] == "Asha"
