"""Auth + request validation on POST /chat."""

from conftest import post_chat, cards


async def test_empty_message_is_422(fake_ota):
    status, _ = await post_chat("   ", "s-empty", "public")
    assert status == 422


async def test_wrong_token_is_401(fake_ota, monkeypatch):
    monkeypatch.setenv("ASSISTANT_AGENT_TOKEN", "the-real-secret")
    status, _ = await post_chat("/quote r201 2026-09-01 2026-09-03", "s-401", "public", token="wrong")
    assert status == 401


async def test_missing_token_is_401_when_required(fake_ota, monkeypatch):
    monkeypatch.setenv("ASSISTANT_AGENT_TOKEN", "the-real-secret")
    status, _ = await post_chat("/quote r201 2026-09-01 2026-09-03", "s-401b", "public", token=None)
    assert status == 401


async def test_correct_token_passes(fake_ota, monkeypatch):
    monkeypatch.setenv("ASSISTANT_AGENT_TOKEN", "the-real-secret")
    status, chunks = await post_chat("/quote r201 2026-09-01 2026-09-03", "s-ok", "public", token="the-real-secret")
    assert status == 200
    assert "quote" in cards(chunks)
