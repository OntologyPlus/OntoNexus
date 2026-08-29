import time
import json
import logging
import threading
from typing import Dict, Any, Optional, List, Tuple
from copy import deepcopy
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class CacheEntry:
    def __init__(self, value: Any, ttl: Optional[float] = None):
        self.value = value
        self.created_at = time.time()
        self.ttl = ttl
        self.access_count = 0

    def is_expired(self) -> bool:
        if self.ttl is None:
            return False
        return time.time() - self.created_at > self.ttl

    def access(self) -> Any:
        self.access_count += 1
        return self.value


class OntologyCache:
    def __init__(self, default_ttl: float = 300, max_size: int = 1000):
        self._cache: Dict[str, CacheEntry] = {}
        self._default_ttl = default_ttl
        self._max_size = max_size
        self._lock = threading.Lock()
        self._stats = {"hits": 0, "misses": 0, "evictions": 0}

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                self._stats["misses"] += 1
                return None
            if entry.is_expired():
                del self._cache[key]
                self._stats["misses"] += 1
                self._stats["evictions"] += 1
                return None
            self._stats["hits"] += 1
            try:
                return deepcopy(entry.access())
            except Exception:
                return entry.access()

    def set(self, key: str, value: Any, ttl: Optional[float] = None):
        with self._lock:
            if len(self._cache) >= self._max_size and key not in self._cache:
                self._evict_one()
            self._cache[key] = CacheEntry(value, ttl or self._default_ttl)

    def delete(self, key: str):
        with self._lock:
            self._cache.pop(key, None)

    def delete_pattern(self, pattern: str):
        with self._lock:
            keys_to_delete = [k for k in self._cache if k.startswith(pattern)]
            for key in keys_to_delete:
                del self._cache[key]

    def clear(self):
        with self._lock:
            self._cache.clear()

    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            total = self._stats["hits"] + self._stats["misses"]
            hit_rate = (self._stats["hits"] / total * 100) if total > 0 else 0
            return {
                "size": len(self._cache),
                "maxSize": self._max_size,
                "hits": self._stats["hits"],
                "misses": self._stats["misses"],
                "hitRate": round(hit_rate, 1),
                "evictions": self._stats["evictions"],
            }

    def _evict_one(self):
        if not self._cache:
            return
        oldest_key = min(self._cache, key=lambda k: self._cache[k].created_at)
        del self._cache[oldest_key]
        self._stats["evictions"] += 1


ontology_cache = OntologyCache(default_ttl=300, max_size=500)


def _get_cache_table_name():
    return "ontology_cache"


def persist_cache_entry(key: str, value: dict):
    try:
        from database import _get_engine
        from sqlalchemy import text
        engine = _get_engine()
        with engine.connect() as conn:
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {_get_cache_table_name()} (
                    cache_key TEXT PRIMARY KEY,
                    cache_value TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    ttl_seconds INTEGER DEFAULT 300
                )
            """))
            conn.execute(text(f"""
                INSERT OR REPLACE INTO {_get_cache_table_name()} (cache_key, cache_value, created_at, ttl_seconds)
                VALUES (:key, :value, :created_at, :ttl)
            """), {"key": key, "value": json.dumps(value), "created_at": datetime.now(timezone.utc).isoformat(), "ttl": 300})
            conn.commit()
    except Exception as e:
        logger.debug(f"Cache persist failed for {key}: {e}")


def load_cached_entries() -> dict:
    try:
        from database import _get_engine
        from sqlalchemy import text
        engine = _get_engine()
        from sqlalchemy import inspect
        inspector = inspect(engine)
        if _get_cache_table_name() not in inspector.get_table_names():
            return {}

        result = {}
        with engine.connect() as conn:
            rows = conn.execute(text(f"SELECT cache_key, cache_value, created_at, ttl_seconds FROM {_get_cache_table_name()}")).fetchall()
            now = datetime.now(timezone.utc)
            for row in rows:
                try:
                    created = datetime.fromisoformat(row[2])
                    if (now - created).total_seconds() < row[3]:
                        result[row[0]] = json.loads(row[1])
                    else:
                        conn.execute(text(f"DELETE FROM {_get_cache_table_name()} WHERE cache_key = :key"), {"key": row[0]})
                except Exception:
                    pass
            conn.commit()
        return result
    except Exception as e:
        logger.debug(f"Cache load failed: {e}")
        return {}


def delete_cached_entry(key: str):
    try:
        from database import _get_engine
        from sqlalchemy import text
        engine = _get_engine()
        with engine.connect() as conn:
            conn.execute(text(f"DELETE FROM {_get_cache_table_name()} WHERE cache_key = :key"), {"key": key})
            conn.commit()
    except Exception as e:
        logger.debug(f"Cache delete failed for {key}: {e}")


def _clear_all_persisted_cache():
    try:
        from database import _get_engine
        from sqlalchemy import text
        engine = _get_engine()
        with engine.connect() as conn:
            conn.execute(text(f"DELETE FROM {_get_cache_table_name()}"))
            conn.commit()
    except Exception as e:
        logger.debug(f"Cache clear all persisted failed: {e}")


def get_cached_object(object_id: str) -> Optional[Dict[str, Any]]:
    return ontology_cache.get(f"obj:{object_id}")


def set_cached_object(object_id: str, data: Dict[str, Any]):
    ontology_cache.set(f"obj:{object_id}", data)
    persist_cache_entry(f"obj:{object_id}", data)


def invalidate_object_cache(object_id: str):
    ontology_cache.delete(f"obj:{object_id}")
    ontology_cache.delete_pattern(f"ctx:{object_id}")
    delete_cached_entry(f"obj:{object_id}")


def get_cached_context(object_id: str) -> Optional[Dict[str, Any]]:
    return ontology_cache.get(f"ctx:{object_id}")


def set_cached_context(object_id: str, data: Dict[str, Any]):
    ontology_cache.set(f"ctx:{object_id}", data, ttl=120)


def invalidate_all_cache():
    ontology_cache.clear()
    _clear_all_persisted_cache()


def _restore_from_db():
    entries = load_cached_entries()
    for key, value in entries.items():
        ontology_cache.set(key, value)


_restore_from_db()
