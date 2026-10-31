"""Personal knowledge-graph engine.

Uses Neo4j when reachable and transparently falls back to a persistent local
JSON graph so the whole product works without Docker/Neo4j running.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
import re
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from app.core.neo4j_client import neo4j_client

NODE_COLORS = {
    "User": "#6366f1",
    "Skill": "#10b981",
    "Project": "#f59e0b",
    "Goal": "#06b6d4",
    "Topic": "#8b5cf6",
    "Person": "#f43f5e",
    "Institution": "#eab308",
    "BenchmarkRole": "#64748b",
    "Fact": "#f97316",
    "Preference": "#ec4899",
}

NODE_SIZES = {
    "User": 22,
    "Project": 16,
    "Goal": 15,
    "Skill": 11,
    "Topic": 10,
    "Person": 10,
    "Institution": 10,
    "BenchmarkRole": 14,
    "Fact": 11,
    "Preference": 12,
}

TYPED_LABELS = {
    "User",
    "Skill",
    "Project",
    "Goal",
    "Topic",
    "Person",
    "Institution",
    "BenchmarkRole",
    "Fact",
    "Preference",
}

ENTITY_TYPE_MAP = {
    "skill": "Skill",
    "project": "Project",
    "goal": "Goal",
    "topic": "Topic",
    "person": "Person",
    "institution": "Institution",
    "company": "Institution",
    "organization": "Institution",
    "fact": "Fact",
    "preference": "Preference",
}


def _slug(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower()).strip("_")
    return cleaned or "entity"


def _norm(value: str) -> str:
    return " ".join((value or "").strip().lower().split())


def _uid8(user_id: str) -> str:
    return _slug(str(user_id))[:8]


def _fallback_path() -> Path:
    env = os.getenv("GRAPH_FALLBACK_PATH")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[2] / "graph_fallback.json"


class _FallbackStore:
    def __init__(self) -> None:
        self.path = _fallback_path()
        self._lock = threading.RLock()
        self.data: Dict[str, Any] = {"nodes": {}, "links": []}
        self._load()

    def _load(self) -> None:
        try:
            if self.path.exists():
                raw = json.loads(self.path.read_text(encoding="utf-8"))
                if isinstance(raw, dict) and "nodes" in raw and "links" in raw:
                    self.data = raw
        except Exception:
            self.data = {"nodes": {}, "links": []}

    def _save(self) -> None:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(
                json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            tmp.replace(self.path)
        except Exception:
            pass

    def upsert_node(
        self, node_id: str, name: str, label: str, properties: Dict[str, Any]
    ) -> Dict[str, Any]:
        with self._lock:
            existing = self.data["nodes"].get(node_id, {})
            props = dict(existing.get("properties", {}))
            props.update({k: v for k, v in properties.items() if v is not None})
            node = {
                "id": node_id,
                "name": name,
                "label": label,
                "properties": props,
            }
            self.data["nodes"][node_id] = node
            self._save()
            return node

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self.data["nodes"].get(node_id)

    def find_node_by_name(self, name: str, label: Optional[str] = None) -> Optional[Dict[str, Any]]:
        key = _norm(name)
        with self._lock:
            for node in self.data["nodes"].values():
                if _norm(node.get("name", "")) == key:
                    if label is None or node.get("label") == label:
                        return node
        return None

    def add_link(
        self,
        source: str,
        target: str,
        label: str,
        properties: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        with self._lock:
            for link in self.data["links"]:
                if (
                    link["source"] == source
                    and link["target"] == target
                    and link["label"] == label
                ):
                    link["properties"].update(
                        {k: v for k, v in (properties or {}).items() if v is not None}
                    )
                    self._save()
                    return link
            link = {
                "source": source,
                "target": target,
                "label": label,
                "properties": properties or {},
            }
            self.data["links"].append(link)
            self._save()
            return link

    def delete_node(self, node_id: str) -> bool:
        with self._lock:
            if node_id not in self.data["nodes"]:
                return False
            del self.data["nodes"][node_id]
            self.data["links"] = [
                link
                for link in self.data["links"]
                if link["source"] != node_id and link["target"] != node_id
            ]
            self._save()
            return True

    def delete_link(
        self, source: str, target: str, label: Optional[str] = None, bidirectional: bool = True
    ) -> int:
        with self._lock:
            before = len(self.data["links"])
            self.data["links"] = [
                link
                for link in self.data["links"]
                if not (
                    (
                        (link["source"] == source and link["target"] == target)
                        or (bidirectional and link["source"] == target and link["target"] == source)
                    )
                    and (label is None or link["label"] == label)
                )
            ]
            self._save()
            return before - len(self.data["links"])

    def snapshot(self) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        with self._lock:
            return dict(self.data["nodes"]), list(self.data["links"])


class GraphEngine:
    def __init__(self) -> None:
        self.store = _FallbackStore()

    # ------------------------------------------------------------------ helpers
    async def _neo(self) -> bool:
        if neo4j_client.available:
            return True
        return await neo4j_client.connect()

    async def _upsert_node(
        self,
        node_id: str,
        name: str,
        label: str,
        properties: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        properties = {k: v for k, v in (properties or {}).items() if v is not None}
        if await self._neo():
            try:
                await neo4j_client.run(
                    "MERGE (n:Entity {id:$id}) "
                    "SET n.name=$name, n.label=$label "
                    "SET n += $props",
                    {"id": node_id, "name": name, "label": label, "props": properties},
                )
                if label in TYPED_LABELS:
                    await neo4j_client.run(
                        f"MATCH (n:Entity {{id:$id}}) SET n:`{label}`",
                        {"id": node_id},
                    )
                return {"id": node_id, "name": name, "label": label, "properties": properties}
            except Exception:
                pass
        return self.store.upsert_node(node_id, name, label, properties)

    async def _add_link(
        self,
        source: str,
        target: str,
        label: str,
        properties: Optional[Dict[str, Any]] = None,
    ) -> None:
        properties = {k: v for k, v in (properties or {}).items() if v is not None}
        if await self._neo():
            try:
                await neo4j_client.run(
                    "MATCH (a:Entity {id:$source}), (b:Entity {id:$target}) "
                    "MERGE (a)-[r:REL {label:$label}]->(b) "
                    "SET r += $props",
                    {
                        "source": source,
                        "target": target,
                        "label": label,
                        "props": properties,
                    },
                )
                return
            except Exception:
                pass
        self.store.add_link(source, target, label, properties)

    # ------------------------------------------------------------------- nodes
    async def upsert_user_node(self, user_id: str, name: str, email: str) -> str:
        node_id = f"usr_{user_id}"
        await self._upsert_node(
            node_id,
            name or email,
            "User",
            {"user_id": str(user_id), "email": email},
        )
        return node_id

    async def upsert_skill(
        self,
        user_id: str,
        skill_name: str,
        category: str = "General",
        proficiency: str = "Intermediate",
    ) -> str:
        normalized = _norm(skill_name)
        node_id = f"skl_{_slug(normalized)}"
        await self._upsert_node(
            node_id,
            skill_name.strip(),
            "Skill",
            {
                "normalized_name": normalized,
                "category": category or "General",
                "proficiency": proficiency or "Intermediate",
            },
        )
        user_node = f"usr_{user_id}"
        await self._add_link(
            user_node,
            node_id,
            "HAS_SKILL",
            {"proficiency": proficiency or "Intermediate", "category": category or "General"},
        )
        return node_id

    async def ensure_skill(
        self, skill_name: str, category: str = "General"
    ) -> str:
        """Create/merge a global skill node WITHOUT claiming the user has it."""
        normalized = _norm(skill_name)
        node_id = f"skl_{_slug(normalized)}"
        await self._upsert_node(
            node_id,
            skill_name.strip(),
            "Skill",
            {"normalized_name": normalized, "category": category or "General"},
        )
        return node_id

    async def create_project(
        self,
        user_id: str,
        title: str,
        description: str = "",
        status: str = "Active",
    ) -> str:
        node_id = f"prj_{_uid8(user_id)}_{_slug(title)}"
        await self._upsert_node(
            node_id,
            title.strip(),
            "Project",
            {
                "title": title.strip(),
                "description": description or "",
                "status": status,
                "user_id": str(user_id),
            },
        )
        await self._add_link(f"usr_{user_id}", node_id, "OWNS_PROJECT")
        return node_id

    async def create_goal_node(
        self,
        user_id: str,
        goal_id: str,
        title: str,
        target_date: Optional[str] = None,
        status: str = "ACTIVE",
    ) -> str:
        node_id = f"goal_{goal_id}"
        await self._upsert_node(
            node_id,
            title.strip(),
            "Goal",
            {
                "title": title.strip(),
                "target_date": target_date,
                "status": status,
                "user_id": str(user_id),
            },
        )
        await self._add_link(f"usr_{user_id}", node_id, "PURSUES_GOAL")
        return node_id

    async def link_project_skill(
        self,
        user_id: str,
        project_title: str,
        skill_name: str,
        significance: str = "Core",
    ) -> None:
        project_id = f"prj_{_uid8(user_id)}_{_slug(project_title)}"
        skill_id = f"skl_{_slug(_norm(skill_name))}"
        await self._add_link(project_id, skill_id, "UTILIZES", {"significance": significance})

    async def link_project_goal(
        self, user_id: str, project_title: str, goal_title: str
    ) -> None:
        project_id = f"prj_{_uid8(user_id)}_{_slug(project_title)}"
        goal_id = f"goal_{_uid8(user_id)}_{_slug(goal_title)}"
        await self._add_link(project_id, goal_id, "ADVANCES")

    async def create_node(
        self, user_id: str, label: str, name: str, properties: Dict[str, Any]
    ) -> Dict[str, Any]:
        canonical = self._canonical_label(label)
        name = name.strip()
        if canonical == "Skill":
            node_id = f"skl_{_slug(_norm(name))}"
            properties.setdefault("normalized_name", _norm(name))
            properties.setdefault("category", "General")
        elif canonical == "Topic":
            node_id = f"top_{_slug(_norm(name))}"
            properties.setdefault("normalized_name", _norm(name))
            properties.setdefault("domain", "General")
        elif canonical == "Institution":
            node_id = f"inst_{_slug(name)}"
        elif canonical == "Project":
            node_id = f"prj_{_uid8(user_id)}_{_slug(name)}"
            properties.setdefault("user_id", str(user_id))
        elif canonical == "Goal":
            node_id = f"goal_{_uid8(user_id)}_{_slug(name)}"
            properties.setdefault("user_id", str(user_id))
        elif canonical == "Person":
            node_id = f"per_{_uid8(user_id)}_{_slug(name)}"
            properties.setdefault("user_id", str(user_id))
        else:
            raise ValueError(f"Unsupported node label: {label}")

        node = await self._upsert_node(node_id, name, canonical, properties)

        ownership = {
            "Skill": "HAS_SKILL",
            "Project": "OWNS_PROJECT",
            "Goal": "PURSUES_GOAL",
            "Person": "KNOWS_PERSON",
            "Institution": "STUDIED_AT",
        }.get(canonical)
        if ownership:
            await self._add_link(f"usr_{user_id}", node_id, ownership, properties)
        return node

    async def create_relationship(
        self,
        user_id: str,
        source_id: str,
        target_id: str,
        label: str,
        properties: Dict[str, Any],
    ) -> None:
        await self._add_link(source_id, target_id, label, properties)

    # ------------------------------------------------------------------- search & entity management
    async def get_user_projects(self, user_id: str) -> List[Dict[str, Any]]:
        user_node = f"usr_{user_id}"
        if await self._neo():
            try:
                rows = await neo4j_client.run(
                    "MATCH (u:Entity {id:$uid})-[r:REL {label:'OWNS_PROJECT'}]->(p:Entity) "
                    "RETURN p.id AS id, p.name AS name, p.label AS label, properties(p) AS properties",
                    {"uid": user_node},
                )
                if rows:
                    return rows
            except Exception:
                pass

        nodes, links = self.store.snapshot()
        projects = []
        for link in links:
            if link["source"] == user_node and link["label"] == "OWNS_PROJECT":
                node = nodes.get(link["target"])
                if node and (node.get("label") == "Project" or "prj_" in link["target"]):
                    projects.append(node)
        return projects

    async def find_project_node(self, user_id: str, title: str) -> Optional[Dict[str, Any]]:
        title_slug = _slug(title)
        exact_id = f"prj_{_uid8(user_id)}_{title_slug}"
        if await self._neo():
            try:
                rows = await neo4j_client.run(
                    "MATCH (p:Entity {id:$id}) RETURN p.id AS id, p.name AS name, p.label AS label, properties(p) AS properties",
                    {"id": exact_id},
                )
                if rows:
                    return rows[0]
            except Exception:
                pass

        node = self.store.get_node(exact_id)
        if node:
            return node

        projects = await self.get_user_projects(user_id)
        norm_title = _norm(title)
        for p in projects:
            p_name = p.get("name", "")
            if _norm(p_name) == norm_title or _slug(p_name) == title_slug:
                return p
        for p in projects:
            p_name = p.get("name", "")
            if norm_title in _norm(p_name) or _norm(p_name) in norm_title:
                return p
        return None

    async def delete_project(self, user_id: str, title: str) -> bool:
        project_node = await self.find_project_node(user_id, title)
        if not project_node:
            return False
        return await self.delete_node(user_id, project_node["id"])

    async def update_project_status(self, user_id: str, title: str, status: str) -> bool:
        project_node = await self.find_project_node(user_id, title)
        if not project_node:
            return False
        props = dict(project_node.get("properties", {}))
        props["status"] = status
        await self._upsert_node(project_node["id"], project_node.get("name", title), "Project", props)
        return True

    async def delete_skill(self, user_id: str, skill_name: str) -> bool:
        normalized = _norm(skill_name)
        node_id = f"skl_{_slug(normalized)}"
        return await self.delete_node(user_id, node_id)

    async def delete_goal_by_title(self, user_id: str, title: str) -> bool:
        title_slug = _slug(title)
        exact_id = f"goal_{_uid8(user_id)}_{title_slug}"
        if await self.delete_node(user_id, exact_id):
            return True
        nodes, links = self.store.snapshot()
        user_node = f"usr_{user_id}"
        norm_title = _norm(title)
        for link in links:
            if link["source"] == user_node and link["label"] == "PURSUES_GOAL":
                node = nodes.get(link["target"])
                if node and (_norm(node.get("name", "")) == norm_title or norm_title in _norm(node.get("name", ""))):
                    return await self.delete_node(user_id, node["id"])
        return False

    async def delete_node(self, user_id: str, node_id: str) -> bool:
        global_labels = {"Skill", "Topic", "Institution", "BenchmarkRole"}
        if await self._neo():
            try:
                rows = await neo4j_client.run(
                    "MATCH (n:Entity {id:$id}) RETURN n.label AS label, n.user_id AS user_id",
                    {"id": node_id},
                )
                if rows:
                    label = rows[0].get("label")
                    owner = rows[0].get("user_id")
                    if label in global_labels:
                        await neo4j_client.run(
                            "MATCH (a:Entity {id:$uid})-[r]-(b:Entity {id:$nid}) DELETE r",
                            {"uid": f"usr_{user_id}", "nid": node_id},
                        )
                        # Also delete project/goal links for this user
                        user_prefix = _uid8(user_id)
                        await neo4j_client.run(
                            "MATCH (p:Entity)-[r]-(b:Entity {id:$nid}) "
                            f"WHERE p.id STARTS WITH 'prj_{user_prefix}_' OR p.id STARTS WITH 'goal_{user_prefix}_' "
                            "DELETE r",
                            {"nid": node_id},
                        )
                    elif owner == str(user_id) or owner is None:
                        await neo4j_client.run(
                            "MATCH (n:Entity {id:$id}) DETACH DELETE n", {"id": node_id}
                        )
                    else:
                        return False
                    return True
            except Exception:
                pass

        node = self.store.get_node(node_id)
        if node is None:
            return False
        if node.get("label") in global_labels:
            self.store.delete_link(f"usr_{user_id}", node_id, bidirectional=True)
            # Also clean up links to user's projects/goals
            user_prefix = _uid8(user_id)
            nodes, links = self.store.snapshot()
            for l in list(links):
                if l["source"] == node_id or l["target"] == node_id:
                    other_id = l["target"] if l["source"] == node_id else l["source"]
                    if other_id.startswith(f"prj_{user_prefix}_") or other_id.startswith(f"goal_{user_prefix}_"):
                        self.store.delete_link(l["source"], l["target"], l.get("label"), bidirectional=True)
            return True
        owner = node.get("properties", {}).get("user_id")
        if owner in (str(user_id), None):
            return self.store.delete_node(node_id)
        return False

    async def delete_relationship(
        self, user_id: str, source_id: str, target_id: str, label: Optional[str] = None
    ) -> bool:
        """Permanently remove a relationship between two nodes in user's graph."""
        if await self._neo():
            try:
                query = (
                    "MATCH (a:Entity {id:$src})-[r]-(b:Entity {id:$tgt}) "
                    "WHERE ($lbl IS NULL OR r.label = $lbl OR type(r) = $lbl) "
                    "DELETE r RETURN count(r) AS cnt"
                )
                rows = await neo4j_client.run(query, {"src": source_id, "tgt": target_id, "lbl": label})
                if rows and rows[0].get("cnt", 0) > 0:
                    return True
            except Exception:
                pass

        deleted = self.store.delete_link(source_id, target_id, label=label, bidirectional=True)
        return deleted > 0

    async def find_entity_by_name(
        self, user_id: str, name: str, label: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Find an entity in user's graph by exact or fuzzy name match."""
        candidates = await self.find_all_entities_by_name(user_id, name, label)
        return candidates[0] if candidates else None

    async def find_all_entities_by_name(
        self, user_id: str, name: str, label: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Return all matching entities in user's graph."""
        norm_target = _norm(name)
        slug_target = _slug(name)
        subgraph = await self.get_user_subgraph(user_id, depth=3, limit=500)
        exact_matches = []
        substring_matches = []

        for node in subgraph.get("nodes", []):
            if node["id"] == f"usr_{user_id}":
                continue
            if label and node.get("label") != label:
                continue
            node_name = node.get("name", "")
            norm_name = _norm(node_name)
            slug_name = _slug(node_name)

            if norm_name == norm_target or slug_name == slug_target:
                exact_matches.append(node)
            elif norm_target in norm_name or norm_name in norm_target:
                substring_matches.append(node)

        return exact_matches or substring_matches

    async def delete_relationship_between_entities(
        self, user_id: str, name_a: str, name_b: str, label: Optional[str] = None
    ) -> int:
        """Find nodes for name_a and name_b and delete any relationships between them."""
        node_a = await self.find_entity_by_name(user_id, name_a)
        node_b = await self.find_entity_by_name(user_id, name_b)
        if not node_a or not node_b:
            return 0
        success = await self.delete_relationship(user_id, node_a["id"], node_b["id"], label=label)
        return 1 if success else 0

    async def create_custom_relationship(
        self,
        user_id: str,
        source_name: str,
        target_name: str,
        rel_label: str = "RELATED_TO",
        properties: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Connect source_name to target_name. Resolves or auto-creates target if needed."""
        source = await self.find_entity_by_name(user_id, source_name)
        if not source:
            source_id = await self.create_project(user_id, source_name)
            source = {"id": source_id, "name": source_name, "label": "Project"}

        target = await self.find_entity_by_name(user_id, target_name)
        if not target:
            target_id = f"top_{_slug(_norm(target_name))}"
            await self._upsert_node(
                target_id,
                target_name,
                "Topic",
                {"normalized_name": _norm(target_name), "category": "General"},
            )
            await self._add_link(f"usr_{user_id}", target_id, "INTERESTED_IN")
            target = {"id": target_id, "name": target_name, "label": "Topic"}

        await self._add_link(source["id"], target["id"], rel_label, properties or {})
        return {
            "source": source["id"],
            "source_name": source["name"],
            "target": target["id"],
            "target_name": target["name"],
            "label": rel_label,
        }

    async def set_user_fact(
        self, user_id: str, fact_key: str, fact_val: str
    ) -> Dict[str, Any]:
        """Store an individual preference or fact in user's Knowledge Graph."""
        key_slug = _slug(fact_key)
        val_clean = fact_val.strip()
        node_id = f"fact_{_uid8(user_id)}_{key_slug}"
        props = {
            "fact_key": fact_key,
            "fact_val": val_clean,
            "user_id": str(user_id),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await self._upsert_node(node_id, f"{fact_key}: {val_clean}", "Fact", props)
        await self._add_link(
            f"usr_{user_id}",
            node_id,
            "HAS_PREFERENCE",
            {"key": fact_key, "value": val_clean},
        )
        return {"id": node_id, "key": fact_key, "value": val_clean}

    async def delete_user_fact(self, user_id: str, fact_key: str) -> bool:
        """Remove a fact or preference node from user's Knowledge Graph."""
        key_slug = _slug(fact_key)
        node_id = f"fact_{_uid8(user_id)}_{key_slug}"
        deleted = await self.delete_node(user_id, node_id)
        if deleted:
            return True

        subgraph = await self.get_user_subgraph(user_id, depth=2, limit=200)
        norm_key = _norm(fact_key)
        for node in subgraph.get("nodes", []):
            if node.get("label") == "Fact":
                k = node.get("properties", {}).get("fact_key", "")
                if _norm(k) == norm_key or norm_key in _norm(k):
                    return await self.delete_node(user_id, node["id"])
        return False

    async def get_user_facts(self, user_id: str) -> Dict[str, str]:
        """Retrieve all facts and preferences for user."""
        subgraph = await self.get_user_subgraph(user_id, depth=2, limit=200)
        facts = {}
        for node in subgraph.get("nodes", []):
            if node.get("label") == "Fact":
                props = node.get("properties", {})
                k = props.get("fact_key")
                v = props.get("fact_val")
                if k and v:
                    facts[k] = v
        return facts

    async def update_node_properties(
        self, user_id: str, node_id: str, properties: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update properties of an existing node in user's graph."""
        node = self.store.get_node(node_id)
        if not node:
            return None
        owner = node.get("properties", {}).get("user_id")
        if owner not in (str(user_id), None) and node.get("label") not in {"Skill", "Topic", "Institution"}:
            return None
        updated = self.store.upsert_node(node_id, node.get("name", ""), node.get("label", "Topic"), properties)
        return updated

    # ------------------------------------------------------------------- graph
    async def get_user_subgraph(
        self, user_id: str, depth: int = 2, limit: int = 150
    ) -> Dict[str, Any]:
        depth = max(1, min(int(depth), 4))
        limit = max(10, min(int(limit), 1000))
        user_node_id = f"usr_{user_id}"

        if await self._neo():
            try:
                query = (
                    "MATCH (u:Entity {id:$uid}) "
                    f"OPTIONAL MATCH p=(u)-[*1..{depth}]-(n:Entity) "
                    "WHERE n.label <> 'BenchmarkRole' "
                    "AND (n.label <> 'User' OR n.id = $uid) "
                    "AND (n.user_id IS NULL OR n.user_id = $uid_str) "
                    "WITH u, collect(p) AS paths "
                    "RETURN {id:u.id, name:u.name, label:u.label, properties:properties(u)} AS user, "
                    "[p IN paths WHERE p IS NOT NULL | "
                    "[n IN nodes(p) | {id:n.id, name:n.name, label:n.label, properties:properties(n)}]] AS node_groups, "
                    "[p IN paths WHERE p IS NOT NULL | "
                    "[r IN relationships(p) | {source:startNode(r).id, target:endNode(r).id, "
                    "label:coalesce(r.label, type(r)), properties:properties(r)}]] AS rel_groups"
                )
                rows = await neo4j_client.run(query, {"uid": user_node_id, "uid_str": str(user_id)})
                if rows:
                    row = rows[0]
                    nodes_map: Dict[str, Dict[str, Any]] = {}
                    user = row.get("user") or {}
                    if user.get("id"):
                        nodes_map[user["id"]] = user
                    for group in row.get("node_groups") or []:
                        for node in group or []:
                            if node.get("id"):
                                nid = node["id"]
                                if nid.startswith("usr_") and nid != user_node_id:
                                    continue
                                node_uid = node.get("properties", {}).get("user_id")
                                if node_uid and str(node_uid) != str(user_id):
                                    continue
                                nodes_map.setdefault(nid, node)
                    links: List[Dict[str, Any]] = []
                    seen = set()
                    for group in row.get("rel_groups") or []:
                        for rel in group or []:
                            src = rel.get("source")
                            tgt = rel.get("target")
                            if (src.startswith("usr_") and src != user_node_id) or (tgt.startswith("usr_") and tgt != user_node_id):
                                continue
                            key = (src, tgt, rel.get("label"))
                            if key in seen:
                                continue
                            seen.add(key)
                            links.append(rel)
                    return self._serialize_subgraph(nodes_map, links, limit)
            except Exception:
                pass

        # Fallback BFS
        nodes_all, links_all = self.store.snapshot()
        if user_node_id not in nodes_all:
            return {"nodes": [], "links": [], "meta": {"source": "fallback", "depth": depth}}

        visited = {user_node_id}
        frontier = {user_node_id}
        used_links: List[Dict[str, Any]] = []

        def _is_allowed(node_id: str) -> bool:
            if node_id.startswith("usr_") and node_id != user_node_id:
                return False
            n = nodes_all.get(node_id)
            if not n:
                return False
            if n.get("label") == "BenchmarkRole":
                return False
            n_uid = n.get("properties", {}).get("user_id")
            if n_uid and str(n_uid) != str(user_id):
                return False
            return True

        for _ in range(depth):
            next_frontier = set()
            for link in links_all:
                source, target = link["source"], link["target"]
                if not _is_allowed(source) or not _is_allowed(target):
                    continue
                if source in frontier and target not in visited:
                    next_frontier.add(target)
                    used_links.append(link)
                elif target in frontier and source not in visited:
                    next_frontier.add(source)
                    used_links.append(link)
                elif source in frontier or target in frontier:
                    used_links.append(link)
            visited |= next_frontier
            frontier = next_frontier
            if not frontier:
                break

        nodes_map = {
            nid: nodes_all[nid]
            for nid in visited
            if nid in nodes_all and _is_allowed(nid)
        }
        return self._serialize_subgraph(nodes_map, used_links, limit)

    def _serialize_subgraph(
        self,
        nodes_map: Dict[str, Dict[str, Any]],
        links: Iterable[Dict[str, Any]],
        limit: int,
    ) -> Dict[str, Any]:
        nodes: List[Dict[str, Any]] = []
        for node_id, node in list(nodes_map.items())[:limit]:
            label = node.get("label") or "Topic"
            props = node.get("properties") or {}
            nodes.append(
                {
                    "id": node_id,
                    "name": node.get("name") or node_id,
                    "label": label,
                    "val": NODE_SIZES.get(label, 10),
                    "color": NODE_COLORS.get(label, "#06b6d4"),
                    "properties": props,
                }
            )
        allowed = {n["id"] for n in nodes}
        out_links: List[Dict[str, Any]] = []
        seen = set()
        for link in links:
            source, target = link.get("source"), link.get("target")
            if source not in allowed or target not in allowed:
                continue
            key = (source, target, link.get("label"))
            if key in seen:
                continue
            seen.add(key)
            out_links.append(
                {
                    "source": source,
                    "target": target,
                    "label": link.get("label") or "RELATED_TO",
                    "properties": link.get("properties") or {},
                }
            )
        return {
            "nodes": nodes,
            "links": out_links,
            "meta": {"source": "neo4j" if neo4j_client.available else "fallback"},
        }

    async def get_user_skills(self, user_id: str) -> List[Dict[str, Any]]:
        if await self._neo():
            try:
                rows = await neo4j_client.run(
                    "MATCH (u:Entity {id:$uid})-[r:REL {label:'HAS_SKILL'}]->(s:Entity) "
                    "RETURN s.name AS name, s.normalized_name AS normalized_name, "
                    "s.category AS category, coalesce(r.proficiency, s.proficiency, 'Intermediate') AS proficiency",
                    {"uid": f"usr_{user_id}"},
                )
                if rows:
                    return rows
            except Exception:
                pass

        nodes, links = self.store.snapshot()
        result = []
        for link in links:
            if link["source"] == f"usr_{user_id}" and link["label"] == "HAS_SKILL":
                node = nodes.get(link["target"])
                if node:
                    props = node.get("properties", {})
                    result.append(
                        {
                            "name": node.get("name"),
                            "normalized_name": props.get("normalized_name")
                            or _norm(node.get("name", "")),
                            "category": props.get("category", "General"),
                            "proficiency": link.get("properties", {}).get(
                                "proficiency", "Intermediate"
                            ),
                        }
                    )
        return result

    async def get_role_requirements(self, role_id: str) -> List[Dict[str, Any]]:
        if await self._neo():
            try:
                rows = await neo4j_client.run(
                    "MATCH (r:Entity {id:$rid})-[rel:REL {label:'BENCHMARK_REQUIRES'}]->(s:Entity) "
                    "RETURN s.name AS name, s.normalized_name AS normalized_name, "
                    "s.category AS category, coalesce(rel.importance,'Recommended') AS importance",
                    {"rid": role_id},
                )
                if rows:
                    return rows
            except Exception:
                pass

        nodes, links = self.store.snapshot()
        result = []
        for link in links:
            if link["source"] == role_id and link["label"] == "BENCHMARK_REQUIRES":
                node = nodes.get(link["target"])
                if node:
                    props = node.get("properties", {})
                    result.append(
                        {
                            "name": node.get("name"),
                            "normalized_name": props.get("normalized_name")
                            or _norm(node.get("name", "")),
                            "category": props.get("category", "General"),
                            "importance": link.get("properties", {}).get(
                                "importance", "Recommended"
                            ),
                        }
                    )
        return result

    async def get_benchmark_roles(self) -> List[Dict[str, Any]]:
        if await self._neo():
            try:
                rows = await neo4j_client.run(
                    "MATCH (r:Entity {label:'BenchmarkRole'})-[rel:REL {label:'BENCHMARK_REQUIRES'}]->(s) "
                    "RETURN r.id AS id, r.name AS title, count(s) AS required_count "
                    "ORDER BY title"
                )
                if rows:
                    return rows
            except Exception:
                pass

        nodes, links = self.store.snapshot()
        counts: Dict[str, int] = {}
        for link in links:
            if link["label"] == "BENCHMARK_REQUIRES":
                counts[link["source"]] = counts.get(link["source"], 0) + 1
        roles = []
        for node_id, node in nodes.items():
            if node.get("label") == "BenchmarkRole":
                roles.append(
                    {
                        "id": node_id,
                        "title": node.get("name"),
                        "required_count": counts.get(node_id, 0),
                    }
                )
        roles.sort(key=lambda item: item["title"] or "")
        return roles

    # -------------------------------------------------------- extraction ingest
    async def ingest_extracted_triples(
        self, user_id: str, extraction: Any, user_name: str = ""
    ) -> Dict[str, int]:
        data = extraction if isinstance(extraction, dict) else extraction.model_dump()
        entities = data.get("entities") or []
        relationships = data.get("relationships") or []

        name_to_id: Dict[str, str] = {}
        name_to_type: Dict[str, str] = {}

        user_node = f"usr_{user_id}"
        if user_name:
            name_to_id[_norm(user_name)] = user_node
            name_to_type[_norm(user_name)] = "User"

        for entity in entities:
            name = (entity.get("name") or "").strip()
            if not name:
                continue
            raw_type = (entity.get("entity_type") or "Skill").strip()
            canonical = ENTITY_TYPE_MAP.get(raw_type.lower(), "Skill")
            props = {
                "category": entity.get("category") or "General",
                "user_id": str(user_id) if canonical in {"Project", "Goal", "Person"} else None,
            }
            if canonical == "Skill":
                node_id = await self.upsert_skill(
                    user_id,
                    name,
                    entity.get("category") or "General",
                    entity.get("proficiency_or_role") or "Intermediate",
                )
            elif canonical == "Project":
                node_id = await self.create_project(
                    user_id, name, entity.get("proficiency_or_role") or ""
                )
            elif canonical == "Goal":
                node_id = await self.create_goal_node(
                    user_id, f"{_uid8(user_id)}_{_slug(name)}", name
                )
            elif canonical == "Topic":
                node_id = f"top_{_slug(_norm(name))}"
                await self._upsert_node(
                    node_id,
                    name,
                    "Topic",
                    {"normalized_name": _norm(name), "domain": entity.get("category") or "General"},
                )
            elif canonical == "Person":
                node_id = f"per_{_uid8(user_id)}_{_slug(name)}"
                await self._upsert_node(
                    node_id,
                    name,
                    "Person",
                    {"user_id": str(user_id), "role": entity.get("proficiency_or_role") or ""},
                )
                await self._add_link(user_node, node_id, "KNOWS_PERSON")
            else:  # Institution
                node_id = f"inst_{_slug(name)}"
                await self._upsert_node(
                    node_id,
                    name,
                    "Institution",
                    {"type": entity.get("category") or "Organization"},
                )
            name_to_id[_norm(name)] = node_id
            name_to_type[_norm(name)] = canonical

        created_links = 0
        for rel in relationships:
            source_name = _norm(rel.get("source_entity") or "")
            target_name = _norm(rel.get("target_entity") or "")
            if not source_name or not target_name:
                continue
            source_id = name_to_id.get(source_name)
            target_id = name_to_id.get(target_name)
            if not source_id or not target_id:
                continue
            rel_type = (rel.get("relationship") or "RELATED_TO").upper()
            details = rel.get("details") or ""

            if rel_type == "HAS_SKILL":
                await self._add_link(user_node, target_id, "HAS_SKILL", {"proficiency": details or "Intermediate"})
            elif rel_type == "USED_IN":
                source_type = name_to_type.get(source_name)
                target_type = name_to_type.get(target_name)
                if source_type == "Project" and target_type == "Skill":
                    await self._add_link(source_id, target_id, "UTILIZES", {"significance": "Core"})
                elif source_type == "Skill" and target_type == "Project":
                    await self._add_link(target_id, source_id, "UTILIZES", {"significance": "Core"})
                else:
                    await self._add_link(source_id, target_id, "USED_IN", {"details": details})
            elif rel_type == "ADVANCES":
                await self._add_link(source_id, target_id, "ADVANCES", {"details": details})
            elif rel_type == "REQUIRES_SKILL":
                await self._add_link(source_id, target_id, "REQUIRES_SKILL", {"details": details})
            elif rel_type == "COLLABORATED_WITH":
                await self._add_link(source_id, target_id, "COLLABORATED_WITH", {"contribution": details})
            elif rel_type == "STUDIED_AT":
                await self._add_link(user_node, target_id, "STUDIED_AT")
            else:
                await self._add_link(source_id, target_id, rel_type, {"details": details})
            created_links += 1

        return {
            "entities": len(name_to_id),
            "relationships": created_links,
        }

    async def record_skill_practice(self, user_id: str, skill_names: Iterable[str]) -> None:
        for name in skill_names:
            name = (name or "").strip()
            if not name:
                continue
            skill_id = f"skl_{_slug(_norm(name))}"
            await self._upsert_node(
                skill_id,
                name,
                "Skill",
                {"normalized_name": _norm(name), "category": "General"},
            )
            if await self._neo():
                try:
                    await neo4j_client.run(
                        "MATCH (u:Entity {id:$uid}), (s:Entity {id:$sid}) "
                        "MERGE (u)-[r:REL {label:'HAS_SKILL'}]->(s) "
                        "SET r.practice_count = coalesce(r.practice_count, 0) + 1",
                        {"uid": f"usr_{user_id}", "sid": skill_id},
                    )
                    continue
                except Exception:
                    pass
            self.store.add_link(f"usr_{user_id}", skill_id, "HAS_SKILL", {})
            nodes, links = self.store.snapshot()
            for link in links:
                if link["source"] == f"usr_{user_id}" and link["target"] == skill_id and link["label"] == "HAS_SKILL":
                    current = link["properties"].get("practice_count", 0)
                    link["properties"]["practice_count"] = current + 1
            self.store._save()

    async def get_graph_context(self, user_id: str) -> Dict[str, Any]:
        subgraph = await self.get_user_subgraph(user_id, depth=2, limit=200)
        skills = [n for n in subgraph["nodes"] if n["label"] == "Skill"]
        projects = [n for n in subgraph["nodes"] if n["label"] == "Project"]
        goals = [n for n in subgraph["nodes"] if n["label"] == "Goal"]
        topics = [n for n in subgraph["nodes"] if n["label"] == "Topic"]
        persons = [n for n in subgraph["nodes"] if n["label"] == "Person"]
        institutions = [n for n in subgraph["nodes"] if n["label"] == "Institution"]
        return {
            "nodes": subgraph["nodes"],
            "links": subgraph["links"],
            "skills": skills,
            "projects": projects,
            "goals": goals,
            "topics": topics,
            "persons": persons,
            "institutions": institutions,
        }

    # --------------------------------------------------------------- seeding
    async def seed_benchmark_roles(self) -> int:
        seeded = 0
        for role in BENCHMARK_ROLES:
            role_id = role["id"]
            await self._upsert_node(
                role_id,
                role["title"],
                "BenchmarkRole",
                {"description": role.get("description", "")},
            )
            for skill in role["skills"]:
                skill_id = f"skl_{_slug(_norm(skill['name']))}"
                await self._upsert_node(
                    skill_id,
                    skill["name"],
                    "Skill",
                    {
                        "normalized_name": _norm(skill["name"]),
                        "category": skill.get("category", "General"),
                    },
                )
                await self._add_link(
                    role_id,
                    skill_id,
                    "BENCHMARK_REQUIRES",
                    {"importance": skill.get("importance", "Recommended")},
                )
            seeded += 1
        return seeded

    @staticmethod
    def _canonical_label(label: str) -> str:
        for canonical in TYPED_LABELS:
            if canonical.lower() == (label or "").strip().lower():
                return canonical
        raise ValueError(f"Unsupported node label: {label}")


BENCHMARK_ROLES: List[Dict[str, Any]] = [
    {
        "id": "role_ai_systems_engineer",
        "title": "AI Systems Engineer",
        "description": "Designs, deploys and optimizes production ML inference systems.",
        "skills": [
            {"name": "Python", "category": "Language", "importance": "Mandatory"},
            {"name": "PyTorch", "category": "ML/AI", "importance": "Mandatory"},
            {"name": "Docker", "category": "DevOps", "importance": "Mandatory"},
            {"name": "FastAPI", "category": "Framework", "importance": "Mandatory"},
            {"name": "Distributed Systems", "category": "Topic", "importance": "Recommended"},
            {"name": "Triton Inference Server", "category": "ML/AI", "importance": "Recommended"},
            {"name": "Kubernetes", "category": "DevOps", "importance": "Recommended"},
            {"name": "Vector Databases", "category": "ML/AI", "importance": "Recommended"},
        ],
    },
    {
        "id": "role_fullstack_ml_engineer",
        "title": "Full-Stack ML Engineer",
        "description": "Builds end-to-end ML products from data pipeline to UI.",
        "skills": [
            {"name": "Python", "category": "Language", "importance": "Mandatory"},
            {"name": "TypeScript", "category": "Language", "importance": "Mandatory"},
            {"name": "React", "category": "Framework", "importance": "Mandatory"},
            {"name": "FastAPI", "category": "Framework", "importance": "Mandatory"},
            {"name": "PostgreSQL", "category": "Database", "importance": "Mandatory"},
            {"name": "PyTorch", "category": "ML/AI", "importance": "Recommended"},
            {"name": "Docker", "category": "DevOps", "importance": "Recommended"},
            {"name": "Next.js", "category": "Framework", "importance": "Recommended"},
        ],
    },
    {
        "id": "role_ml_research_scientist",
        "title": "ML Research Scientist",
        "description": "Advances model architectures and publishes novel research.",
        "skills": [
            {"name": "Python", "category": "Language", "importance": "Mandatory"},
            {"name": "PyTorch", "category": "ML/AI", "importance": "Mandatory"},
            {"name": "Deep Learning", "category": "Topic", "importance": "Mandatory"},
            {"name": "Mathematics", "category": "Topic", "importance": "Mandatory"},
            {"name": "Transformers", "category": "ML/AI", "importance": "Recommended"},
            {"name": "Research Writing", "category": "Soft Skill", "importance": "Recommended"},
        ],
    },
    {
        "id": "role_data_engineer",
        "title": "Data Engineer",
        "description": "Builds reliable batch and streaming data platforms.",
        "skills": [
            {"name": "Python", "category": "Language", "importance": "Mandatory"},
            {"name": "SQL", "category": "Language", "importance": "Mandatory"},
            {"name": "PostgreSQL", "category": "Database", "importance": "Mandatory"},
            {"name": "Apache Kafka", "category": "Data", "importance": "Recommended"},
            {"name": "Airflow", "category": "Data", "importance": "Recommended"},
            {"name": "Docker", "category": "DevOps", "importance": "Recommended"},
        ],
    },
    {
        "id": "role_backend_engineer",
        "title": "Backend Engineer",
        "description": "Designs scalable APIs and distributed backend services.",
        "skills": [
            {"name": "Python", "category": "Language", "importance": "Mandatory"},
            {"name": "FastAPI", "category": "Framework", "importance": "Mandatory"},
            {"name": "PostgreSQL", "category": "Database", "importance": "Mandatory"},
            {"name": "Redis", "category": "Database", "importance": "Recommended"},
            {"name": "Docker", "category": "DevOps", "importance": "Recommended"},
            {"name": "System Design", "category": "Topic", "importance": "Recommended"},
        ],
    },
    {
        "id": "role_devops_engineer",
        "title": "DevOps / Platform Engineer",
        "description": "Automates infrastructure, CI/CD and observability.",
        "skills": [
            {"name": "Docker", "category": "DevOps", "importance": "Mandatory"},
            {"name": "Kubernetes", "category": "DevOps", "importance": "Mandatory"},
            {"name": "Linux", "category": "Topic", "importance": "Mandatory"},
            {"name": "Terraform", "category": "DevOps", "importance": "Recommended"},
            {"name": "CI/CD", "category": "DevOps", "importance": "Recommended"},
            {"name": "Python", "category": "Language", "importance": "Recommended"},
        ],
    },
    {
        "id": "role_solutions_architect",
        "title": "Solutions Architect",
        "description": "Translates business needs into robust technical architectures.",
        "skills": [
            {"name": "System Design", "category": "Topic", "importance": "Mandatory"},
            {"name": "Cloud Architecture", "category": "Topic", "importance": "Mandatory"},
            {"name": "Communication", "category": "Soft Skill", "importance": "Mandatory"},
            {"name": "Python", "category": "Language", "importance": "Recommended"},
            {"name": "PostgreSQL", "category": "Database", "importance": "Recommended"},
        ],
    },
    {
        "id": "role_product_engineer",
        "title": "Product Engineer",
        "description": "Ships user-facing products with strong engineering fundamentals.",
        "skills": [
            {"name": "TypeScript", "category": "Language", "importance": "Mandatory"},
            {"name": "React", "category": "Framework", "importance": "Mandatory"},
            {"name": "Next.js", "category": "Framework", "importance": "Mandatory"},
            {"name": "PostgreSQL", "category": "Database", "importance": "Recommended"},
            {"name": "Product Thinking", "category": "Soft Skill", "importance": "Recommended"},
        ],
    },
    {
        "id": "role_robotics_engineer",
        "title": "Robotics Software Engineer",
        "description": "Builds perception, planning and control software for robots.",
        "skills": [
            {"name": "C++", "category": "Language", "importance": "Mandatory"},
            {"name": "Python", "category": "Language", "importance": "Mandatory"},
            {"name": "ROS", "category": "Framework", "importance": "Mandatory"},
            {"name": "Computer Vision", "category": "ML/AI", "importance": "Recommended"},
            {"name": "Control Systems", "category": "Topic", "importance": "Recommended"},
        ],
    },
    {
        "id": "role_genai_engineer",
        "title": "Generative AI Engineer",
        "description": "Builds RAG, agents and LLM-powered applications.",
        "skills": [
            {"name": "Python", "category": "Language", "importance": "Mandatory"},
            {"name": "LLMs", "category": "ML/AI", "importance": "Mandatory"},
            {"name": "RAG", "category": "ML/AI", "importance": "Mandatory"},
            {"name": "Vector Databases", "category": "ML/AI", "importance": "Mandatory"},
            {"name": "FastAPI", "category": "Framework", "importance": "Recommended"},
            {"name": "Prompt Engineering", "category": "ML/AI", "importance": "Recommended"},
        ],
    },
]


graph_engine = GraphEngine()
