"""Async Neo4j connection manager with graceful offline degradation."""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List, Optional

from app.core.config import settings


class Neo4jClient:
    def __init__(self) -> None:
        self.driver = None
        self.available: bool = False
        self._lock = asyncio.Lock()
        self._last_attempt: float = 0.0
        self._retry_interval: float = 20.0

    async def connect(self) -> bool:
        async with self._lock:
            if self.available and self.driver is not None:
                return True
            if not settings.NEO4J_ENABLED:
                self.available = False
                return False
            now = time.monotonic()
            if now - self._last_attempt < self._retry_interval:
                return False
            self._last_attempt = now
            try:
                from neo4j import AsyncGraphDatabase

                self.driver = AsyncGraphDatabase.driver(
                    settings.NEO4J_URI,
                    auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
                    connection_timeout=1.5,
                    max_connection_lifetime=300,
                )
                await asyncio.wait_for(
                    self.driver.verify_connectivity(), timeout=2.0
                )
                self.available = True
                return True
            except Exception:
                self.available = False
                if self.driver is not None:
                    try:
                        await self.driver.close()
                    except Exception:
                        pass
                    self.driver = None
                return False

    async def close(self) -> None:
        if self.driver is not None:
            try:
                await self.driver.close()
            except Exception:
                pass
        self.driver = None
        self.available = False

    async def run(
        self, query: str, params: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        if not self.available or self.driver is None:
            raise RuntimeError("Neo4j is not available")
        try:
            async with self.driver.session(
                database=settings.NEO4J_DATABASE
            ) as session:
                result = await session.run(query, params or {})
                return [record.data() async for record in result]
        except Exception:
            self.available = False
            self._last_attempt = time.monotonic()
            raise

    async def init_schema(self) -> None:
        if not self.available:
            return
        statements = [
            "CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE",
            "CREATE INDEX entity_label_idx IF NOT EXISTS FOR (n:Entity) ON (n.label)",
            "CREATE INDEX entity_user_idx IF NOT EXISTS FOR (n:Entity) ON (n.user_id)",
            "CREATE CONSTRAINT skill_normalized_unique IF NOT EXISTS FOR (s:Skill) REQUIRE s.normalized_name IS UNIQUE",
        ]
        for statement in statements:
            try:
                await self.run(statement)
            except Exception:
                continue


neo4j_client = Neo4jClient()
