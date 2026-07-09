"""Room cards must not be re-emitted on later turns of the same session.

Live bug: a guest asked for rooms (cards shown), then asked about a pool — and
the old room cards re-appeared on that turn and every turn after. Cause: the
per-turn _ui reset in server._run mutated a get_session() snapshot instead of
persisting the reset through append_event (the exact in-place-mutation trap the
tools' _push_ui comment warns about), so the previous turn's cards stayed in
session state and were re-drained every turn.
"""

import json

from ota_guest_agent import server


class _Part:
    def __init__(self, text):
        self.text = text


class _Content:
    def __init__(self, text):
        self.parts = [_Part(text)]


class _Event:
    def __init__(self, text):
        self.content = _Content(text)


class UiPushingRunner:
    """Simulates a tool pushing a rooms card: persists _ui via the same
    state-delta mechanism real tools use, then answers."""

    async def run_async(self, user_id, session_id, new_message):
        session = await server._session_service.get_session(
            app_name=server.APP_NAME, user_id=user_id, session_id=session_id
        )
        card = {"type": "rooms", "checkIn": "", "checkOut": "", "data": [{"id": "r1", "label": "301"}]}
        await server._set_state(session, {"_ui": [card]})
        yield _Event("Here are the rooms.")


class TextOnlyRunner:
    """A later turn that calls no room tool (e.g. an FAQ answer)."""

    async def run_async(self, user_id, session_id, new_message):
        yield _Event("I don't have pool information.")


async def _collect(gen):
    out = []
    async for line in gen:
        out.append(json.loads(line))
    return out


def _ui_chunks(chunks):
    return [c for c in chunks if c.get("type") == "ui"]


async def test_cards_do_not_leak_into_later_turns():
    sid = "stale-ui-session"

    turn1 = await _collect(
        server._run("show me the rooms", sid, UiPushingRunner(), server.APP_NAME, server.USER_ID)
    )
    assert len(_ui_chunks(turn1)) == 1  # the card shows on the turn that made it

    turn2 = await _collect(
        server._run("is there a pool?", sid, TextOnlyRunner(), server.APP_NAME, server.USER_ID)
    )
    assert _ui_chunks(turn2) == []  # and NEVER again on a card-less turn

    turn3 = await _collect(
        server._run("my name is Asha", sid, TextOnlyRunner(), server.APP_NAME, server.USER_ID)
    )
    assert _ui_chunks(turn3) == []
