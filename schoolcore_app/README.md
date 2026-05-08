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
