#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="$project_dir/backups"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/math_teaching-$timestamp.sql"

umask 077
mkdir -p "$backup_dir"

if ! docker compose -f "$project_dir/compose.yaml" --project-directory "$project_dir" \
  exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$backup_file"; then
  rm -f "$backup_file"
  echo "Database backup failed." >&2
  exit 1
fi

echo "Database backup created: $backup_file"
