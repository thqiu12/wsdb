#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR"
BACKUP_DIR="${APP_DIR}/backups"
STAMP="$(date '+%Y%m%d-%H%M%S')"
TARGET_DIR="${BACKUP_DIR}/${STAMP}"

mkdir -p "$TARGET_DIR"

if [[ -f "${APP_DIR}/schoolcore.sqlite3" ]]; then
  cp "${APP_DIR}/schoolcore.sqlite3" "${TARGET_DIR}/schoolcore.sqlite3"
fi

if [[ -d "${APP_DIR}/uploads" ]]; then
  mkdir -p "${TARGET_DIR}/uploads"
  cp -R "${APP_DIR}/uploads/." "${TARGET_DIR}/uploads/"
fi

if [[ -d "${APP_DIR}/exports" ]]; then
  mkdir -p "${TARGET_DIR}/exports"
  cp -R "${APP_DIR}/exports/." "${TARGET_DIR}/exports/"
fi

cat > "${TARGET_DIR}/README.txt" <<EOF
SchoolCore local backup
Created at: ${STAMP}
Source app dir: ${APP_DIR}

Included:
- schoolcore.sqlite3
- uploads/
- exports/
EOF

echo "Backup created: ${TARGET_DIR}"
