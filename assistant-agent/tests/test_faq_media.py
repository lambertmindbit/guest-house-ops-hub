"""E1: answer_faq shows a media card for a FAQ that has media AND matches the
topics the model passed (approach A: the model selects, the tool renders)."""

from ota_guest_agent.tools import faq_tools


class FakeToolContext:
    def __init__(self):
        self.state = {"_ui": []}


class FakeFaqClient:
    def __init__(self, faqs):
        self._faqs = faqs

    async def faqs(self):
        return self._faqs


POOL_FAQ = {
    "question": "Is there a pool?",
    "answer": "Yes, open 8am–8pm.",
    "category": "Facilities",
    "media": {"photos": ["https://x/pool1.jpg", "https://x/pool2.jpg"], "mapLink": None},
}


async def test_media_card_shown_on_topic_match(monkeypatch):
    monkeypatch.setattr(faq_tools, "_client", FakeFaqClient([POOL_FAQ]))
    tc = FakeToolContext()
    res = await faq_tools.answer_faq(tc, topics=["pool"])
    assert res["status"] == "success"
    ui = tc.state["_ui"]
    assert len(ui) == 1 and ui[0]["type"] == "faq_media"
    assert ui[0]["data"]["photos"] == ["https://x/pool1.jpg", "https://x/pool2.jpg"]
    # The model gets text only — never the media URLs to describe.
    assert "media" not in res["faqs"][0]


async def test_no_media_card_on_topic_mismatch(monkeypatch):
    monkeypatch.setattr(faq_tools, "_client", FakeFaqClient([POOL_FAQ]))
    tc = FakeToolContext()
    await faq_tools.answer_faq(tc, topics=["parking"])
    assert tc.state["_ui"] == []


async def test_no_card_when_faq_has_no_media(monkeypatch):
    faq = {"question": "Do you have parking?", "answer": "Yes.", "category": "Facilities", "media": None}
    monkeypatch.setattr(faq_tools, "_client", FakeFaqClient([faq]))
    tc = FakeToolContext()
    res = await faq_tools.answer_faq(tc, topics=["parking"])
    assert tc.state["_ui"] == []
    assert res["faqs"][0]["question"] == "Do you have parking?"
