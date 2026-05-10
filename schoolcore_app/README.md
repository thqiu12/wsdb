# SchoolCore Local MVP

This is a no-dependency local MVP prototype.

It uses:

- Python standard library HTTP server
- SQLite
- Plain HTML/CSS/JavaScript frontend

## Run

```bash
python3 -B schoolcore_app/server.py
```

Default URL:

```text
http://127.0.0.1:8765
```

The current development server may also be run with:

```bash
PORT=8766 python3 -B schoolcore_app/server.py
```

## Internal Trial Operations

### Admin Login

The admin UI now requires a staff account login.

Internal trial seed accounts:

- `yamada` / `Yamada2026!` (`staff`)
- `nakajima` / `Nakajima2026!` (`immigration_report_staff`)
- `admin` / `Admin2026!` (`manager`)

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

By default, the smoke check logs in with:

- `SCHOOLCORE_STAFF_LOGIN=yamada`
- `SCHOOLCORE_STAFF_PASSWORD=Yamada2026!`

Optional student portal login verification:

```bash
SCHOOLCORE_STUDENT_LOGIN=202604203 \
SCHOOLCORE_STUDENT_PASSWORD='Lin2030!' \
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

## Reset Demo Data

Stop the server, delete `schoolcore.sqlite3`, and start the server again.

The database will be recreated with seed data.
