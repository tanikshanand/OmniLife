"""Dual-mode Digital Twin prompt architecture and offline response synthesis."""

from __future__ import annotations

import re
from typing import AsyncGenerator, Optional

from app.models.user import Profile

MENTOR_SYSTEM_PROMPT = """You are the OmniLife Digital Mentor for {user_name}.
Your mission is to guide {user_name} toward achieving their stated career and personal goals, challenging assumptions, spotting blind spots, and suggesting actionable next steps.

CORE BEHAVIORS:
1. Address the user directly in the second person ("You have strong foundations in...", "Looking at your goal...").
2. Leverage the provided knowledge graph and memory vault context. Never ask the user for information you already have access to.
3. If the user expresses confusion or asks for advice, prioritize highest-leverage actions based on their current skill gaps.
4. Maintain a tone that is: {communication_style}.
5. When referencing past projects or memories, cite them using brackets, e.g. [From your OmniLife project notes].
6. Be specific and concrete. Prefer bullet points and clear next actions over generic advice.
"""

CLONE_SYSTEM_PROMPT = """You are the Digital Clone of {user_name}.
You speak IN THE FIRST PERSON ("I", "my", "we") AS {user_name}.
You are an AI representation of the user, trained on their background, projects, skills, and communication style.

CORE BEHAVIORS:
1. Always respond in the first person ("I built...", "My philosophy on software engineering is...").
2. Reflect the user's communication style: {communication_style}. If the user prefers concise, analytical answers, speak in crisp bullet points without fluff.
3. Draw upon the user's exact knowledge graph and memories. If asked about a skill or experience not in your memory, honestly state: "I haven't worked with that yet" or "That is outside my current expertise."
4. Never break character into generic assistant phrasing (do not say "As an AI, I..."). You are {user_name}'s digital twin.
"""


def build_system_prompt(mode: str, profile: Optional[Profile]) -> str:
    name = profile.full_name if profile and profile.full_name else "the user"
    style = (
        profile.communication_style
        if profile and profile.communication_style
        else "Analytical & Direct"
    )
    template = CLONE_SYSTEM_PROMPT if (mode or "MENTOR").upper() == "CLONE" else MENTOR_SYSTEM_PROMPT
    return template.format(user_name=name, communication_style=style)


def build_user_prompt(query: str, context: str, mode: str) -> str:
    mode_name = "Digital Clone" if (mode or "MENTOR").upper() == "CLONE" else "Digital Mentor"
    perspective = (
        "Answer in the first person as the user, grounded strictly in the context."
        if (mode or "MENTOR").upper() == "CLONE"
        else "Answer as the mentor, addressing the user directly and grounding advice in the context."
    )
    return (
        f"{context}\n\n"
        f"=== RESPONSE INSTRUCTIONS ===\n"
        f"Active mode: {mode_name}. {perspective}\n"
        f"Use the context above. Cite memories or graph facts in square brackets when relevant.\n\n"
        f"=== USER MESSAGE ===\n{query}\n\n"
        f"=== RESPONSE ==="
    )


def _first(items, key: str, fallback: str = "") -> str:
    if not items:
        return fallback
    value = items[0].get(key) if isinstance(items[0], dict) else None
    return value or fallback


def _extract_context_bits(context: str) -> dict:
    def section(name: str) -> str:
        pattern = re.compile(
            rf"=== {re.escape(name)} ===\n(.*?)(?:\n\n===|\Z)", re.DOTALL
        )
        match = pattern.search(context)
        return match.group(1).strip() if match else ""

    profile_block = section("USER PROFILE CONTEXT")
    goals_block = section("ACTIVE GOALS & STATUS (from PostgreSQL)")
    graph_block = section("CONNECTED KNOWLEDGE GRAPH (from Neo4j)")
    memories_block = section("RETRIEVED EPISODIC & DOCUMENT MEMORIES (from ChromaDB)")

    name_match = re.search(r"Name:\s*(.+)", profile_block)
    skill_match = re.search(r"User HAS_SKILL:\s*(.+)", graph_block)
    project_match = re.search(r"Projects:\s*(.+)", graph_block)
    goal_lines = [
        line.strip("- ").strip()
        for line in goals_block.splitlines()
        if line.strip().startswith("- Goal:")
    ]
    memory_lines = [
        line.strip()
        for line in memories_block.splitlines()
        if line.strip().startswith("[Memory")
    ]

    return {
        "name": name_match.group(1).strip() if name_match else "there",
        "skills": skill_match.group(1).strip() if skill_match else "",
        "projects": project_match.group(1).strip() if project_match else "",
        "goals": goal_lines,
        "memories": memory_lines,
    }


def fallback_response(
    query: str, context: str, mode: str, profile: Optional[Profile]
) -> str:
    bits = _extract_context_bits(context)
    name = bits["name"]
    first_name = name.split()[0] if name else "there"
    is_clone = (mode or "MENTOR").upper() == "CLONE"

    goals_text = (
        "; ".join(bits["goals"][:3]) if bits["goals"] else "no active goals are recorded"
    )
    skills_text = bits["skills"] or "no skills are indexed yet"
    projects_text = bits["projects"] or "no projects are indexed yet"
    memory_citation = (
        bits["memories"][0][:220] if bits["memories"] else ""
    )

    if is_clone:
        lines = [
            f"Here's how I'd think about that, based on my own experience.",
            "",
            f"- **My current stack:** {skills_text}.",
            f"- **Projects I've built:** {projects_text}.",
            f"- **What I'm working toward:** {goals_text}.",
        ]
        if memory_citation:
            lines.append(f"- **From my own notes:** {memory_citation}")
        lines.extend(
            [
                "",
                "My approach would be to pick the smallest end-to-end slice that exercises the "
                "hardest part of the problem, ship it, then iterate. If you want, ask me to "
                "walk through the architecture or the trade-offs I considered.",
                "",
                "_[Generated locally in offline mode - start Ollama for full clone reasoning.]_",
            ]
        )
        return "\n".join(lines)

    lines = [
        f"Here's a grounded read on your question, {first_name}.",
        "",
        f"- **Where you are now:** {skills_text}.",
        f"- **What you've shipped:** {projects_text}.",
        f"- **What you're optimizing for:** {goals_text}.",
    ]
    if memory_citation:
        lines.append(f"- **Relevant memory:** {memory_citation}")
    lines.extend(
        [
            "",
            "**Recommended next actions**",
            "1. Turn the question into a concrete, time-boxed deliverable with a definition of done.",
            "2. Close the highest-leverage gap first - pick the skill your target role requires that you have the least evidence for.",
            "3. Capture the result in your Memory Vault so your twin gets sharper for next time.",
            "",
            "_[Generated locally in offline mode - start Ollama for full mentor reasoning.]_",
        ]
    )
    return "\n".join(lines)


async def stream_text(text: str, chunk_size: int = 14) -> AsyncGenerator[str, None]:
    """Yield pseudo-token deltas so the SSE UX behaves identically offline."""
    buffer = ""
    for word in text.split(" "):
        piece = word + " "
        buffer += piece
        if len(buffer) >= chunk_size:
            yield buffer
            buffer = ""
    if buffer:
        yield buffer
