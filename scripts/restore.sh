#!/usr/bin/env bash
# SpicyPick PostgreSQL Restore Script
# Usage: ./scripts/restore.sh [backup_filename]
# If no filename given, lists available backups and prompts for selection.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/../api/.env}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
BACKUP_S3_ACCESS_KEY="${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}"
BACKUP_S3_SECRET_KEY="${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}"
BACKUP_S3_ENDPOINT="${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

s3() {
  AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
  AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
  aws s3 "$@" --endpoint-url "$BACKUP_S3_ENDPOINT"
}

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Available backups (newest last):"
  s3 ls "s3://${BACKUP_S3_BUCKET}/backups/" | sort | awk '{print NR". "$NF}' | tail -20
  echo ""
  read -r -p "Enter backup filename (e.g. spicypick_20240115_020000.sql.gz): " BACKUP_FILE
fi

# Strip any directory components to prevent path traversal (e.g. ../../etc/cron.d/root)
BACKUP_FILE=$(basename "$BACKUP_FILE")

# Restrict temp file permissions to owner-only (like backup.sh) to prevent other local users from reading the dump
umask 077
TEMP_FILE="/tmp/${BACKUP_FILE}"
# Ensure temp file is always removed on exit (success, failure, or signal)
trap 'rm -f "$TEMP_FILE"' EXIT

log "Downloading: s3://${BACKUP_S3_BUCKET}/backups/${BACKUP_FILE}"
s3 cp "s3://${BACKUP_S3_BUCKET}/backups/${BACKUP_FILE}" "$TEMP_FILE"

echo ""
echo "⚠️  WARNING: This will overwrite the current database!"
# Mask password in DATABASE_URL to avoid leaking credentials to terminal/logs
MASKED_URL=$(echo "$DATABASE_URL" | sed 's|://[^:]*:[^@]*@|://***:***@|')
echo "   DATABASE_URL: $MASKED_URL"
echo ""
read -r -p "Type 'yes' to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  log "Restore cancelled."
  exit 0
fi

log "Restoring database..."
# -v ON_ERROR_STOP=1: abort on first SQL error so partial restores are not silently reported as success
gunzip -c "$TEMP_FILE" | psql -v ON_ERROR_STOP=1 "$DATABASE_URL"

log "Restore completed successfully from: $BACKUP_FILE"
