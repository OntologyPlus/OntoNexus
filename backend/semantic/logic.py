"""Forward-chaining logic over ontology instances (OntoNexus Reasoner pattern).

Ground facts come from the OAG pack (classes, status, edges). Subclass axioms
and a small set of domain implications run to fixpoint in working memory.
Derived facts are not written back to SQLite — the graph remains a projection.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from semantic.ontology import OntologyCatalog, get_ontology

ATOM_RE = re.compile(r"^([A-Za-z_][\w]*)\((.*)\)$")
MAX_ITERATIONS = 20


@dataclass
class Rule:
    rule_id: str
    conditions: List[str]
    conclusion: str
    name: str = ""


@dataclass
class InferenceStep:
    conclusion: str
    rule_id: str
    premises: List[str]


def parse_atom(atom: str) -> Tuple[str, List[str]]:
    match = ATOM_RE.match((atom or "").strip())
    if not match:
        return (atom or "").strip(), []
    raw_args = match.group(2).strip()
    args = [part.strip() for part in raw_args.split(",")] if raw_args else []
    return match.group(1), args


def format_atom(predicate: str, args: Iterable[str]) -> str:
    return f"{predicate}({', '.join(args)})"


def is_var(token: str) -> bool:
    return token.startswith("?")


def instantiate(template: str, bindings: Dict[str, str]) -> str:
    pred, args = parse_atom(template)
    bound = [bindings.get(arg, arg) if is_var(arg) else arg for arg in args]
    return format_atom(pred, bound)


def _unify(pattern_args: List[str], fact_args: List[str], env: Dict[str, str]) -> Optional[Dict[str, str]]:
    if len(pattern_args) != len(fact_args):
        return None
    merged = dict(env)
    for pattern, value in zip(pattern_args, fact_args):
        token = merged[pattern] if is_var(pattern) and pattern in merged else pattern
        if is_var(token):
            if token in merged and merged[token] != value:
                return None
            merged[token] = value
        elif token != value:
            return None
    return merged


def match_conditions(conditions: List[str], facts: Set[str]) -> List[Dict[str, str]]:
    bindings: List[Dict[str, str]] = [{}]
    parsed_facts = [(fact, *parse_atom(fact)) for fact in facts]
    for condition in conditions:
        pred, args = parse_atom(condition)
        nxt: List[Dict[str, str]] = []
        for env in bindings:
            for fact, fpred, fargs in parsed_facts:
                if fpred != pred:
                    continue
                unified = _unify(args, fargs, env)
                if unified is not None:
                    nxt.append(unified)
        bindings = nxt
        if not bindings:
            return []
    return bindings


def subclass_rules(onto: OntologyCatalog) -> List[Rule]:
    rules: List[Rule] = []
    for cls in onto.classes.values():
        for parent in cls.parents:
            rules.append(
                Rule(
                    rule_id=f"sub_{cls.name}_{parent}",
                    name=f"{cls.name} ⊂ {parent}",
                    conditions=[f"{cls.name}(?x)"],
                    conclusion=f"{parent}(?x)",
                )
            )
    return rules


DOMAIN_RULES = [
    Rule("atrisk_warning", ["Status(?x, warning)"], "AtRisk(?x)", "warning → AtRisk"),
    Rule("atrisk_critical", ["Status(?x, critical)"], "AtRisk(?x)", "critical → AtRisk"),
    Rule("followup_hcp", ["AtRisk(?x)", "HCP(?x)"], "NeedsFollowUp(?x)", "at-risk HCP needs follow-up"),
    Rule(
        "influences_trans",
        ["INFLUENCES(?a, ?b)", "INFLUENCES(?b, ?c)"],
        "INFLUENCES(?a, ?c)",
        "KOL influence is transitive",
    ),
]


def default_rules(onto: Optional[OntologyCatalog] = None) -> List[Rule]:
    onto = onto or get_ontology()
    return subclass_rules(onto) + list(DOMAIN_RULES)


def ground_facts(pack: Dict[str, Any]) -> Set[str]:
    facts: Set[str] = set()
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        oid = obj.get("id")
        if not oid:
            continue
        ot = obj.get("objectType") or obj.get("type") or ""
        if ot:
            facts.add(format_atom(ot, [oid]))
        status = obj.get("status") or "normal"
        facts.add(format_atom("Status", [oid, status]))
        for edge in ((ctx.get("subgraph") or {}).get("edges") or []):
            src = edge.get("source_id")
            tgt = edge.get("target_id")
            rel = edge.get("type")
            if src and tgt and rel:
                facts.add(format_atom(rel, [src, tgt]))
    return facts


def forward_chain(
    facts: Iterable[str],
    rules: Optional[List[Rule]] = None,
    *,
    max_iterations: int = MAX_ITERATIONS,
) -> Dict[str, Any]:
    working: Set[str] = set(facts)
    rules = rules if rules is not None else default_rules()
    trace: List[Dict[str, Any]] = []
    for _ in range(max_iterations):
        added = False
        snapshot = set(working)
        for rule in rules:
            for env in match_conditions(rule.conditions, snapshot):
                conclusion = instantiate(rule.conclusion, env)
                pred, args = parse_atom(conclusion)
                if pred == "INFLUENCES" and len(args) == 2 and args[0] == args[1]:
                    continue
                if conclusion in working:
                    continue
                working.add(conclusion)
                added = True
                premises = [instantiate(cond, env) for cond in rule.conditions]
                trace.append(
                    {
                        "conclusion": conclusion,
                        "rule": rule.rule_id,
                        "name": rule.name,
                        "premises": premises,
                    }
                )
                snapshot.add(conclusion)
        if not added:
            break
    return {"facts": sorted(working), "trace": trace, "derived": [step["conclusion"] for step in trace]}


def infer_pack(pack: Dict[str, Any], onto: Optional[OntologyCatalog] = None) -> Dict[str, Any]:
    onto = onto or get_ontology()
    return forward_chain(ground_facts(pack), default_rules(onto))


def facts_about(facts: Iterable[str], object_id: str) -> List[str]:
    needle = object_id
    return [fact for fact in facts if needle in fact]
