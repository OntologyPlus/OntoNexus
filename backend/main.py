import os
import asyncio
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_tables, _get_engine
from sqlalchemy.orm import sessionmaker
from exceptions import OntoNexusError, OntologyValidationError, ActionExecutionError, PermissionDeniedError
from fastapi.responses import JSONResponse
from actions.hard_rules import HardRuleViolation
from actions.sod import SoDViolation

DEFAULT_ORIGINS = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,tauri://localhost,http://tauri.localhost,http://localhost:1420,http://localhost:1421,http://localhost:1422,http://localhost:1423,http://localhost:1424,http://0.0.0.0:5173"

from routers import health, auth, ontology, actions, chat, scenarios, inference, notifications, reminders, agent, reasoning, effects, ws, memory, perception, suggestions, insights, ontology_definition, events, ontology_admin, decisions, audit, eval_router, hub, ingest

def _get_db_session():
    engine = _get_engine()
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)()


def _count_warning_entities() -> int:
    db = _get_db_session()
    try:
        from models.ontology import OntologyObject
        return db.query(OntologyObject).filter(
            OntologyObject.status.in_(["warning", "critical"])
        ).count()
    finally:
        db.close()


def _run_learning_eval() -> int:
    db = _get_db_session()
    try:
        from decision.learning import evaluate_due_outcomes
        results = evaluate_due_outcomes(db)
        if results:
            db.commit()
            return len(results)
        db.rollback()
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def periodic_risk_scan():
    while True:
        await asyncio.sleep(300)
        try:
            warning_count = await asyncio.to_thread(_count_warning_entities)
            if warning_count > 0:
                from services.ws_manager import manager
                await manager.broadcast({
                    "type": "periodic_scan",
                    "data": {
                        "timestamp": asyncio.get_event_loop().time(),
                        "warning_entities": warning_count,
                        "message": f"发现 {warning_count} 个实体处于风险状态"
                    }
                })
        except Exception as e:
            logger.warning("Periodic scan error: %s", e)


async def periodic_learning_eval():
    while True:
        await asyncio.sleep(60)
        try:
            scored = await asyncio.to_thread(_run_learning_eval)
            if scored:
                logger.info("Evaluated %s skill outcomes", scored)
        except Exception as e:
            logger.warning("Learning eval error: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    from seed import seed_database
    seed_database()
    def _preload():
        try:
            from services.memory_service import preload_embedding_model
            preload_embedding_model()
        except Exception as e:
            logger.warning("Embedding model preload skipped: %s", e)
    asyncio.create_task(asyncio.to_thread(_preload))
    scan_task = asyncio.create_task(periodic_risk_scan())
    learn_task = asyncio.create_task(periodic_learning_eval())
    yield
    scan_task.cancel()
    learn_task.cancel()


app = FastAPI(title="OntoNexus API", version="1.0.0", lifespan=lifespan)


@app.exception_handler(OntoNexusError)
async def ontonexus_error_handler(request, exc):
    status_code = 403 if isinstance(exc, PermissionDeniedError) else 400
    return JSONResponse(status_code=status_code, content={"error": exc.message, "code": exc.code})


@app.exception_handler(HardRuleViolation)
async def hard_rule_handler(request, exc):
    return JSONResponse(status_code=400, content={"error": exc.message, "code": exc.rule_id})


@app.exception_handler(SoDViolation)
async def sod_handler(request, exc):
    return JSONResponse(status_code=400, content={"error": str(exc), "code": "HR-003"})

allowed_origins_str = os.environ.get("ALLOWED_ORIGINS", DEFAULT_ORIGINS)
allowed_cors_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]
if not allowed_cors_origins:
    allowed_cors_origins = ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(ontology.router)
app.include_router(actions.router)
app.include_router(chat.router)
app.include_router(scenarios.router)
app.include_router(inference.router)
app.include_router(notifications.router)
app.include_router(reminders.router)
app.include_router(agent.router)
app.include_router(reasoning.router)
app.include_router(effects.router)
app.include_router(ws.router)
app.include_router(memory.router)
app.include_router(perception.router)
app.include_router(suggestions.router)
app.include_router(insights.router)
app.include_router(ontology_definition.router)
app.include_router(events.router)
app.include_router(ontology_admin.router)
app.include_router(decisions.router)
app.include_router(audit.router)
app.include_router(eval_router.router)
app.include_router(hub.router)
app.include_router(ingest.router)
