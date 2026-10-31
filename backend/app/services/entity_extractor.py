"""Unstructured text -> knowledge graph triples.

Primary path uses local Ollama structured JSON output. A deterministic
keyword/regex extractor guarantees useful results when the LLM is offline.
"""

from __future__ import annotations

import re
from typing import Dict, List, Literal

from pydantic import BaseModel, Field

from app.services.llm_service import llm_service


class ExtractedEntity(BaseModel):
    name: str = Field(description="Normalized entity name")
    entity_type: Literal[
        "Skill", "Project", "Goal", "Topic", "Person", "Institution"
    ] = "Skill"
    category: str = "General"
    proficiency_or_role: str = "Intermediate"


class ExtractedRelation(BaseModel):
    source_entity: str
    relationship: str = "USED_IN"
    target_entity: str
    details: str = ""


class KnowledgeExtractionResult(BaseModel):
    entities: List[ExtractedEntity] = []
    relationships: List[ExtractedRelation] = []


EXTRACTION_SYSTEM_PROMPT = """You are an expert Knowledge Graph Extraction Engine for OmniLife Digital Twin.
Analyze the user's text (resume, project notes, or journal) and extract structured knowledge graph entities and typed relationships.

Rules:
- Extract only factual entities explicitly mentioned. Never hallucinate.
- Normalize names (e.g. 'React.js', 'ReactJS', 'react' -> 'React'; 'fastapi' -> 'FastAPI').
- entity_type must be one of: Skill, Project, Goal, Topic, Person, Institution.
- relationship must be one of: HAS_SKILL, USED_IN, ADVANCES, REQUIRES_SKILL, COLLABORATED_WITH, STUDIED_AT.
- Return JSON with exactly two keys: "entities" and "relationships".
- Each entity: {"name", "entity_type", "category", "proficiency_or_role"}.
- Each relationship: {"source_entity", "relationship", "target_entity", "details"}.
"""

ALIASES: Dict[str, str] = {
    "react.js": "React",
    "reactjs": "React",
    "react": "React",
    "nextjs": "Next.js",
    "next.js": "Next.js",
    "fast api": "FastAPI",
    "fastapi": "FastAPI",
    "pytorch": "PyTorch",
    "tensorflow": "TensorFlow",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "postgre sql": "PostgreSQL",
    "k8s": "Kubernetes",
    "kubernetes": "Kubernetes",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "neo4j": "Neo4j",
    "chromadb": "ChromaDB",
    "chroma db": "ChromaDB",
    "ollama": "Ollama",
    "langchain": "LangChain",
    "triton": "Triton Inference Server",
    "ros": "ROS",
    "c++": "C++",
    "c#": "C#",
}

SKILL_KEYWORDS: Dict[str, tuple] = {
    "python": ("Python", "Language"),
    "java": ("Java", "Language"),
    "c++": ("C++", "Language"),
    "c#": ("C#", "Language"),
    "javascript": ("JavaScript", "Language"),
    "typescript": ("TypeScript", "Language"),
    "sql": ("SQL", "Language"),
    "go": ("Go", "Language"),
    "rust": ("Rust", "Language"),
    "react": ("React", "Framework"),
    "next.js": ("Next.js", "Framework"),
    "nextjs": ("Next.js", "Framework"),
    "fastapi": ("FastAPI", "Framework"),
    "django": ("Django", "Framework"),
    "flask": ("Flask", "Framework"),
    "node.js": ("Node.js", "Framework"),
    "ros": ("ROS", "Framework"),
    "pytorch": ("PyTorch", "ML/AI"),
    "tensorflow": ("TensorFlow", "ML/AI"),
    "transformers": ("Transformers", "ML/AI"),
    "llm": ("LLMs", "ML/AI"),
    "llms": ("LLMs", "ML/AI"),
    "rag": ("RAG", "ML/AI"),
    "computer vision": ("Computer Vision", "ML/AI"),
    "deep learning": ("Deep Learning", "Topic"),
    "machine learning": ("Machine Learning", "Topic"),
    "nlp": ("NLP", "ML/AI"),
    "docker": ("Docker", "DevOps"),
    "kubernetes": ("Kubernetes", "DevOps"),
    "terraform": ("Terraform", "DevOps"),
    "ci/cd": ("CI/CD", "DevOps"),
    "linux": ("Linux", "Topic"),
    "postgresql": ("PostgreSQL", "Database"),
    "postgres": ("PostgreSQL", "Database"),
    "mysql": ("MySQL", "Database"),
    "redis": ("Redis", "Database"),
    "mongodb": ("MongoDB", "Database"),
    "neo4j": ("Neo4j", "Database"),
    "chromadb": ("ChromaDB", "ML/AI"),
    "vector database": ("Vector Databases", "ML/AI"),
    "vector databases": ("Vector Databases", "ML/AI"),
    "kafka": ("Apache Kafka", "Data"),
    "airflow": ("Airflow", "Data"),
    "spark": ("Apache Spark", "Data"),
    "distributed systems": ("Distributed Systems", "Topic"),
    "system design": ("System Design", "Topic"),
    "microservices": ("Microservices", "Topic"),
    "api": ("API Design", "Topic"),
    "prompt engineering": ("Prompt Engineering", "ML/AI"),
    "communication": ("Communication", "Soft Skill"),
    "leadership": ("Leadership", "Soft Skill"),
}

