"""Three-layer SKILL.md loader. Skill Registry is the only intent routing source."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


SKILLS_DIR = Path(__file__).resolve().parent


def _parse_scalar(raw: str) -> Any:
    raw = raw.strip()
    if raw in ("true", "True"):
        return True
    if raw in ("false", "False"):
        return False
    if re.match(r"^-?\d+(\.\d+)?$", raw):
        return float(raw) if "." in raw else int(raw)
    if raw.startswith("[") and raw.endswith("]"):
        inner = raw[1:-1].strip()
        if not inner:
            return []
        return [item.strip() for item in inner.split(",")]
    return raw


def parse_frontmatter(text: str) -> Dict[str, Any]:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    block = text[3:end].strip()
    data: Dict[str, Any] = {}
    current_key = None
    current_list = None
    current_map = None
    for line in block.splitlines():
        if not line.strip():
            continue
        if re.match(r"^  - ", line) and current_key:
            item = line.strip()[2:].strip()
            if not isinstance(data.get(current_key), list):
                data[current_key] = []
            data[current_key].append(_parse_scalar(item))
            continue
        nested = re.match(r"^  ([A-Za-z0-9_]+):\s*(.*)$", line)
        if nested and current_key and not re.match(r"^[A-Za-z0-9_]+:", line):
            if not isinstance(data.get(current_key), dict) or data.get(current_key) is None:
                data[current_key] = {}
            data[current_key][nested.group(1)] = _parse_scalar(nested.group(2))
            continue
        m = re.match(r"^([A-Za-z0-9_]+):\s*(.*)$", line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        current_key = key
        current_list = None
        current_map = None
        if val == "":
            data[key] = None
        else:
            data[key] = _parse_scalar(val)
    # second pass not needed; handle delayed list/map in loop
    return data


@dataclass
class Skill:
    name: str
    version: str = "1.0.0"
    intent: str = ""
    risk_level: str = "R0"
    display_name: str = ""
    description: str = ""
    instructions: str = ""
    required_context: Dict[str, Any] = field(default_factory=dict)
    allowed_tools: List[str] = field(default_factory=list)
    allowed_actions: List[str] = field(default_factory=list)
    triggers: List[str] = field(default_factory=list)
    trigger_weight: int = 1
    thresholds: Dict[str, Any] = field(default_factory=dict)
    plan_steps: List[str] = field(default_factory=list)
    depends_on: List[str] = field(default_factory=list)
    human_review_required: bool = False
    evidence_requirements: Dict[str, Any] = field(default_factory=dict)

    def threshold(self, key: str, default: Any) -> Any:
        if key in (self.thresholds or {}):
            return self.thresholds[key]
        return default

    @property
    def title(self) -> str:
        return self.display_name or self.name

    @property
    def metadata(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "version": self.version,
            "intent": self.intent,
            "risk_level": self.risk_level,
            "triggers": self.triggers,
            "thresholds": self.thresholds,
            "allowed_tools": self.allowed_tools,
            "allowed_actions": self.allowed_actions,
            "human_review_required": self.human_review_required,
            "required_context": self.required_context,
            "evidence_requirements": self.evidence_requirements,
        }


class SkillLoader:
    def __init__(self, skills_dir: Optional[Path] = None):
        self.skills_dir = Path(skills_dir or SKILLS_DIR)
        self._skills: Dict[str, Skill] = {}
        self._intent_index: Dict[str, str] = {}
        self.load()

    def load(self) -> None:
        self._skills = {}
        self._intent_index = {}
        if not self.skills_dir.exists():
            return
        for path in sorted(self.skills_dir.glob("*/SKILL.md")):
            text = path.read_text(encoding="utf-8")
            meta = parse_frontmatter(text)
            body = text.split("\n---", 2)[-1].strip()
            name = meta.get("name") or path.parent.name
            triggers = meta.get("triggers") or []
            if isinstance(triggers, str):
                triggers = [triggers]
            depends = meta.get("depends_on") or []
            if isinstance(depends, str):
                depends = [depends]
            skill = Skill(
                name=name,
                version=str(meta.get("version", "1.0.0")),
                intent=str(meta.get("intent") or name),
                risk_level=str(meta.get("risk_level", "R0")),
                display_name=str(meta.get("display_name") or ""),
                description=str(meta.get("description") or ""),
                instructions=body,
                required_context=meta.get("required_context") or {},
                allowed_tools=meta.get("allowed_tools") or [],
                allowed_actions=meta.get("allowed_actions") or [],
                triggers=[str(t) for t in triggers],
                trigger_weight=int(meta.get("trigger_weight") or 1),
                thresholds=meta.get("thresholds") or {},
                plan_steps=meta.get("plan_steps") or [],
                depends_on=[str(d) for d in depends],
                human_review_required=bool(meta.get("human_review_required", False)),
                evidence_requirements=meta.get("evidence_requirements") or {},
            )
            self._skills[name] = skill
            self._intent_index[skill.intent] = name

    def get(self, name: str) -> Optional[Skill]:
        return self._skills.get(name)

    def load_l3_resources(self, name: str) -> str:
        """L3: load references/ only when a Skill actually runs (SalesClaw token economics)."""
        ref = self.skills_dir / name / "references"
        if not ref.is_dir():
            return ""
        parts = []
        for path in sorted(ref.glob("*.md")):
            body = path.read_text(encoding="utf-8").strip()
            if body:
                parts.append(f"## {path.stem}\n{body}")
        return "\n\n".join(parts)

    def list_skills(self) -> List[Skill]:
        return list(self._skills.values())

    def _score_query(self, query: str, weights: Optional[Dict[str, float]] = None) -> List[tuple]:
        q = (query or "").lower()
        scored = []
        for skill in self._skills.values():
            keywords = skill.triggers or []
            if not keywords:
                continue
            hits = sum(1 for k in keywords if k.lower() in q)
            if hits:
                learn = float((weights or {}).get(skill.name, 1.0) or 1.0)
                scored.append((hits * max(1, skill.trigger_weight) * learn, skill.name))
        scored.sort(key=lambda item: item[0], reverse=True)
        return scored

    def expand_depends(self, names: List[str], max_depth: int = 5) -> List[Skill]:
        ordered: List[Skill] = []
        seen = set()

        def walk(name: str, depth: int) -> None:
            if depth > max_depth or name in seen:
                return
            skill = self._skills.get(name)
            if not skill:
                return
            for dep in skill.depends_on or []:
                walk(dep, depth + 1)
            if name not in seen:
                seen.add(name)
                ordered.append(skill)

        for name in names:
            walk(name, 0)
        return ordered

    def match(self, query: str, intent: Optional[str] = None, weights: Optional[Dict[str, float]] = None) -> Skill:
        names: List[str] = []
        if intent and intent in self._intent_index:
            names.append(self._intent_index[intent])
        elif intent and intent in self._skills:
            names.append(intent)
        for _score, name in self._score_query(query, weights=weights):
            if name not in names:
                names.append(name)
                break
        if not names:
            return self._skills.get("ontology_lookup") or next(iter(self._skills.values()))
        return self._skills[names[0]]

    def match_many(
        self,
        query: str,
        intent: Optional[str] = None,
        limit: int = 3,
        weights: Optional[Dict[str, float]] = None,
    ) -> List[Skill]:
        names: List[str] = []
        if intent and intent in self._intent_index:
            names.append(self._intent_index[intent])
        elif intent and intent in self._skills:
            names.append(intent)
        for _score, name in self._score_query(query, weights=weights):
            if name not in names:
                names.append(name)
        if not names:
            fallback = self._skills.get("ontology_lookup") or next(iter(self._skills.values()))
            return [fallback]
        expanded = self.expand_depends(names[:6])
        return expanded[: max(1, min(limit, 3))]


_loader: Optional[SkillLoader] = None


def get_skill_loader() -> SkillLoader:
    global _loader
    if _loader is None:
        _loader = SkillLoader()
    return _loader


def reset_skill_loader() -> SkillLoader:
    global _loader
    _loader = SkillLoader()
    return _loader
