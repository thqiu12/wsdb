# SchoolCore Local MVP

A SQLite-backed school management prototype with two server implementations:

- **`main.py` (FastAPI, recommended)** — modular routers under `routers/`,
  the active development target. Currently lacks XLSX/XLS export
  parity; previews return JSON.
- **`_legacy_server.py` (stdlib http.server)** — original 7700-line
  monolith, includes full document export pipeline. Frozen for
  bug fixes only; will be deleted once FastAPI reaches parity.

## Run (FastAPI)

```bash
python3 schoolcore_app/main.py
```

Or via uvicorn:

```bash
uvicorn main:app --app-dir schoolcore_app --host 127.0.0.1 --port 8765
```

Default URL: <http://127.0.0.1:8765> · API docs: `/api/docs`

## Run (legacy)

```bash
python3 -B schoolcore_app/_legacy_server.py
```

## Internal Trial Operations

### Admin Login

The admin UI requires a staff account login.

Seed accounts (`staff`, `immigration_report_staff`, `manager`) are created
on first run from environment variables. **Do not commit real credentials
to this repository.** Set the following before starting the server:

```bash
export SCHOOLCORE_SEED_STAFF_LOGIN=...
export SCHOOLCORE_SEED_STAFF_PASSWORD=...
export SCHOOLCORE_SEED_IMMIGRATION_LOGIN=...
export SCHOOLCORE_SEED_IMMIGRATION_PASSWORD=...
export SCHOOLCORE_SEED_MANAGER_LOGIN=...
export SCHOOLCORE_SEED_MANAGER_PASSWORD=...
```

If the seed script falls back to defaults, change every password
immediately after the first login.

### Daily Backup

Create a local backup package with the database, uploads, and exported files:

```bash
zsh schoolcore_app/scripts/backup_local_data.sh
```

Backups are stored in:

```text
schoolcore_app/backups/<timestamp>/
```

### Smoke Check

Run a quick API-level smoke check before internal trial use:

```bash
python3 schoolcore_app/scripts/internal_trial_smoke_check.py
```

Login is configured via the same `SCHOOLCORE_STAFF_LOGIN` /
`SCHOOLCORE_STAFF_PASSWORD` environment variables — no defaults are
shipped in this repository.

Optional student portal login verification:

```bash
SCHOOLCORE_STUDENT_LOGIN=... \
SCHOOLCORE_STUDENT_PASSWORD=... \
python3 schoolcore_app/scripts/internal_trial_smoke_check.py
```

## Implemented Business Behaviors

- Applicant list API
- Student list API
- Payment and receipt API
- COE case API
- AI COE check mock API
- COE full-file release block
- Audit logs

## COE Release Rule

Full COE cannot be sent until:

1. Full tuition payment is confirmed.
2. Required receipt is issued.

The API returns:

```json
{
  "error": {
    "code": "COE_RELEASE_BLOCKED",
    "message": "学費全額入金と領収書発行が完了していないため、COE全体を送付できません。"
  }
}
```

## Migrating Existing Databases

To add foreign key constraints to a database created before
`db.py` carried `FOREIGN KEY` clauses:

```bash
python3 schoolcore_app/scripts/migrate_add_foreign_keys.py --dry-run
python3 schoolcore_app/scripts/migrate_add_foreign_keys.py
```

The script makes a `<db>.bak.<timestamp>` copy first, rebuilds tables
with FKs, preserves all existing rows (including dangling references,
which are reported afterwards via `PRAGMA foreign_key_check`). The
migration is idempotent — tables already carrying FKs are skipped.

## Reset Demo Data

Stop the server, delete the database file, and start the server again.
The database will be recreated with seed data on next startup.

- FastAPI version: `data/schoolcore.db` (override via `DATA_DIR`)
- Legacy version: `schoolcore.sqlite3` in the app directory
