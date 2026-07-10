"""F1: idle sessions are evicted so the in-memory store can't grow forever.

The public widget mints a session per guest; without eviction the single pinned
Cloud Run instance leaks memory monotonically. _touch_and_evict records activity
and drops sessions idle past SESSION_TTL_SECONDS.
"""

import time

from ota_guest_agent import server


async def test_idle_session_is_evicted(monkeypatch):
    monkeypatch.setattr(server, "SESSION_TTL_SECONDS", 0.05)
    server._session_last_seen.clear()

    app, user = server.APP_NAME, server.USER_ID
    # Create a real session and register it as seen.
    await server._session_service.create_session(app_name=app, user_id=user, session_id="old", state={})
    await server._touch_and_evict(app, user, "old")
    assert await server._session_service.get_session(app_name=app, user_id=user, session_id="old") is not None

    # Let it go idle past the TTL, then a NEW session's request sweeps it out.
    time.sleep(0.06)
    await server._session_service.create_session(app_name=app, user_id=user, session_id="new", state={})
    await server._touch_and_evict(app, user, "new")

    assert await server._session_service.get_session(app_name=app, user_id=user, session_id="old") is None
    assert await server._session_service.get_session(app_name=app, user_id=user, session_id="new") is not None


async def test_active_session_is_not_evicted(monkeypatch):
    monkeypatch.setattr(server, "SESSION_TTL_SECONDS", 3600.0)
    server._session_last_seen.clear()

    app, user = server.APP_NAME, server.USER_ID
    await server._session_service.create_session(app_name=app, user_id=user, session_id="live", state={})
    await server._touch_and_evict(app, user, "live")
    await server._touch_and_evict(app, user, "other")  # another session's request

    assert await server._session_service.get_session(app_name=app, user_id=user, session_id="live") is not None
