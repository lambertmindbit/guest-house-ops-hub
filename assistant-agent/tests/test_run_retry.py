"""The A1 empty-turn / transient-error retry chain in server._run.

Uses fake runners (no LLM) to prove a turn never ends silently and never leaks a
raw error: empty or 503-ing attempts fall through to a plain retry and then the
fallback model; a partial stream that errors is kept as-is.
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


_ERR = object()  # sentinel: an attempt that raises


class FakeRunner:
    """Each successive run_async call replays the next scripted attempt: a list of
    text chunks to yield, or _ERR to raise a transient error."""

    def __init__(self, scripts):
        self.scripts = scripts
        self.calls = 0

    async def run_async(self, user_id, session_id, new_message):
        script = self.scripts[self.calls] if self.calls < len(self.scripts) else []
        self.calls += 1
        if script is _ERR:
            raise RuntimeError("503 UNAVAILABLE (simulated)")
        for t in script:
            yield _Event(t)


async def _collect(gen):
    out = []
    async for line in gen:
        out.append(json.loads(line))
    return out


def _texts(chunks):
    return [c["delta"] for c in chunks if c.get("type") == "text"]


async def _run(primary, fallback, session_id):
    return await _collect(
        server._run("hello", session_id, primary, server.APP_NAME, server.USER_ID, fallback_runner=fallback)
    )


async def test_first_attempt_success_no_retry():
    p = FakeRunner([["Hi there!"], ["SHOULD NOT RUN"]])
    fb = FakeRunner([["NOPE"]])
    out = await _run(p, fb, "s1")
    assert p.calls == 1 and fb.calls == 0
    assert _texts(out) == ["Hi there!"]


async def test_empty_then_plain_retry_recovers():
    p = FakeRunner([[], ["Recovered."]])
    fb = FakeRunner([["NOPE"]])
    out = await _run(p, fb, "s2")
    assert p.calls == 2 and fb.calls == 0
    assert _texts(out) == ["Recovered."]


async def test_primary_empty_falls_to_fallback_model():
    p = FakeRunner([[], []])
    fb = FakeRunner([["From fallback."]])
    out = await _run(p, fb, "s3")
    assert p.calls == 2 and fb.calls == 1
    assert _texts(out) == ["From fallback."]


async def test_all_empty_gives_friendly_message():
    p = FakeRunner([[], []])
    fb = FakeRunner([[]])
    out = await _run(p, fb, "s4")
    assert any("hiccup" in t.lower() for t in _texts(out))
    assert out[-1]["type"] == "done"


async def test_transient_errors_fall_through_to_fallback():
    p = FakeRunner([_ERR, _ERR])
    fb = FakeRunner([["Answered despite 503s."]])
    out = await _run(p, fb, "s5")
    assert p.calls == 2 and fb.calls == 1
    assert _texts(out) == ["Answered despite 503s."]
    assert not any(c["type"] == "error" for c in out)  # raw error never leaks


async def test_all_errors_gives_friendly_message_not_raw_error():
    p = FakeRunner([_ERR, _ERR])
    fb = FakeRunner([_ERR])
    out = await _run(p, fb, "s6")
    assert any("hiccup" in t.lower() for t in _texts(out))
    assert not any(c["type"] == "error" for c in out)


async def test_partial_stream_then_error_keeps_partial():
    class PartialRunner:
        def __init__(self):
            self.calls = 0

        async def run_async(self, *a, **k):
            self.calls += 1
            yield _Event("Here is the start")
            raise RuntimeError("mid-stream 503")

    p = PartialRunner()
    fb = FakeRunner([["NOPE"]])
    out = await _collect(
        server._run("hi", "s7", p, server.APP_NAME, server.USER_ID, fallback_runner=fb)
    )
    assert p.calls == 1 and fb.calls == 0
    assert _texts(out) == ["Here is the start"]
