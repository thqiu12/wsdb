#!/usr/bin/env python3
"""
既存 DB に外部キー制約を付与するマイグレーション。

手順:
1. <db>.bak.<timestamp> に物理コピー（rollback 用）
2. 全テーブルを rename → 新スキーマで再作成 → 共通カラムだけコピー → drop
3. PRAGMA foreign_key_check で違反データを検出してレポート

冪等: 既に新スキーマと一致するテーブルはスキップする。
失敗時はバックアップを残して終了するので手動復旧可能。

Usage:
    python3 schoolcore_app/scripts/migrate_add_foreign_keys.py
    python3 schoolcore_app/scripts/migrate_add_foreign_keys.py --dry-run
"""
from __future__ import annotations

import argparse
import re
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

# db.py を import するため schoolcore_app/ を path に通す
APP_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(APP_DIR))

from db import SCHEMA_SQL  # noqa: E402
from config import DB_PATH  # noqa: E402

TABLE_RE = re.compile(
    r"CREATE TABLE IF NOT EXISTS (\w+) \((.*?)\);", re.DOTALL
)


def parse_schema(schema_sql: str) -> dict[str, str]:
    """SCHEMA_SQL から {table_name: 'col_clause'} を抽出。"""
    out: dict[str, str] = {}
    for match in TABLE_RE.finditer(schema_sql):
        name = match.group(1)
        body = match.group(2).strip()
        out[name] = body
    return out


def existing_tables(cur: sqlite3.Cursor) -> set[str]:
    return {
        r[0]
        for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
    }


def column_names(cur: sqlite3.Cursor, table: str) -> list[str]:
    return [r[1] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()]


def table_has_foreign_keys(cur: sqlite3.Cursor, table: str) -> bool:
    return cur.execute(f"PRAGMA foreign_key_list({table})").fetchone() is not None


def backup_db(db_path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = db_path.with_suffix(db_path.suffix + f".bak.{timestamp}")
    shutil.copy2(db_path, backup)
    return backup


def migrate(db_path: Path, dry_run: bool = False) -> int:
    if not db_path.exists():
        print(f"[skip] DB が存在しません: {db_path}")
        return 0

    schema_tables = parse_schema(SCHEMA_SQL)
    fk_target_tables = [
        name for name, body in schema_tables.items() if "FOREIGN KEY" in body
    ]
    print(f"[info] FK 付与対象: {len(fk_target_tables)} テーブル")

    if dry_run:
        print("[dry-run] 実行内容:")
        print(f"  - backup: {db_path} -> {db_path}.bak.<ts>")
        print(f"  - rebuild: {', '.join(fk_target_tables)}")
        return 0

    backup = backup_db(db_path)
    print(f"[ok] backup: {backup}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # FK チェックを止めて再構築。WAL モードのままで OK。
    cur.execute("PRAGMA foreign_keys = OFF")
    cur.execute("BEGIN")

    try:
        existing = existing_tables(cur)
        rebuilt: list[str] = []
        skipped: list[str] = []

        for name in fk_target_tables:
            if name not in existing:
                # 新規テーブルなのでそのまま作成
                cur.execute(f"CREATE TABLE {name} ({schema_tables[name]})")
                rebuilt.append(f"{name} (created)")
                continue

            if table_has_foreign_keys(cur, name):
                # すでに FK 付き → 冪等のためスキップ
                skipped.append(name)
                continue

            old_cols = column_names(cur, name)
            tmp = f"_migrate_old_{name}"

            cur.execute(f"ALTER TABLE {name} RENAME TO {tmp}")
            cur.execute(f"CREATE TABLE {name} ({schema_tables[name]})")
            new_cols = column_names(cur, name)
            common = [c for c in old_cols if c in new_cols]
            cols_csv = ", ".join(common)
            cur.execute(
                f"INSERT INTO {name} ({cols_csv}) SELECT {cols_csv} FROM {tmp}"
            )
            cur.execute(f"DROP TABLE {tmp}")
            rebuilt.append(name)

        cur.execute("COMMIT")
        cur.execute("PRAGMA foreign_keys = ON")

        print(f"[ok] rebuilt: {len(rebuilt)} tables")
        for label in rebuilt:
            print(f"   - {label}")
        if skipped:
            print(f"[ok] skipped (already had FK): {len(skipped)} tables")

        violations = cur.execute("PRAGMA foreign_key_check").fetchall()
        if violations:
            print(f"[warn] FK 違反データを {len(violations)} 件検出（既存の dangling 参照）:")
            for v in violations[:20]:
                print(f"   table={v[0]} rowid={v[1]} parent={v[2]} fk_id={v[3]}")
            if len(violations) > 20:
                print(f"   ... 他 {len(violations) - 20} 件")
            print("[hint] 違反は SET NULL 制約で次回更新時に自動解消、または手動修正してください。")
        else:
            print("[ok] FK 違反なし")

    except Exception as exc:
        cur.execute("ROLLBACK")
        cur.execute("PRAGMA foreign_keys = ON")
        print(f"[error] migration failed: {exc}")
        print(f"[info] backup is preserved: {backup}")
        conn.close()
        return 1

    conn.commit()
    conn.execute("VACUUM")
    conn.close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--db", type=Path, default=DB_PATH, help=f"default: {DB_PATH}")
    args = parser.parse_args()
    return migrate(args.db, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