INSTITUTION_KEYWORDS = [
    "university",
    "institute",
    "college",
    "school",
    "google",
    "microsoft",
    "amazon",
    "meta",
    "openai",
    "deepmind",
    "nvidia",
    "ibm",
]

PROJECT_PATTERNS = [
    r"(?:built|developed|created|designed|implemented|launched|shipped)\s+(?:a|an|the)?\s*([A-Za-z0-9][^.,;\n]{3,70})",
    r"project\s+(?:called|named)\s+([A-Za-z0-9][^.,;\n]{2,60})",
]

GOAL_PATTERNS = [
    r"goal of\s+([^.,;\n]{3,80})",
    r"(?:aiming|working)\s+to\s+([^.,;\n]{3,80})",
    r"to\s+(?:become|master|land|achieve|build)\s+([^.,;\n]{3,80})",
]


def _canonical(name: str) -> str:
    key = " ".join(name.strip().lower().split())
    return ALIASES.get(key, name.strip())


def _sentence_case(value: str) -> str:
    value = value.strip(" .-")
    return value[:1].upper() + value[1:] if value else value


def _heuristic_extract(text: str, user_name: str = "") -> KnowledgeExtractionResult:
    lowered = text.lower()
    entities: Dict[str, ExtractedEntity] = {}
    relationships: List[ExtractedRelation] = []

    for keyword, (name, category) in SKILL_KEYWORDS.items():
        pattern = r"(?<![a-z0-9])" + re.escape(keyword) + r"(?![a-z0-9])"
        if re.search(pattern, lowered):
            entities[name.lower()] = ExtractedEntity(
                name=name, entity_type="Skill", category=category
            )

    projects: List[str] = []
    for pattern in PROJECT_PATTERNS:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            title = _sentence_case(match.group(1))
            title = re.split(r"\s+(?:using|with|to|that|which|and)\s+", title)[0].strip()
            if 3 <= len(title) <= 70 and title.lower() not in projects:
                projects.append(title.lower())
                entities[f"project:{title.lower()}"] = ExtractedEntity(
                    name=title, entity_type="Project", category="Project"
                )

    goals: List[str] = []
    for pattern in GOAL_PATTERNS:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            title = _sentence_case(match.group(1))
            title = re.split(r"\s+(?:by|using|with|through)\s+", title)[0].strip()
            if 3 <= len(title) <= 80 and title.lower() not in goals:
                goals.append(title.lower())
                entities[f"goal:{title.lower()}"] = ExtractedEntity(
                    name=title, entity_type="Goal", category="Career"
                )

    for institution in INSTITUTION_KEYWORDS:
        pattern = r"(?<![a-z0-9])" + re.escape(institution) + r"(?![a-z0-9])"
        if re.search(pattern, lowered):
            name = institution.title()
            entities[f"institution:{name.lower()}"] = ExtractedEntity(
                name=name, entity_type="Institution", category="Organization"
            )

    skill_names = [e.name for e in entities.values() if e.entity_type == "Skill"]
    project_names = [e.name for e in entities.values() if e.entity_type == "Project"]
    goal_names = [e.name for e in entities.values() if e.entity_type == "Goal"]

    for skill in skill_names:
        relationships.append(
            ExtractedRelation(
                source_entity=user_name or "User",
                relationship="HAS_SKILL",
                target_entity=skill,
                details="Mentioned in document",
            )
        )
    for project in project_names:
        for skill in skill_names:
            relationships.append(
                ExtractedRelation(
                    source_entity=project,
                    relationship="USED_IN",
                    target_entity=skill,
                    details="Used together in described work",
                )
            )
        for goal in goal_names:
            relationships.append(
                ExtractedRelation(
                    source_entity=project,
                    relationship="ADVANCES",
                    target_entity=goal,
                    details="Project contributes to stated goal",
                )
            )

    return KnowledgeExtractionResult(
        entities=list(entities.values()), relationships=relationships
    )


async def extract_knowledge_triples(
    text: str, user_name: str = ""
) -> KnowledgeExtractionResult:
    if not text or not text.strip():
        return KnowledgeExtractionResult()

    prompt = (
        f"User name: {user_name or 'the user'}\n"
        "Extract the knowledge graph from the following text:\n\n"
        f"{text[:8000]}"
    )
    raw = await llm_service.chat_json(prompt, system=EXTRACTION_SYSTEM_PROMPT)
    if raw:
        try:
            result = KnowledgeExtractionResult.model_validate(raw)
            if result.entities:
                for entity in result.entities:
                    entity.name = _canonical(entity.name)
                return result
        except Exception:
            pass

    return _heuristic_extract(text, user_name)
