"""The owner console renders, it doesn't just talk.

The owner agent used to answer purely in prose, so the console read like a chat log
instead of a dashboard. daily_briefing and business_summary now emit generative-UI
cards (KPI tiles, and a revenue-by-channel chart).
"""

import ota_guest_agent.tools.owner_tools as ot


class _Ctx:
    def __init__(self):
        self.state = {"_ui": []}


SUMMARY = {
    "date": "2026-07-13",
    "occupancyPct": 57.0,
    "totalRooms": 7,
    "occupiedRooms": 4,
    "counts": {"checkInsToday": 2, "checkOutsToday": 1, "inHouse": 4, "arrivalsNext7": 6},
}

FINANCE = {
    "from": "2026-06-01", "to": "2026-07-01",
    "revenue": {"gross": 42000, "commission": 3000, "net": 39000, "collected": 30000, "outstanding": 12000},
    "netProfit": 25000, "occupancyPct": 61.2, "adr": 2450.0,
    "byChannel": [
        {"channel": "Direct", "bookings": 5, "gross": 20000, "net": 20000},
        {"channel": "Booking.com", "bookings": 4, "gross": 15000, "net": 12750},
        {"channel": "Agoda", "bookings": 2, "gross": 7000, "net": 6000},
        {"channel": "MakeMyTrip", "bookings": 0, "gross": 0, "net": 0},  # dropped: no revenue
    ],
}


class _FakeClient:
    async def owner_summary(self):
        return SUMMARY

    async def owner_finance(self, a, b):
        return FINANCE


async def test_daily_briefing_emits_today_tiles(monkeypatch):
    monkeypatch.setattr(ot, "_client", _FakeClient())
    ctx = _Ctx()
    res = await ot.daily_briefing(ctx)

    assert res["status"] == "success"
    cards = ctx.state["_ui"]
    assert len(cards) == 1
    card = cards[0]
    assert card["type"] == "metrics"
    assert card["data"]["title"] == "Today"
    labels = {t["label"]: t["value"] for t in card["data"]["tiles"]}
    assert labels["Occupancy"] == "57%"
    assert labels["Checking in"] == "2"
    assert labels["In house"] == "4"
    # The model is told not to parrot the numbers the card already shows.
    assert "do NOT re-list" in res["note"]


async def test_business_summary_emits_tiles_and_channel_chart(monkeypatch):
    monkeypatch.setattr(ot, "_client", _FakeClient())
    ctx = _Ctx()
    res = await ot.business_summary(ctx)

    assert res["status"] == "success"
    kinds = [c["type"] for c in ctx.state["_ui"]]
    assert kinds == ["metrics", "chart"]

    tiles = {t["label"]: t["value"] for t in ctx.state["_ui"][0]["data"]["tiles"]}
    assert tiles["Gross revenue"] == "₹42,000"
    assert tiles["Net profit"] == "₹25,000"
    assert tiles["ADR"] == "₹2,450"

    chart = ctx.state["_ui"][1]["data"]
    assert chart["valuePrefix"] == "₹"
    # Zero-revenue channels dropped; biggest earner first.
    assert [p["label"] for p in chart["points"]] == ["Direct", "Booking.com", "Agoda"]
    assert chart["points"][0]["value"] == 20000


async def test_no_chart_when_only_one_channel_earned(monkeypatch):
    """A single bar compares nothing — don't draw a chart for it."""
    solo = {**FINANCE, "byChannel": [{"channel": "Direct", "bookings": 5, "gross": 20000, "net": 20000}]}

    class _Solo(_FakeClient):
        async def owner_finance(self, a, b):
            return solo

    monkeypatch.setattr(ot, "_client", _Solo())
    ctx = _Ctx()
    await ot.business_summary(ctx)
    assert [c["type"] for c in ctx.state["_ui"]] == ["metrics"]
