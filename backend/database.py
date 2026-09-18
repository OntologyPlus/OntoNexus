import os
import json
import logging
import threading
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ontonexus.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

EMBEDDING_DIM = int(os.environ.get("MEMORY_VECTOR_DIM", "768"))

_engine = None

_local = threading.local()


def _create_engine():
    global _engine
    _engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
        pool_size=5,
        max_overflow=10,
        pool_recycle=3600,
        pool_pre_ping=True,
    )


def _get_engine():
    global _engine
    if _engine is None:
        _create_engine()
    return _engine


def _load_extensions(dbapi_conn, connection_record):
    """Load sqlite-vec extension on each new connection."""
    try:
        dbapi_conn.enable_load_extension(True)
    except Exception:
        logger.warning("Extension loading not available on this SQLite build")
        return

    try:
        import sqlite_vec
        sqlite_vec.load(dbapi_conn)
        logger.info("sqlite-vec extension loaded successfully")
    except ImportError:
        logger.warning("sqlite_vec not installed, vector search will not be available")
    except Exception as e:
        logger.error(f"Failed to load sqlite-vec: {e}")
    finally:
        try:
            dbapi_conn.enable_load_extension(False)
        except Exception:
            pass


@event.listens_for(_get_engine(), "connect")
def on_connect(dbapi_conn, connection_record):
    try:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()
    except Exception as e:
        logger.warning("Failed to apply SQLite pragmas: %s", e)
    _load_extensions(dbapi_conn, connection_record)


Base = declarative_base()


def SessionLocal():
    """创建数据库会话工厂函数"""
    engine = _get_engine()
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)()


def get_db():
    engine = _get_engine()
    db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield db
    finally:
        db.close()


def get_engine():
    return _get_engine()


def _add_column_if_not_exists(conn, table_name: str, column_name: str, column_def: str):
    """SQLite: Add column only if it doesn't exist."""
    try:
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}"))
        logger.info(f"Added column {column_name} to {table_name}")
    except Exception:
        pass


