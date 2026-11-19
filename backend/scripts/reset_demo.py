"""Reset the demo database to its pristine storyline in a few seconds.

    cd backend && python -m scripts.reset_demo

Deletes the SQLite file (and -wal/-shm), recreates the schema and re-seeds, including the
demo storyline (hidden-risk doctor, scored history). Run it before and after every demo.
Refuses to run unless ENV is "demo"/"dev" (or unset) so it can never wipe a real database.
"""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def main() -> int:
    env = (os.environ.get("ENV") or "dev").lower()
    if env not in ("dev", "demo"):
        print(f"Refusing to reset: ENV={env!r} (only 'dev' or 'demo').")
        return 2

    from database import DB_PATH, get_engine

    get_engine().dispose()
    removed = []
    for suffix in ("", "-wal", "-shm"):
        path = DB_PATH + suffix
        if os.path.exists(path):
            os.remove(path)
            removed.append(os.path.basename(path))
    print("removed:", ", ".join(removed) or "(nothing)")

    import seed

    seed._seeded = False
    seed.seed_database()
    print("demo database re-seeded:", DB_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
