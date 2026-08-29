import os
import uuid
import json
import logging
import struct
import threading
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from database import get_engine

logger = logging.getLogger(__name__)

EMBEDDING_DIM = int(os.environ.get("MEMORY_VECTOR_DIM", "768"))

_model_lock = threading.Lock()
_embedding_model = None


def _get_embedding_model():
    """Lazy load and cache the embedding model (thread-safe)."""
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model

    with _model_lock:
        if _embedding_model is not None:
            return _embedding_model

        try:
            from text2vec import SentenceModel

            _embedding_model = SentenceModel()
            logger.info("Loaded text2vec SentenceModel")
            return _embedding_model
        except ImportError as e:
            logger.warning(f"text2vec not installed: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to load text2vec model: {e}")
            return None


def preload_embedding_model():
    """Warm the embedding model at process start to avoid first-request spikes."""
    return _get_embedding_model()


def _generate_embedding(text_str: str) -> Optional[List[float]]:
    """Generate embedding using text2vec."""
    model = _get_embedding_model()
    if model is None:
        return None

    try:
        embedding = model.encode(text_str)
        if hasattr(embedding, "tolist"):
            return embedding.tolist()
        return list(embedding)
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return None


def _serialize_f32(vector: list) -> bytes:
    """Serialize float list to compact binary for sqlite-vec."""
    return struct.pack(f"{len(vector)}f", *vector)


def _exec_raw(conn, sql: str, params: dict = None):
    """Execute raw SQL using the underlying sqlite3 connection."""
    raw_conn = conn.connection.dbapi_connection
    return raw_conn.execute(sql, params or {})


def _exec_raw_scalar(conn, sql: str, params: dict = None):
    """Execute raw SQL and return single scalar result."""
    raw_conn = conn.connection.dbapi_connection
    cursor = raw_conn.execute(sql, params or {})
    row = cursor.fetchone()
    return row[0] if row else None


def _exec_raw_all(conn, sql: str, params: dict = None) -> list:
    """Execute raw SQL and return all rows."""
    raw_conn = conn.connection.dbapi_connection
    cursor = raw_conn.execute(sql, params or {})
    return cursor.fetchall()


def store_memory(
    db: Session,
    agent_id: str,
    memory_type: str,
    content: Dict[str, Any],
    importance: float = 0.5,
    decay_rate: float = 0.01,
    tags: Optional[List[str]] = None,
) -> Optional[str]:
    """Store memory with dual-write to FTS5 and sqlite-vec."""
    memory_id = f"mem_{uuid.uuid4().hex[:12]}"

    content_text = json.dumps(content, ensure_ascii=False) if isinstance(content, dict) else str(content)

    embedding = _generate_embedding(content_text)

    now = datetime.now(timezone.utc)

    metadata_json = json.dumps({
        "source": "agent_memory",
        "version": 1,
        "tags": tags or [],
    })

    engine = get_engine()

    try:
        with engine.connect() as conn:
            _exec_raw(conn, "BEGIN")

            _exec_raw(conn, """
                INSERT INTO agent_memories (id, agent_id, memory_type, content, embedding,
                    importance, decay_rate, access_count, created_at, last_accessed, metadata)
                VALUES (:id, :agent_id, :memory_type, :content, :embedding,
                        :importance, :decay_rate, 0, :created_at, :last_accessed, :metadata)
            """, {
                "id": memory_id,
                "agent_id": agent_id,
                "memory_type": memory_type,
                "content": content_text,
                "embedding": ",".join(f"{v:.6f}" for v in embedding) if embedding else None,
                "importance": importance,
                "decay_rate": decay_rate,
                "created_at": now.isoformat(),
                "last_accessed": now.isoformat(),
                "metadata": metadata_json,
            })

            _exec_raw(conn,
                "INSERT INTO agent_memories_fts (content_text) VALUES (:content_text)",
                {"content_text": content_text}
            )

            if embedding:
                rowid = _exec_raw_scalar(conn, "SELECT last_insert_rowid()")
                vec_data = _serialize_f32(embedding)
                _exec_raw(conn,
                    f"INSERT INTO agent_memories_vec (rowid, embedding) VALUES (:rowid, :embedding)",
                    {"rowid": rowid, "embedding": vec_data}
                )

            conn.commit()

        return memory_id
    except Exception as e:
        logger.error(f"Failed to store memory: {e}")
        return None