def _create_index_if_not_exists(conn, index_name: str, table_name: str, column_name: str):
    """SQLite: Create index only if it doesn't exist."""
    try:
        conn.execute(text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({column_name})"))
        logger.info(f"Created index {index_name} on {table_name}({column_name})")
    except Exception:
        pass


def create_tables():
    engine = _get_engine()
    from models.permission import ObjectPermission
    from models.decision import DecisionRecord, DecisionEdge, PolicyDefinition
    from models.provenance import ProvenanceRecord
    from models.domain_event import PersistedEvent
    from models.learning import SkillWeight, SkillOutcome
    from models.source_binding import SourceBinding  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _migrate_schema()
    _init_vector_tables()
    _ensure_execution_logs_table()


def _ensure_execution_logs_table():
    """Ensure execution_logs table exists with required columns."""
    engine = _get_engine()
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    if "execution_logs" not in existing_tables:
        from models.execution import ExecutionLog
        ExecutionLog.__table__.create(bind=engine)
        logger.info("Created execution_logs table")

    if "inference_rules" not in existing_tables:
        from models.inference import InferenceRule, InferenceResult
        InferenceRule.__table__.create(bind=engine)
        InferenceResult.__table__.create(bind=engine)
        logger.info("Created inference_rules and inference_results tables")


def _migrate_schema():
    """Migrate SQLite schema: add new columns and indexes."""
    engine = _get_engine()
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    with engine.begin() as conn:
        if "object_permissions" not in existing_tables:
            from models.permission import ObjectPermission
            ObjectPermission.__table__.create(bind=engine)
            logger.info("Created object_permissions table")

        if "ontology_change_requests" not in existing_tables:
            from models.ontology_change import OntologyChangeRequest
            OntologyChangeRequest.__table__.create(bind=engine)
            logger.info("Created ontology_change_requests table")

        if "ontology_versions" not in existing_tables:
            from models.ontology_change import OntologyVersion
            OntologyVersion.__table__.create(bind=engine)
            logger.info("Created ontology_versions table")

        if "object_links" in existing_tables:
            existing_columns = {col["name"] for col in inspector.get_columns("object_links")}

            if "confidence" not in existing_columns:
                _add_column_if_not_exists(conn, "object_links", "confidence", "FLOAT")
            if "valid_from" not in existing_columns:
                _add_column_if_not_exists(conn, "object_links", "valid_from", "VARCHAR")
            if "valid_to" not in existing_columns:
                _add_column_if_not_exists(conn, "object_links", "valid_to", "VARCHAR")
            if "provenance" not in existing_columns:
                _add_column_if_not_exists(conn, "object_links", "provenance", "VARCHAR")
            if "inverse_relation" not in existing_columns:
                _add_column_if_not_exists(conn, "object_links", "inverse_relation", "VARCHAR")

            _create_index_if_not_exists(conn, "idx_object_link_source", "object_links", "source_id")
            _create_index_if_not_exists(conn, "idx_object_link_target", "object_links", "target_id")
            _create_index_if_not_exists(conn, "idx_object_link_type", "object_links", "link_type")
            _create_index_if_not_exists(conn, "idx_link_source_type", "object_links", "source_id, link_type")
            _create_index_if_not_exists(conn, "idx_link_target_type", "object_links", "target_id, link_type")

        if "ontology_objects" in existing_tables:
            existing_columns = {col["name"] for col in inspector.get_columns("ontology_objects")}

            if "owner_id" not in existing_columns:
                _add_column_if_not_exists(conn, "ontology_objects", "owner_id", "VARCHAR")
            if "stakeholders" not in existing_columns:
                _add_column_if_not_exists(conn, "ontology_objects", "stakeholders", "TEXT")

            _create_index_if_not_exists(conn, "idx_ontology_object_type", "ontology_objects", "object_type")
            _create_index_if_not_exists(conn, "idx_ontology_status", "ontology_objects", "status")
            _create_index_if_not_exists(conn, "idx_ontology_owner_id", "ontology_objects", "owner_id")

        if "object_events" in existing_tables:
            _create_index_if_not_exists(conn, "idx_event_object_type", "object_events", "object_id, event_type")

        if "time_series_data" in existing_tables:
            _create_index_if_not_exists(conn, "idx_ts_object_series", "time_series_data", "object_id, series_name")

        if "object_actions" in existing_tables:
            _create_index_if_not_exists(conn, "idx_action_object_id", "object_actions", "object_id")

        if "action_proposals" in existing_tables:
            existing_columns = {col["name"] for col in inspector.get_columns("action_proposals")}

            if "execution_logs" not in existing_columns:
                _add_column_if_not_exists(conn, "action_proposals", "execution_logs", "TEXT")
            if "started_at" not in existing_columns:
                _add_column_if_not_exists(conn, "action_proposals", "started_at", "DATETIME")
            if "completed_at" not in existing_columns:
                _add_column_if_not_exists(conn, "action_proposals", "completed_at", "DATETIME")
            if "error_message" not in existing_columns:
                _add_column_if_not_exists(conn, "action_proposals", "error_message", "TEXT")
            if "idempotency_key" not in existing_columns:
                _add_column_if_not_exists(conn, "action_proposals", "idempotency_key", "VARCHAR")
            if "version" not in existing_columns:
                _add_column_if_not_exists(conn, "action_proposals", "version", "INTEGER DEFAULT 1")
            if "decision_id" not in existing_columns:
                _add_column_if_not_exists(conn, "action_proposals", "decision_id", "VARCHAR")
            if "case_id" not in existing_columns:
                _add_column_if_not_exists(conn, "action_proposals", "case_id", "VARCHAR")
            if "causation_id" not in existing_columns:
                _add_column_if_not_exists(conn, "action_proposals", "causation_id", "VARCHAR")
            if "risk_level" not in existing_columns:
                _add_column_if_not_exists(conn, "action_proposals", "risk_level", "VARCHAR")
            if "policy_version" not in existing_columns:
                _add_column_if_not_exists(conn, "action_proposals", "policy_version", "VARCHAR")
            _create_index_if_not_exists(conn, "idx_action_proposal_status", "action_proposals", "status")
            _create_index_if_not_exists(conn, "idx_action_proposal_entity", "action_proposals", "entity_id")
            _create_index_if_not_exists(conn, "idx_action_case", "action_proposals", "case_id")
            _create_index_if_not_exists(conn, "idx_action_decision", "action_proposals", "decision_id")

        if "decision_records" in existing_tables:
            existing_columns = {col["name"] for col in inspector.get_columns("decision_records")}
            if "case_id" not in existing_columns:
                _add_column_if_not_exists(conn, "decision_records", "case_id", "VARCHAR")
            _create_index_if_not_exists(conn, "idx_decision_case", "decision_records", "case_id")

        if "execution_logs" in existing_tables:
            existing_columns = {col["name"] for col in inspector.get_columns("execution_logs")}
            if "case_id" not in existing_columns:
                _add_column_if_not_exists(conn, "execution_logs", "case_id", "VARCHAR")
            _create_index_if_not_exists(conn, "idx_execution_case", "execution_logs", "case_id")
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_action_idempotency_key ON action_proposals (idempotency_key) WHERE idempotency_key IS NOT NULL"))

        if "doctors" in existing_tables:
            _create_index_if_not_exists(conn, "idx_doctor_influence", "doctors", "influence_score")
            _create_index_if_not_exists(conn, "idx_doctor_volume", "doctors", "prescription_volume")

        if "sales_targets" in existing_tables:
            _create_index_if_not_exists(conn, "idx_sales_target_rate", "sales_targets", "achievement_rate")

        if "visit_feedbacks" in existing_tables:
            _create_index_if_not_exists(conn, "idx_feedback_sentiment", "visit_feedbacks", "feedback_sentiment")

        if "skill_outcomes" in existing_tables:
            existing_columns = {col["name"] for col in inspector.get_columns("skill_outcomes")}
            if "evaluate_after" not in existing_columns:
                _add_column_if_not_exists(conn, "skill_outcomes", "evaluate_after", "DATETIME")
            if "evaluated_at" not in existing_columns:
                _add_column_if_not_exists(conn, "skill_outcomes", "evaluated_at", "DATETIME")
            _create_index_if_not_exists(conn, "idx_skill_outcome_eval", "skill_outcomes", "evaluate_after")

        if "audit_log" in existing_tables:
            existing_columns = {col["name"] for col in inspector.get_columns("audit_log")}
            if "prev_hash" not in existing_columns:
                _add_column_if_not_exists(conn, "audit_log", "prev_hash", "VARCHAR")
            if "record_hash" not in existing_columns:
                _add_column_if_not_exists(conn, "audit_log", "record_hash", "VARCHAR")
            if "causation_id" not in existing_columns:
                _add_column_if_not_exists(conn, "audit_log", "causation_id", "VARCHAR")
            if "decision_id" not in existing_columns:
                _add_column_if_not_exists(conn, "audit_log", "decision_id", "VARCHAR")


def _init_vector_tables():
    """Initialize FTS5 and sqlite-vec virtual tables for agent memories."""
    engine = _get_engine()
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))

        conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS agent_memories_fts USING fts5(
                content_text,
                content='agent_memories',
                content_rowid='rowid_col'
            )
        """))

        try:
            conn.execute(text(f"""
                CREATE VIRTUAL TABLE IF NOT EXISTS agent_memories_vec USING vec0(
                    embedding float[{EMBEDDING_DIM}]
                )
            """))
            logger.info(f"Created agent_memories_vec virtual table with {EMBEDDING_DIM}-dim vectors")
        except Exception as e:
            logger.warning(f"Could not create vec0 table (sqlite-vec may not be loaded): {e}")

        conn.commit()


def _serialize_f32(vector: list) -> bytes:
    """Serialize float list to compact binary for sqlite-vec."""
    import struct
    return struct.pack(f"{len(vector)}f", *vector)


def _deserialize_f32(data: bytes) -> list:
    """Deserialize compact binary back to float list."""
    import struct
    return list(struct.unpack(f"{len(data) // 4}f", data))
