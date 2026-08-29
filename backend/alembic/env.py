from logging.config import fileConfig
import os
from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from database import Base
import models.ontology
import models.domain
import models.user
import models.action
import models.notification
import models.audit
import models.chat
import models.scenario
import models.inference
import models.reminder
import models.agent

target_metadata = Base.metadata

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ontonexus.db")
config.set_main_option("sqlalchemy.url", f"sqlite:///{DB_PATH}")


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
