"""Media cards must be RELEVANT.

Reported: a guest asked "I need booking for 60 people with pool" and was shown
"Do you have some room photos?" and "Where exactly are you located? 📍 View on map".

Cause: _topics_match returned True for EVERY faq when the model passed no usable
topic ("model unsure — show media rather than silently drop it"), so every FAQ that
happened to carry media got a card. An irrelevant card is worse than no card.
"""

from ota_guest_agent.tools import faq_tools


class _Ctx:
    def __init__(self):
        self.state = {"_ui": []}


class _FakeClient:
    def __init__(self, faqs):
        self._faqs = faqs

    async def faqs(self):
        return self._faqs


PHOTOS_FAQ = {
    "question": "Do you have some room photos?",
    "answer": "Here are a few of our rooms.",
    "category": "Rooms",
    "media": {"photos": ["https://x/r1.jpg"]},
}
LOCATION_FAQ = {
    "question": "Where exactly are you located?",
    "answer": "Mawlai Umshing, Shillong.",
    "category": "Location",
    "media": {"mapLink": "https://maps.example/x"},
}
POOL_FAQ = {
    "question": "Is there a swimming pool?",
    "answer": "We don't have a swimming pool on the property.",
    "category": "Facilities",
    "media": None,
}
FAQS = [PHOTOS_FAQ, LOCATION_FAQ, POOL_FAQ]


async def test_no_topic_shows_no_media(monkeypatch):
    """The reported bug: no usable subject must NOT dump every media card."""
    monkeypatch.setattr(faq_tools, "_client", _FakeClient(FAQS))
    tc = _Ctx()
    res = await faq_tools.answer_faq(tc, topics=[])

    assert tc.state["_ui"] == []  # no room photos, no map
    # The model can still READ everything and answer from it.
    assert len(res["other_faqs"]) == 3
    assert res["matched_faqs"] == []
    assert "never invent" in res["note"].lower()


async def test_generic_only_topic_shows_no_media(monkeypatch):
    """["room"] is too generic to select a FAQ — it must not match everything."""
    monkeypatch.setattr(faq_tools, "_client", _FakeClient(FAQS))
    tc = _Ctx()
    await faq_tools.answer_faq(tc, topics=["room", "the"])
    assert tc.state["_ui"] == []


async def test_pool_question_does_not_show_photos_or_map(monkeypatch):
    """The exact reported turn: asking about a pool shows neither photos nor a map."""
    monkeypatch.setattr(faq_tools, "_client", _FakeClient(FAQS))
    tc = _Ctx()
    res = await faq_tools.answer_faq(tc, topics=["pool"])

    assert tc.state["_ui"] == []
    # …and it still finds the pool answer to reply with.
    assert [f["question"] for f in res["matched_faqs"]] == ["Is there a swimming pool?"]


async def test_relevant_media_still_shows(monkeypatch):
    """The guard must not break the thing it was protecting: real matches DO render."""
    monkeypatch.setattr(faq_tools, "_client", _FakeClient(FAQS))

    tc = _Ctx()
    await faq_tools.answer_faq(tc, topics=["photos"])
    assert len(tc.state["_ui"]) == 1
    assert tc.state["_ui"][0]["data"]["photos"] == ["https://x/r1.jpg"]

    tc2 = _Ctx()
    await faq_tools.answer_faq(tc2, topics=["location"])
    assert len(tc2.state["_ui"]) == 1
    assert tc2.state["_ui"][0]["data"]["mapLink"] == "https://maps.example/x"
