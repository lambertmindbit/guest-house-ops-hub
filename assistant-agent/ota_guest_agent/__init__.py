"""Bootstrap: load environment first, then the ADK app.

Mirrors the worker_agent convention — `.env` is loaded before `agent` is imported
so model + seam credentials are present when the agent module is constructed.
"""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()

from . import agent  # noqa: E402  (must follow load_dotenv)

app = agent.app
root_agent = agent.root_agent

__all__ = ["app", "root_agent"]
