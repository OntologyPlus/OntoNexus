"""DEPRECATED — replaced by ``agents/war_room.py``.

The previous LangGraph implementation had two problems that made it unsafe to demo:
it parsed free LLM text with a regex and called ``ActionExecutor`` directly, and its
human-review node inserted ``ActionProposal`` rows without going through the Action
Gateway (so they skipped hard rules and the audit chain).

All Agent runs now use ``agents.war_room.run`` and every write goes through
``ActionGateway.submit``. This module is intentionally empty and kept only so stale
imports fail loudly instead of resurrecting a second write path.
"""

raise ImportError("agents.cognitive_graph was removed; use agents.war_room (all writes go through ActionGateway).")
