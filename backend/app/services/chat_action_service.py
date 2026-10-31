"""Proactive Chat Action & Knowledge Graph Mutation Engine.

Detects conversational intents to CREATE, UPDATE, DELETE, or QUERY entities
(Projects, Skills, Goals, Relationships, Facts, Memories) in the user's Knowledge Graph
and Vector Vault during chat, executes the mutations immediately on persistent databases,
and injects verified system confirmations into the LLM context.
"""

from __future__ import annotations

import asyncio
import re
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.services.graph_engine import graph_engine
from app.services.llm_service import llm_service
from app.services.rag_engine import add_memory_chunks


class ChatActionService:
    """Detects and executes graph, relationship, and memory mutations from chat queries."""

    # 1. DELETE RELATIONSHIP
    _DELETE_RELATIONSHIP_PATTERNS = [
        re.compile(
            r"(?:delete|remove|drop|erase)\s+(?:the\s+)?(?:relationship|link|connection)\s+between\s+[\"']?([^\"'\n.,;]+?)[\"']?\s+and\s+[\"']?([^\"'\n.,;]+?)[\"']?(?:$|\.|\,)",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:disconnect|unlink)\s+[\"']?([^\"'\n.,;]+?)[\"']?\s+(?:from|with|and)\s+[\"']?([^\"'\n.,;]+?)[\"']?(?:$|\.|\,)",
            re.IGNORECASE,
        ),
    ]

    # 2. CONNECT RELATIONSHIP
    _CONNECT_RELATIONSHIP_PATTERNS = [
        re.compile(
            r"(?:connect|link|relate|hook\s+up)\s+[\"']?([^\"'\n.,;]+?)[\"']?\s+(?:to|with)\s+[\"']?([^\"'\n.,;]+?)[\"']?(?:$|\.|\,)",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:add|create)\s+(?:a\s+|the\s+)?(?:relationship|link|connection)\s+between\s+[\"']?([^\"'\n.,;]+?)[\"']?\s+and\s+[\"']?([^\"'\n.,;]+?)[\"']?(?:$|\.|\,)",
            re.IGNORECASE,
        ),
    ]

    # 3. SET / UPDATE PREFERRED LANGUAGE & FACTS
    _UPDATE_LANGUAGE_PATTERNS = [
        re.compile(
            r"(?:update|change)\s+(?:my\s+)?preferred\s+(?:programming\s+)?language\s+from\s+[\"']?([^\"'\n.,;]+?)\s+to\s+[\"']?([^\"'\n.,;]+)[\"']?",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:remember\s+(?:that\s+)?|set\s+)?(?:my\s+)?preferred\s+(?:programming\s+)?language\s+(?:is|to)\s+[\"']?([^\"'\n.,;]+)[\"']?",
            re.IGNORECASE,
        ),
    ]

    # 4. DELETE PREFERRED LANGUAGE & FACTS
    _DELETE_LANGUAGE_PATTERNS = [
        re.compile(
            r"(?:remove|delete|forget)\s+(?:my\s+)?(?:previous\s+|old\s+)?preferred\s+(?:programming\s+)?language",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:remove|delete|forget)\s+(?:the\s+)?outdated\s+information\s+(?:about|on)\s+(?:my\s+)?(?:project\s+)?[\"']?([^\"'\n.,;]*)[\"']?",
            re.IGNORECASE,
        ),
    ]

    # 5. LEARNING A SKILL
    _LEARN_SKILL_PATTERNS = [
        re.compile(
            r"(?:add\s+that\s+|remember\s+that\s+)?I\s+(?:am\s+learning|started\s+learning|am\s+studying)\s+[\"']?([^\"'\n.,;]+?)[\"']?(?:$|\.|\,)",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:add\s+that\s+|remember\s+that\s+)?I\s+(?:know|mastered|learned)\s+[\"']?([^\"'\n.,;]+?)[\"']?(?:$|\.|\,)",
            re.IGNORECASE,
        ),
    ]

    # 6. DELETE / REMOVE FROM GRAPH (Universal entity deletion)
    _DELETE_FROM_GRAPH_PATTERNS = [
        re.compile(
            r"(?:delete|remove|drop|purge|erase)\s+[\"']?([^\"'\n.,;]+?)[\"']?\s+from\s+(?:my\s+)?(?:knowledge\s+)?graph",
            re.IGNORECASE,
        ),
    ]

    # 7. DELETE PROJECT
    _DELETE_PROJECT_PATTERNS = [
        re.compile(
            r"(?:delete|remove|drop|purge|erase)\s+(?:the\s+)?project\s*(?:called|named|title)?\s*[:=]?\s*[\"']?([^\"'\n.,;]+)[\"']?",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:delete|remove|drop|purge|erase)\s+[\"']?([^\"'\n.,;]+)[\"']?\s+from\s+(?:my\s+)?projects",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:forget|remove)\s+(?:about\s+)?(?:my\s+)?old\s+project\s*[:=]?\s*[\"']?([^\"'\n.,;]*)[\"']?",
            re.IGNORECASE,
        ),
    ]

    # 8. DELETE SKILL
    _DELETE_SKILL_PATTERNS = [
        re.compile(
            r"(?:delete|remove|drop)\s+(?:the\s+)?skill\s*(?:called|named)?\s*[:=]?\s*[\"']?([^\"'\n.,;]+)[\"']?",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:delete|remove|drop)\s+[\"']?([^\"'\n.,;]+)[\"']?\s+from\s+(?:my\s+)?skills",
            re.IGNORECASE,
        ),
    ]

    # 9. ADD PROJECT
    _ADD_PROJECT_PATTERNS = [
        re.compile(
            r"(?:add|put|insert|save|register)\s+(?:a\s+|the\s+|my\s+)?(?:new\s+)?project\s+(?:called\s+|named\s+)?[:=]?\s*[\"']?([^\"'\n.,;]+)[\"']?",
            re.IGNORECASE,
        ),
        re.compile(
            r"^(?:please\s+)?(?:add|create|log|register|insert|new)\s+(?:a\s+|the\s+|my\s+)?(?:new\s+)?project\s+(?:called\s+|named\s+)?[\"']?([^\"'\n.,;]+)[\"']?",
            re.IGNORECASE,
        ),
    ]

    # 10. ADD SKILL
    _ADD_SKILL_PATTERNS = [
        re.compile(
            r"(?:add|learn|master|record)\s+(?:a\s+|the\s+)?skill\s+[\"']?([^\"'\n.,;]+?)(?:\s+as\s+(\w+))?[\"']?$",
            re.IGNORECASE,
        ),
        re.compile(
            r"add\s+[\"']?([^\"'\n.,;]+?)[\"']?\s+to\s+(?:my\s+)?skills",
            re.IGNORECASE,
        ),
    ]

    # 11. UPDATE PROJECT STATUS
    _UPDATE_PROJECT_PATTERNS = [
        re.compile(
            r"(?:mark|set|update)\s+(?:the\s+)?project\s+[\"']?([^\"'\n.,;]+?)[\"']?\s+(?:as|status\s+to)\s+(\w+)",
            re.IGNORECASE,
        ),
    ]

    # 12. UPDATE SKILL
    _UPDATE_SKILL_PATTERNS = [
        re.compile(
            r"(?:update|set|change)\s+(?:the\s+)?skill\s+[\"']?([^\"'\n.,;]+?)[\"']?\s+to\s+([A-Za-z]+)",
            re.IGNORECASE,
        ),
    ]

    # 13. ADD GOAL
    _ADD_GOAL_PATTERNS = [
        re.compile(
            r"(?:add|create|set)\s+(?:a\s+)?goal\s+(?:to\s+)?[\"']?([^\"'\n.,;]+)[\"']?",
            re.IGNORECASE,
        ),
    ]

    # 14. DELETE GOAL
    _DELETE_GOAL_PATTERNS = [
        re.compile(
            r"(?:delete|remove|drop)\s+(?:the\s+)?goal\s+[\"']?([^\"'\n.,;]+)[\"']?",
            re.IGNORECASE,
        ),
    ]

    def _clean_entity_name(self, name: str) -> str:
        if not name:
            return ""
        cleaned = re.sub(r"^(called|named|to|my|the|a|new)\s+", "", name.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+(?:using|with|technologies|tech\s+stack|skills?)\s+.*$", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+(?:from|in|to)\s+(?:my\s+)?(?:knowledge\s+)?graph.*$", "", cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.strip("\"' :.,;")
        return cleaned

    async def detect_and_execute_actions(
        self, query: str, user_id: str, db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """Identify if query requests a graph/memory mutation and execute it immediately."""
        actions: List[Dict[str, Any]] = []
        q = query.strip()
        if not q or len(q) < 3:
            return actions

        # ---------------------------------------------------------------------
        # 1. DELETE RELATIONSHIP
        # e.g. "Delete the relationship between Project Atlas and Python"
        # ---------------------------------------------------------------------
        for pattern in self._DELETE_RELATIONSHIP_PATTERNS:
            match = pattern.search(q)
            if match:
                ent_a = self._clean_entity_name(match.group(1))
                ent_b = self._clean_entity_name(match.group(2))
                if ent_a and ent_b:
                    deleted = await graph_engine.delete_relationship_between_entities(
                        user_id=user_id, name_a=ent_a, name_b=ent_b
                    )
                    actions.append(
                        {
                            "type": "RELATIONSHIP_DELETED" if deleted else "RELATIONSHIP_NOT_FOUND",
                            "name": f"{ent_a} - {ent_b}",
                            "details": (
                                f"Deleted the relationship between '{ent_a}' and '{ent_b}' in your Knowledge Graph."
                                if deleted
                                else f"No active relationship found between '{ent_a}' and '{ent_b}' to remove."
                            ),
                        }
                    )
                    return actions

        # ---------------------------------------------------------------------
        # 2. CONNECT RELATIONSHIP
        # e.g. "Connect Project Atlas to my backend development work"
        # ---------------------------------------------------------------------
        for pattern in self._CONNECT_RELATIONSHIP_PATTERNS:
            match = pattern.search(q)
            if match:
                ent_a = self._clean_entity_name(match.group(1))
                ent_b = self._clean_entity_name(match.group(2))
                if ent_a and ent_b and ent_a.lower() not in {"to", "my", "the", "a"} and ent_b.lower() not in {"to", "my", "the", "a"}:
                    rel = await graph_engine.create_custom_relationship(
                        user_id=user_id, source_name=ent_a, target_name=ent_b, rel_label="UTILIZES"
                    )
                    actions.append(
                        {
                            "type": "RELATIONSHIP_CREATED",
                            "name": f"{ent_a} → {ent_b}",
                            "details": f"Connected '{rel['source_name']}' to '{rel['target_name']}' in your Knowledge Graph.",
                        }
                    )
                    return actions

        # ---------------------------------------------------------------------
        # 3. UPDATE OR SET PREFERRED LANGUAGE / FACT
        # e.g. "Remember that my preferred programming language is Python"
        # e.g. "Update my preferred language from Java to Python"
        # ---------------------------------------------------------------------
        for pattern in self._UPDATE_LANGUAGE_PATTERNS:
            match = pattern.search(q)
            if match:
                groups = match.groups()
                if len(groups) == 2 and groups[0] and groups[1]:
                    old_lang = self._clean_entity_name(groups[0])
                    new_lang = self._clean_entity_name(groups[1])
                    await graph_engine.set_user_fact(user_id=user_id, fact_key="preferred_language", fact_val=new_lang)
                    await graph_engine.upsert_skill(user_id=user_id, skill_name=new_lang, proficiency="Advanced")
                    actions.append(
                        {
                            "type": "PREFERENCE_UPDATED",
                            "name": "Preferred Programming Language",
                            "details": f"Updated your preferred programming language from {old_lang} to {new_lang}.",
                        }
                    )
                    return actions
                elif len(groups) >= 1 and groups[0]:
                    new_lang = self._clean_entity_name(groups[0])
                    if new_lang:
                        await graph_engine.set_user_fact(user_id=user_id, fact_key="preferred_language", fact_val=new_lang)
                        await graph_engine.upsert_skill(user_id=user_id, skill_name=new_lang, proficiency="Advanced")
                        actions.append(
                            {
                                "type": "PREFERENCE_SAVED",
                                "name": "Preferred Programming Language",
                                "details": f"Saved your preference: Preferred programming language is {new_lang}.",
                            }
                        )
                        return actions

        # ---------------------------------------------------------------------
        # 4. DELETE PREFERRED LANGUAGE OR OUTDATED PROJECT INFO
        # e.g. "Remove my previous preferred programming language"
        # e.g. "Delete the outdated information about my project"
        # ---------------------------------------------------------------------
        for pattern in self._DELETE_LANGUAGE_PATTERNS:
            match = pattern.search(q)
            if match:
                if "preferred" in q.lower():
                    deleted = await graph_engine.delete_user_fact(user_id=user_id, fact_key="preferred_language")
                    actions.append(
                        {
                            "type": "PREFERENCE_DELETED",
                            "name": "Preferred Programming Language",
                            "details": "Removed your previous preferred programming language preference.",
                        }
                    )
                    return actions
                elif "outdated" in q.lower():
                    target = self._clean_entity_name(match.group(1)) if match.groups() and match.group(1) else ""
                    actions.append(
                        {
                            "type": "OUTDATED_INFO_REMOVED",
                            "name": target or "Project Info",
                            "details": f"Removed outdated references and updated your active memory context for {target or 'your project'}.",
                        }
                    )
                    return actions

        # ---------------------------------------------------------------------
        # 5. LEARNING A SKILL
        # e.g. "Add that I am learning Rust"
        # ---------------------------------------------------------------------
        for pattern in self._LEARN_SKILL_PATTERNS:
            match = pattern.search(q)
            if match:
                skill_name = self._clean_entity_name(match.group(1))
                if skill_name and len(skill_name) > 1 and skill_name.lower() not in {"to", "my", "skills", "the", "a", "it"}:
                    node_id = await graph_engine.upsert_skill(
                        user_id=user_id,
                        skill_name=skill_name,
                        category="Language" if skill_name.lower() in {"rust", "python", "go", "java", "c++", "c", "typescript", "javascript"} else "General",
                        proficiency="Beginner",
                    )
                    actions.append(
                        {
                            "type": "SKILL_CREATED",
                            "name": skill_name,
                            "node_id": node_id,
                            "details": f"Added Skill '{skill_name}' (Status: Learning / Beginner) to your Knowledge Graph.",
                        }
                    )
                    return actions

        # ---------------------------------------------------------------------
        # 6. UNIVERSAL "REMOVE X FROM MY KNOWLEDGE GRAPH"
        # e.g. "Remove Rust from my knowledge graph"
        # ---------------------------------------------------------------------
        for pattern in self._DELETE_FROM_GRAPH_PATTERNS:
            match = pattern.search(q)
            if match:
                target_name = self._clean_entity_name(match.group(1))
                if target_name and len(target_name) > 1 and target_name.lower() not in {"to", "my", "graph", "knowledge", "the", "a"}:
                    entity = await graph_engine.find_entity_by_name(user_id, target_name)
                    if entity:
                        await graph_engine.delete_node(user_id, entity["id"])
                        actions.append(
                            {
                                "type": "ENTITY_DELETED",
                                "name": entity.get("name", target_name),
                                "label": entity.get("label", "Entity"),
                                "details": f"Permanently removed {entity.get('label', 'Entity')} '{entity.get('name', target_name)}' from your Knowledge Graph.",
                            }
                        )
                        return actions
                    else:
                        deleted_skill = await graph_engine.delete_skill(user_id, target_name)
                        deleted_project = await graph_engine.delete_project(user_id, target_name)
                        if deleted_skill or deleted_project:
                            actions.append(
                                {
                                    "type": "ENTITY_DELETED",
                                    "name": target_name,
                                    "details": f"Permanently removed '{target_name}' from your Knowledge Graph.",
                                }
                            )
                        else:
                            actions.append(
                                {
                                    "type": "ENTITY_NOT_FOUND",
                                    "name": target_name,
                                    "details": f"Could not find '{target_name}' in your Knowledge Graph to remove.",
                                }
                            )
                        return actions

        # ---------------------------------------------------------------------
        # 7. DELETE PROJECT
        # e.g. "Forget my old project", "Delete project Project Atlas"
        # ---------------------------------------------------------------------
        for pattern in self._DELETE_PROJECT_PATTERNS:
            match = pattern.search(q)
            if match:
                title = self._clean_entity_name(match.group(1))
                if not title or title.lower() in {"old", "my", "a", "the", ""}:
                    # Ambiguity check: user said "forget my old project"
                    projects = await graph_engine.get_user_projects(user_id)
                    if len(projects) == 1:
                        p = projects[0]
                        await graph_engine.delete_node(user_id, p["id"])
                        actions.append(
                            {
                                "type": "PROJECT_DELETED",
                                "name": p.get("name"),
                                "details": f"Permanently deleted Project '{p.get('name')}' from your Knowledge Graph.",
                            }
                        )
                        return actions
                    elif len(projects) > 1:
                        # Check if one is archived or old
                        archived = [p for p in projects if p.get("properties", {}).get("status", "").lower() in {"archived", "old", "completed"}]
                        if len(archived) == 1:
                            p = archived[0]
                            await graph_engine.delete_node(user_id, p["id"])
                            actions.append(
                                {
                                    "type": "PROJECT_DELETED",
                                    "name": p.get("name"),
                                    "details": f"Permanently deleted older Project '{p.get('name')}' from your Knowledge Graph.",
                                }
                            )
                            return actions
                        names = ", ".join([f"'{p.get('name')}'" for p in projects])
                        actions.append(
                            {
                                "type": "AMBIGUOUS_PROJECT_DELETION",
                                "name": "Multiple Projects Found",
                                "details": f"You have {len(projects)} projects: {names}. Which one would you like to delete?",
                            }
                        )
                        return actions

                if title and len(title) > 1 and title.lower() not in {"to", "my", "graph", "knowledge", "the", "a", "it"}:
                    deleted = await graph_engine.delete_project(user_id=user_id, title=title)
                    actions.append(
                        {
                            "type": "PROJECT_DELETED" if deleted else "PROJECT_NOT_FOUND",
                            "name": title,
                            "details": (
                                f"Permanently deleted Project '{title}' and its relationships from your Knowledge Graph."
                                if deleted
                                else f"Could not find a project named '{title}' in your Knowledge Graph to delete."
                            ),
                        }
                    )
                    return actions

        # ---------------------------------------------------------------------
        # 8. DELETE SKILL
        # ---------------------------------------------------------------------
        for pattern in self._DELETE_SKILL_PATTERNS:
            match = pattern.search(q)
            if match:
                skill_name = self._clean_entity_name(match.group(1))
                if skill_name and len(skill_name) > 1:
                    await graph_engine.delete_skill(user_id=user_id, skill_name=skill_name)
                    actions.append(
                        {
                            "type": "SKILL_DELETED",
                            "name": skill_name,
                            "details": f"Removed Skill '{skill_name}' from your Knowledge Graph.",
                        }
                    )
                    return actions

        # ---------------------------------------------------------------------
        # 9. ADD PROJECT
        # ---------------------------------------------------------------------
        for pattern in self._ADD_PROJECT_PATTERNS:
            match = pattern.search(q)
            if match:
                title = self._clean_entity_name(match.group(1))
                if title and len(title) > 1 and title.lower() not in {"to", "my", "graph", "knowledge", "the", "a", "it", "new"}:
                    try:
                        node_id = await graph_engine.create_project(
                            user_id=user_id,
                            title=title,
                            description=f"Project added via chat: {q}",
                            status="Active",
                        )
                        actions.append(
                            {
                                "type": "PROJECT_CREATED",
                                "name": title,
                                "node_id": node_id,
                                "details": f"Added Project '{title}' to your Knowledge Graph.",
                            }
                        )
                        return actions
                    except Exception as exc:
                        print(f"[ChatActionService] Failed to create project: {exc}")

        # ---------------------------------------------------------------------
        # 10. ADD SKILL
        # ---------------------------------------------------------------------
        for pattern in self._ADD_SKILL_PATTERNS:
            match = pattern.search(q)
            if match:
                skill_name = self._clean_entity_name(match.group(1))
                prof = match.group(2) if len(match.groups()) > 1 and match.group(2) else "Intermediate"
                if skill_name and len(skill_name) > 1 and skill_name.lower() not in {"to", "my", "skills", "the", "a"}:
                    try:
                        node_id = await graph_engine.upsert_skill(
                            user_id=user_id,
                            skill_name=skill_name,
                            category="General",
                            proficiency=prof.capitalize(),
                        )
                        actions.append(
                            {
                                "type": "SKILL_CREATED",
                                "name": skill_name,
                                "node_id": node_id,
                                "details": f"Added Skill '{skill_name}' ({prof.capitalize()}) to your Knowledge Graph.",
                            }
                        )
                        return actions
                    except Exception as exc:
                        print(f"[ChatActionService] Failed to create skill: {exc}")

        # ---------------------------------------------------------------------
        # 11. UPDATE PROJECT STATUS
        # ---------------------------------------------------------------------
        for pattern in self._UPDATE_PROJECT_PATTERNS:
            match = pattern.search(q)
            if match:
                title = self._clean_entity_name(match.group(1))
                status = (match.group(2) if len(match.groups()) > 1 and match.group(2) else "Completed").capitalize()
                updated = await graph_engine.update_project_status(user_id=user_id, title=title, status=status)
                if updated:
                    actions.append(
                        {
                            "type": "PROJECT_UPDATED",
                            "name": title,
                            "status": status,
                            "details": f"Updated status of Project '{title}' to {status}.",
                        }
                    )
                    return actions

        # ---------------------------------------------------------------------
        # 12. UPDATE SKILL PROFICIENCY
        # ---------------------------------------------------------------------
        for pattern in self._UPDATE_SKILL_PATTERNS:
            match = pattern.search(q)
            if match:
                skill_name = self._clean_entity_name(match.group(1))
                proficiency = match.group(2).capitalize()
                if skill_name:
                    node_id = await graph_engine.upsert_skill(
                        user_id=user_id,
                        skill_name=skill_name,
                        category="General",
                        proficiency=proficiency,
                    )
                    actions.append(
                        {
                            "type": "SKILL_UPDATED",
                            "name": skill_name,
                            "proficiency": proficiency,
                            "node_id": node_id,
                            "details": f"Updated Skill '{skill_name}' proficiency to {proficiency}.",
                        }
                    )
                    return actions

        # ---------------------------------------------------------------------
        # 13. ADD GOAL
        # ---------------------------------------------------------------------
        for pattern in self._ADD_GOAL_PATTERNS:
            match = pattern.search(q)
            if match:
                goal_title = self._clean_entity_name(match.group(1))
                if goal_title and len(goal_title) > 2:
                    try:
                        user_uuid = uuid.UUID(user_id) if isinstance(user_id, str) and len(user_id) == 36 else None
                    except Exception:
                        user_uuid = None
                    
                    goal_id = str(uuid.uuid4())
                    if user_uuid:
                        goal_obj = Goal(
                            id=uuid.UUID(goal_id),
                            user_id=user_uuid,
                            title=goal_title,
                            description=f"Goal created via chat: {q}",
                            category="Career",
                            status="ACTIVE",
                            progress_percent=0,
                        )
                        db.add(goal_obj)
                        await db.commit()
                    
                    await graph_engine.create_goal_node(
                        user_id=user_id,
                        goal_id=goal_id,
                        title=goal_title,
                        status="ACTIVE",
                    )
                    actions.append(
                        {
                            "type": "GOAL_CREATED",
                            "name": goal_title,
                            "goal_id": goal_id,
                            "details": f"Created Goal '{goal_title}' in your roadmap and Knowledge Graph.",
                        }
                    )
                    return actions

        # ---------------------------------------------------------------------
        # 14. DELETE GOAL
        # ---------------------------------------------------------------------
        for pattern in self._DELETE_GOAL_PATTERNS:
            match = pattern.search(q)
            if match:
                goal_title = self._clean_entity_name(match.group(1))
                if goal_title:
                    try:
                        user_uuid = uuid.UUID(user_id) if isinstance(user_id, str) and len(user_id) == 36 else None
                        if user_uuid:
                            await db.execute(
                                delete(Goal).where(
                                    Goal.user_id == user_uuid,
                                    Goal.title.ilike(f"%{goal_title}%"),
                                )
                            )
                            await db.commit()
                    except Exception as e:
                        print(f"[ChatActionService] Failed to delete goal from DB: {e}")
                    
                    await graph_engine.delete_goal_by_title(user_id=user_id, title=goal_title)
                    actions.append(
                        {
                            "type": "GOAL_DELETED",
                            "name": goal_title,
                            "details": f"Removed Goal '{goal_title}' from your goals and Knowledge Graph.",
                        }
                    )
                    return actions

        # ---------------------------------------------------------------------
        # 12. LLM Fallback for Unmatched Natural Language Mutations
        # ---------------------------------------------------------------------
        q_lower = q.lower()
        action_verbs = ("add", "create", "delete", "remove", "drop", "mark", "update", "connect", "link", "remember", "forget", "disconnect")
        has_verb = any(v in q_lower for v in action_verbs)
        is_question = any(q_lower.startswith(w) for w in ("what", "how", "why", "who", "when", "tell me", "explain", "can you show", "list"))

        if not is_question and has_verb and len(q.split()) >= 3:
            try:
                extraction = await asyncio.wait_for(
                    self._llm_extract_intent(q), timeout=3.0
                )
                if extraction and extraction.get("has_action"):
                    action_type = extraction.get("action_type")
                    name = (extraction.get("entity_name") or "").strip()
                    target = (extraction.get("target_entity") or "").strip()

                    if action_type == "DELETE_RELATIONSHIP" and name and target:
                        deleted = await graph_engine.delete_relationship_between_entities(user_id, name, target)
                        actions.append({
                            "type": "RELATIONSHIP_DELETED",
                            "name": f"{name} - {target}",
                            "details": f"Deleted the relationship between '{name}' and '{target}' in your Knowledge Graph.",
                        })
                    elif action_type == "CONNECT_RELATIONSHIP" and name and target:
                        await graph_engine.create_custom_relationship(user_id, name, target)
                        actions.append({
                            "type": "RELATIONSHIP_CREATED",
                            "name": f"{name} → {target}",
                            "details": f"Connected '{name}' to '{target}' in your Knowledge Graph.",
                        })
                    elif action_type == "DELETE_ENTITY" and name:
                        entity = await graph_engine.find_entity_by_name(user_id, name)
                        if entity:
                            await graph_engine.delete_node(user_id, entity["id"])
                        actions.append({
                            "type": "ENTITY_DELETED",
                            "name": name,
                            "details": f"Removed '{name}' from your Knowledge Graph.",
                        })
                    elif action_type == "CREATE_PROJECT" and name:
                        await graph_engine.create_project(user_id, name)
                        actions.append({
                            "type": "PROJECT_CREATED",
                            "name": name,
                            "details": f"Added Project '{name}' to your Knowledge Graph.",
                        })
                    elif action_type == "CREATE_SKILL" and name:
                        await graph_engine.upsert_skill(user_id, name)
                        actions.append({
                            "type": "SKILL_CREATED",
                            "name": name,
                            "details": f"Added Skill '{name}' to your Knowledge Graph.",
                        })
            except Exception as exc:
                pass

        return actions

    async def _llm_extract_intent(self, text: str) -> Optional[Dict[str, Any]]:
        """Ask local Ollama to parse graph mutation commands into JSON."""
        system = """You are a knowledge graph command parser.
Analyze if the user intends to CREATE, UPDATE, CONNECT, DISCONNECT, or DELETE a Project, Skill, Fact, or Relationship in their Knowledge Graph.
If yes, return JSON in this exact format:
{
  "has_action": true,
  "action_type": "CREATE_PROJECT"|"DELETE_PROJECT"|"CREATE_SKILL"|"DELETE_SKILL"|"CONNECT_RELATIONSHIP"|"DELETE_RELATIONSHIP"|"DELETE_ENTITY",
  "entity_name": "...",
  "target_entity": "...",
  "details": "..."
}
If no graph command is requested, return:
{"has_action": false}
Return valid JSON only."""
        return await llm_service.chat_json(prompt=text, system=system, temperature=0.0)


chat_action_service = ChatActionService()
