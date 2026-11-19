"""Architecture guard: the Agent / OAG layer must never write world state directly.

Every world-changing action goes through ``ActionGateway.submit``. These checks are
deliberately crude (substring scan) so they are cheap to keep green.
"""

import os

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUARDED = [
    "agents/war_room.py",
    "agents/war_room_logic.py",
    "agents/tools.py",
    "routers/agent.py",
    "routers/oag_compare.py",
]
FORBIDDEN = ["ActionExecutor", "execute_object_action", "ActionProposal(", "db.add(", ".execute_approved("]


def _read(rel):
    with open(os.path.join(BACKEND, rel), encoding="utf-8") as fh:
        return fh.read()


def test_agent_layer_has_no_direct_write_path():
    offenders = []
    for rel in GUARDED:
        text = _read(rel)
        for token in FORBIDDEN:
            if token in text:
                offenders.append((rel, token))
    assert not offenders, f"direct write path found: {offenders}"


def test_war_room_submits_only_via_gateway():
    text = _read("agents/war_room.py")
    assert "ActionGateway(db).submit(" in text


def test_legacy_graph_cannot_be_imported():
    text = _read("agents/cognitive_graph.py")
    assert "raise ImportError" in text
