"""C3: per-turn diagnostics (tools called, token count, fallback flag) captured
by _run and forwarded to the chat log by _logged."""

import json

from ota_guest_agent import server


# ── fake ADK event with a tool call + usage + text ──────────────────────────
class _FC:
    def __init__(self, name):
        self.name = name


class _Part:
    def __init__(self, text=None, function_call=None):
        self.text = text
        self.function_call = function_call


class _Content:
    def __init__(self, parts):
        self.parts = parts


class _Usage:
    def __init__(self, total):
        self.total_token_count = total


class _Event:
    def __init__(self, parts, usage=None):
        self.content = _Content(parts)
        self.usage_metadata = usage


class ToolThenTextRunner:
    """One attempt: a tool call (with usage), then a text answer."""

    async def run_async(self, user_id, session_id, new_message):
        yield _Event([_Part(function_call=_FC("check_availability"))], usage=_Usage(500))
        yield _Event([_Part(text="Here are the rooms.")], usage=_Usage(812))


async def _collect(gen):
    return [json.loads(line) async for line in gen]


async def test_run_records_tools_and_tokens_in_session():
    sid = "diag-1"
    await _collect(server._run("what's free?", sid, ToolThenTextRunner(), server.APP_NAME, server.USER_ID))
    sess = await server._session_service.get_session(app_name=server.APP_NAME, user_id=server.USER_ID, session_id=sid)
    diag = dict(sess.state).get("_diag")
    assert diag["tools"] == ["check_availability"]
    assert diag["tokens"] == 812          # cumulative max across events
    assert diag["fallback"] is False


async def test_logged_forwards_diagnostics_and_clears(fake_ota):
    sid = "diag-2"
    # First, run a turn so _diag is stashed in the session.
    await _collect(server._run("what's free?", sid, ToolThenTextRunner(), server.APP_NAME, server.USER_ID))

    async def stream():
        yield server._line({"type": "text", "delta": "Here are the rooms."})
        yield server._line({"type": "done"})

    await _collect(server._logged(stream(), "what's free?", sid, "public"))

    assert len(fake_ota.logged_turns) == 1
    md = fake_ota.logged_turns[0]["metadata"]
    assert md["tools"] == ["check_availability"] and md["tokens"] == 812

    # _diag must be cleared so it can't leak into the next turn's log.
    sess = await server._session_service.get_session(app_name=server.APP_NAME, user_id=server.USER_ID, session_id=sid)
    assert dict(sess.state).get("_diag") is None


async def test_logged_omits_metadata_when_no_diagnostics(fake_ota):
    # A deterministic turn sets no _diag → the log carries no metadata.
    sid = "diag-3"

    async def stream():
        yield server._line({"type": "text", "delta": "Booked!"})
        yield server._line({"type": "done"})

    await _collect(server._logged(stream(), "/confirm x", sid, "public"))
    assert len(fake_ota.logged_turns) == 1
    assert "metadata" not in fake_ota.logged_turns[0]
