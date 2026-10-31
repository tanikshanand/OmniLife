"""Career readiness, skill-gap analysis and learning sprint synthesis."""

from __future__ import annotations

from typing import Any, Dict, List

from app.services.graph_engine import graph_engine
from app.services.llm_service import llm_service

ROADMAP_SYSTEM_PROMPT = """You are a senior career strategist for OmniLife.
Design a concrete, project-based learning sprint that closes the user's highest-leverage skill gaps.
Return JSON only with this shape:
{"summary": "...", "weeks": [{"week": 1, "theme": "...", "focus_skills": ["..."], "deliverables": ["..."], "resources": ["..."]}]}
Each week must produce a tangible deliverable. Build on existing strengths. Be specific.
"""

MASTERY_LEVELS = {"expert", "advanced"}
IN_PROGRESS_LEVELS = {"intermediate", "beginner"}


async def get_benchmark_roles() -> List[Dict[str, Any]]:
    return await graph_engine.get_benchmark_roles()


async def compute_skill_gap(user_id: str, role_id: str) -> Dict[str, Any]:
    requirements = await graph_engine.get_role_requirements(role_id)
    user_skills = await graph_engine.get_user_skills(user_id)

    roles = await graph_engine.get_benchmark_roles()
    role_title = next(
        (role["title"] for role in roles if role["id"] == role_id), role_id
    )

    proficiency_map = {
        (skill.get("normalized_name") or skill.get("name", "")).lower(): skill.get(
            "proficiency", "Intermediate"
        )
        for skill in user_skills
    }

    mastered: List[Dict[str, Any]] = []
    in_progress: List[Dict[str, Any]] = []
    missing: List[Dict[str, Any]] = []

    for requirement in requirements:
        normalized = (
            requirement.get("normalized_name") or requirement.get("name", "")
        ).lower()
        proficiency = proficiency_map.get(normalized)
        item = {
            "name": requirement.get("name", normalized),
            "category": requirement.get("category", "General"),
            "proficiency": proficiency or "None",
            "importance": requirement.get("importance", "Recommended"),
            "is_mastered": False,
        }
        if proficiency is None:
            missing.append(item)
        elif proficiency.lower() in MASTERY_LEVELS:
            item["is_mastered"] = True
            mastered.append(item)
        else:
            in_progress.append(item)

    total = len(requirements)
    if total:
        weighted = len(mastered) + 0.5 * len(in_progress)
        match_percent = round(weighted / total * 100, 1)
    else:
        match_percent = 0.0

    return {
        "role_id": role_id,
        "role_title": role_title,
        "match_percent": match_percent,
        "mastered_skills": mastered,
        "in_progress_skills": in_progress,
        "missing_skills": missing,
        "total_required": total,
    }


def _heuristic_roadmap(gap: Dict[str, Any], weeks: int) -> Dict[str, Any]:
    missing = gap.get("missing_skills", [])
    in_progress = gap.get("in_progress_skills", [])
    focus_pool = [item["name"] for item in missing] + [
        item["name"] for item in in_progress
    ]
    if not focus_pool:
        focus_pool = ["Advanced system design", "Portfolio depth"]

    week_plans = []
    for week in range(1, weeks + 1):
        start = ((week - 1) * 2) % max(len(focus_pool), 1)
        focus = focus_pool[start : start + 2] or [focus_pool[0]]
        primary = focus[0]
        week_plans.append(
            {
                "week": week,
                "theme": f"Build real depth in {primary}",
                "focus_skills": focus,
                "deliverables": [
                    f"Build a small project that exercises {primary} end-to-end",
                    f"Write a short architecture/learning note on {primary}",
                    "Add the artifact to your OmniLife Memory Vault and graph",
                ],
                "resources": [
                    f"Official documentation and a hands-on tutorial for {primary}",
                    "One high-quality open-source repository to study",
                ],
            }
        )

    return {
        "summary": (
            f"A {weeks}-week sprint targeting {gap.get('role_title', 'your target role')}. "
            f"Current readiness is {gap.get('match_percent', 0)}%. "
            "Each week ships a concrete artifact that closes your top gaps."
        ),
        "weeks": week_plans,
    }


def _normalize_roadmap(raw: Dict[str, Any], weeks: int) -> Dict[str, Any]:
    if not isinstance(raw, dict) or not raw.get("weeks"):
        return {}
    normalized_weeks = []
    for index, week in enumerate(raw.get("weeks", [])[:weeks]):
        if not isinstance(week, dict):
            continue
        normalized_weeks.append(
            {
                "week": week.get("week", index + 1),
                "theme": str(week.get("theme") or f"Week {index + 1}"),
                "focus_skills": [
                    str(item) for item in (week.get("focus_skills") or [])
                ],
                "deliverables": [
                    str(item) for item in (week.get("deliverables") or [])
                ],
                "resources": [str(item) for item in (week.get("resources") or [])],
            }
        )
    if not normalized_weeks:
        return {}
    return {
        "summary": str(raw.get("summary") or ""),
        "weeks": normalized_weeks,
    }


async def generate_curated_roadmap(
    user_id: str, role_id: str, weeks: int = 4
) -> Dict[str, Any]:
    gap = await compute_skill_gap(user_id, role_id)
    user_skills = await graph_engine.get_user_skills(user_id)
    existing = ", ".join(skill.get("name", "") for skill in user_skills[:20]) or "none"

    prompt = (
        f"Target role: {gap['role_title']}\n"
        f"Current readiness: {gap['match_percent']}%\n"
        f"Existing skills: {existing}\n"
        f"Mastered: {', '.join(i['name'] for i in gap['mastered_skills']) or 'none'}\n"
        f"In progress: {', '.join(i['name'] for i in gap['in_progress_skills']) or 'none'}\n"
        f"Missing: {', '.join(i['name'] for i in gap['missing_skills']) or 'none'}\n"
        f"Create a {weeks}-week sprint. Prioritize mandatory missing skills."
    )
    raw = await llm_service.chat_json(prompt, system=ROADMAP_SYSTEM_PROMPT)
    roadmap = _normalize_roadmap(raw or {}, weeks)
    if not roadmap:
        roadmap = _heuristic_roadmap(gap, weeks)

    return {
        "role_id": role_id,
        "role_title": gap["role_title"],
        "weeks": weeks,
        "roadmap": roadmap,
        "gap": gap,
    }