def search_memory_semantic(
    db: Session,
    query: str,
    agent_id: Optional[str] = None,
    memory_type: Optional[str] = None,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """Semantic search using sqlite-vec KNN with cosine distance."""
    query_embedding = _generate_embedding(query)
    if not query_embedding:
        return []

    engine = get_engine()

    try:
        with engine.connect() as conn:
            vec_data = _serialize_f32(query_embedding)

            params = {"embedding": vec_data}
            where_parts = []

            if agent_id:
                where_parts.append("am.agent_id = :agent_id")
                params["agent_id"] = agent_id
            if memory_type:
                where_parts.append("am.memory_type = :memory_type")
                params["memory_type"] = memory_type

            where_clause = " AND ".join(where_parts) if where_parts else "1=1"

            sql = f"""
                SELECT am.id, am.agent_id, am.memory_type, am.content, am.embedding,
                       am.importance, am.decay_rate, am.access_count, am.created_at, am.last_accessed, am.metadata,
                       v.distance as score
                FROM (
                    SELECT rowid, distance
                    FROM agent_memories_vec
                    WHERE embedding MATCH :embedding ORDER BY distance
                    LIMIT :overfetch
                ) v
                JOIN agent_memories am ON v.rowid = am.rowid
                WHERE {where_clause}
                ORDER BY v.distance
                LIMIT :limit
            """

            params["overfetch"] = top_k * 3
            params["limit"] = top_k

            rows = _exec_raw_all(conn, sql, params)

            results = []
            for row in rows:
                results.append({
                    "memory_id": row[0],
                    "agent_id": row[1],
                    "memory_type": row[2],
                    "content": json.loads(row[3]) if row[3] else {"text": ""},
                    "content_text": row[3],
                    "embedding": row[4],
                    "importance": row[5],
                    "decay_rate": row[6],
                    "access_count": row[7],
                    "created_at": row[8],
                    "last_accessed": row[9],
                    "metadata": json.loads(row[10]) if row[10] else {},
                    "score": 1.0 - row[11],
                })

            return results
    except Exception as e:
        logger.error(f"Failed to semantic search: {e}")
        return []


def search_memory_keyword(
    db: Session,
    query: str,
    agent_id: Optional[str] = None,
    memory_type: Optional[str] = None,
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """Keyword search using FTS5 BM25 ranking."""
    engine = get_engine()

    try:
        with engine.connect() as conn:
            params = {"query": query}
            where_parts = []

            if agent_id:
                where_parts.append("am.agent_id = :agent_id")
                params["agent_id"] = agent_id
            if memory_type:
                where_parts.append("am.memory_type = :memory_type")
                params["memory_type"] = memory_type

            where_clause = " AND ".join(where_parts) if where_parts else "1=1"

            sql = f"""
                SELECT am.id, am.agent_id, am.memory_type, am.content, am.embedding,
                       am.importance, am.decay_rate, am.access_count, am.created_at, am.last_accessed, am.metadata,
                       fts.rank as score
                FROM agent_memories_fts fts
                JOIN agent_memories am ON fts.rowid = am.rowid
                WHERE fts MATCH :query AND {where_clause}
                ORDER BY fts.rank
                LIMIT :limit
            """

            params["limit"] = top_k

            rows = _exec_raw_all(conn, sql, params)

            results = []
            for row in rows:
                results.append({
                    "memory_id": row[0],
                    "agent_id": row[1],
                    "memory_type": row[2],
                    "content": json.loads(row[3]) if row[3] else {"text": ""},
                    "content_text": row[3],
                    "importance": row[4],
                    "decay_rate": row[5],
                    "access_count": row[6],
                    "created_at": row[7],
                    "last_accessed": row[8],
                    "metadata": json.loads(row[9]) if row[9] else {},
                    "score": float(row[10]),
                })

            return results
    except Exception as e:
        logger.error(f"Failed to keyword search: {e}")
        return []


def update_memory_access(db: Session, memory_id: str) -> bool:
    """Update memory access count and timestamp."""
    engine = get_engine()
    try:
        with engine.connect() as conn:
            _exec_raw(conn, """
                UPDATE agent_memories
                SET access_count = access_count + 1, last_accessed = :now
                WHERE id = :id
            """, {"now": datetime.now(timezone.utc).isoformat(), "id": memory_id})
            conn.commit()
        return True
    except Exception as e:
        logger.error(f"Failed to update memory access: {e}")
        return False


def delete_memory(db: Session, memory_id: str) -> bool:
    """Delete memory from all tables (main, FTS5, vec0)."""
    engine = get_engine()
    try:
        with engine.connect() as conn:
            rowid = _exec_raw_scalar(conn,
                "SELECT rowid FROM agent_memories WHERE id = :id",
                {"id": memory_id}
            )

            if not rowid:
                return False

            _exec_raw(conn, "DELETE FROM agent_memories WHERE id = :id", {"id": memory_id})
            _exec_raw(conn, "DELETE FROM agent_memories_fts WHERE rowid = :rowid", {"rowid": rowid})
            _exec_raw(conn, "DELETE FROM agent_memories_vec WHERE rowid = :rowid", {"rowid": rowid})
            conn.commit()
        return True
    except Exception as e:
        logger.error(f"Failed to delete memory: {e}")
        return False


def get_memory_stats(db: Session, agent_id: Optional[str] = None) -> Dict[str, Any]:
    """Get memory statistics."""
    engine = get_engine()
    try:
        with engine.connect() as conn:
            where = ""
            params = {}
            if agent_id:
                where = "WHERE agent_id = :agent_id"
                params = {"agent_id": agent_id}

            total = _exec_raw_scalar(conn, f"SELECT COUNT(*) FROM agent_memories {where}", params) or 0

            type_rows = _exec_raw_all(conn,
                f"SELECT memory_type, COUNT(*) as cnt FROM agent_memories {where} GROUP BY memory_type", params)
            by_type = {row[0]: row[1] for row in type_rows}

            avg_importance = _exec_raw_scalar(conn, f"SELECT AVG(importance) FROM agent_memories {where}", params) or 0.0

            total_access = _exec_raw_scalar(conn,
                f"SELECT COALESCE(SUM(access_count), 0) FROM agent_memories {where}", params) or 0

            return {
                "total": int(total),
                "by_type": by_type,
                "avg_importance": float(avg_importance),
                "total_access": int(total_access),
            }
    except Exception as e:
        logger.error(f"Failed to get memory stats: {e}")
        return {}
