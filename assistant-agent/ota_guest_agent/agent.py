"""ADK app definition — the entry point ADK/callers treat as authoritative.

Follows the worker_agent contract: expose `app` (the App instance) and
`root_agent` (the top-level agent ADK invokes). Run locally with:
    adk run assistant-agent/ota_guest_agent
    adk web  --reload_agents --port 8001 assistant-agent
"""

from __future__ import annotations

from google.adk.apps.app import App

from .core_agents.guest_agent import guest_agent

app = App(name="ota_guest_agent", root_agent=guest_agent)

# Exported for ADK + for compatibility with callers that import `root_agent`.
root_agent = guest_agent
