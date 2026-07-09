"""The FAQ media matcher must survive guest vocabulary — reported bug: a guest
asked for room photos, the model passed 'pictures', substring matching missed
'photos', and the reply SAID 'here are some photos' with no card shown."""

from ota_guest_agent.tools import faq_tools


class FakeToolContext:
    def __init__(self):
        self.state = {"_ui": []}


class FakeFaqClient:
    def __init__(self, faqs):
        self._faqs = faqs

    async def faqs(self):
        return self._faqs


PHOTOS_FAQ = {
    "question": "Do you have some room photos?",
    "answer": "Here are some photos of the rooms at our home stay",
    "category": "Rooms",
    "media": {"photos": ["https://x/r1.jpg", "https://x/r2.jpg"], "mapLink": None},
}
LOCATION_FAQ = {
    "question": "Where are you located?",
    "answer": "Near NEHU University, Shillong.",
    "category": "Location",
    "media": {"photos": [], "mapLink": "https://maps.example/x"},
}
PARKING_FAQ = {
    "question": "Is parking available?",
    "answer": "Yes, free on-site parking.",
    "category": "Facilities",
    "media": None,
}


async def _cards(topics, faqs=(PHOTOS_FAQ, LOCATION_FAQ, PARKING_FAQ), monkeypatch=None):
    monkeypatch.setattr(faq_tools, "_client", FakeFaqClient(list(faqs)))
    tc = FakeToolContext()
    await faq_tools.answer_faq(tc, topics=topics)
    return tc.state["_ui"]


async def test_pictures_synonym_matches_photos(monkeypatch):
    cards = await _cards(["pictures"], monkeypatch=monkeypatch)
    assert any(c["data"].get("photos") for c in cards)


async def test_image_and_pic_synonyms_match(monkeypatch):
    for word in ("images", "pics", "photographs"):
        cards = await _cards([word], monkeypatch=monkeypatch)
        assert any(c["data"].get("photos") for c in cards), f"'{word}' should match the photos FAQ"


async def test_phrase_topic_is_word_split(monkeypatch):
    # "photo of rooms" as one topic string used to fail whole-phrase substring matching.
    cards = await _cards(["photo of rooms"], monkeypatch=monkeypatch)
    assert any(c["data"].get("photos") for c in cards)


async def test_directions_matches_location_map(monkeypatch):
    cards = await _cards(["directions"], monkeypatch=monkeypatch)
    assert any(c["data"].get("mapLink") for c in cards)


async def test_unrelated_topic_shows_no_card(monkeypatch):
    cards = await _cards(["parking"], monkeypatch=monkeypatch)
    assert cards == []


async def test_card_flood_is_capped(monkeypatch):
    many = [dict(PHOTOS_FAQ, question=f"Photos set {i}?") for i in range(6)]
    cards = await _cards([], faqs=many, monkeypatch=monkeypatch)
    assert len(cards) <= 3
