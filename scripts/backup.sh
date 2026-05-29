#!/usr/bin/env bash
# SpicyPick PostgreSQL Backup Script
# Runs: pg_dump → gzip → S3 upload → retention cleanup → failure notification
# Schedule: daily at 02:00 UTC via cron or Coolify scheduled job

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/../api/.env}"

# Load env from api/.env if not already set (supports running via cron)
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# Required vars
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
BACKUP_S3_ACCESS_KEY="${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}"
BACKUP_S3_SECRET_KEY="${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}"
BACKUP_S3_ENDPOINT="${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Optional failure notification
RESEND_API_KEY="${RESEND_API_KEY:-}"
BACKUP_NOTIFY_EMAIL="${BACKUP_NOTIFY_EMAIL:-}"
FROM_EMAIL="${FROM_EMAIL:-backup@spicypick.app}"

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

notify_failure() {
  local message="$1"
  log "ERROR: $message"

  if [ -z "$RESEND_API_KEY" ] || [ -z "$BACKUP_NOTIFY_EMAIL" ]; then
    log "WARN: RESEND_API_KEY or BACKUP_NOTIFY_EMAIL not set — skipping email notification"
    return 0
  fi

  curl -s -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"from\": \"$FROM_EMAIL\",
      \"to\": [\"$BACKUP_NOTIFY_EMAIL\"],
      \"subject\": \"[SpicyPick] DB Backup FAILED — $(date -u '+%Y-%m-%d')\",
      \"html\": \"<p>SpicyPick PostgreSQL backup failed on <strong>$(date -u '+%Y-%m-%d %H:%M UTC')</strong>.</p><p><strong>Error:</strong> ${message}</p><p>Please check the server logs and run the backup manually.</p>\"
    }" > /dev/null || log "WARN: Failed to send failure notification email"
}

# ── Main ──────────────────────────────────────────────────────────────────────
TIMESTAMP=$(date -u '+%Y%m%d_%H%M%S')
BACKUP_FILE="spicypick_${TIMESTAMP}.sql.gz"
TEMP_FILE="/tmp/${BACKUP_FILE}"

log "Starting backup: $BACKUP_FILE"

# Step 1: pg_dump → gzip
log "Running pg_dump..."
if ! pg_dump "$DATABASE_URL" | gzip -9 > "$TEMP_FILE"; then
  notify_failure "pg_dump failed"
  exit 1
fi

BACKUP_SIZE=$(du -sh "$TEMP_FILE" | cut -f1)
log "Backup created: $TEMP_FILE ($BACKUP_SIZE)"

# Step 2: Upload to S3
log "Uploading to S3: s3://$BACKUP_S3_BUCKET/backups/$BACKUP_FILE"

AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
aws s3 cp "$TEMP_FILE" \
  "s3://${BACKUP_S3_BUCKET}/backups/${BACKUP_FILE}" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" \
  --storage-class STANDARD 2>&1 | while IFS= read -r line; do log "  s3: $line"; done

UPLOAD_EXIT=${PIPESTATUS[0]}
rm -f "$TEMP_FILE"

if [ "$UPLOAD_EXIT" -ne 0 ]; then
  notify_failure "S3 upload failed (exit $UPLOAD_EXIT)"
  exit 1
fi

log "Upload successful"

# Step 3: Retention — delete backups older than BACKUP_RETENTION_DAYS
log "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."

CUTOFF_DATE=$(date -u -d "${BACKUP_RETENTION_DAYS} days ago" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null \
  || date -u -v-"${BACKUP_RETENTION_DAYS}"d '+%Y-%m-%dT%H:%M:%SZ')  # macOS fallback

DELETED=0
while IFS= read -r line; do
  KEY=$(echo "$line" | awk '{print $NF}')
  LAST_MOD=$(echo "$line" | awk '{print $1"T"$2"Z"}')

  if [[ "$LAST_MOD" < "$CUTOFF_DATE" ]]; then
    AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
    AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
    aws s3 rm "s3://${BACKUP_S3_BUCKET}/${KEY}" \
      --endpoint-url "$BACKUP_S3_ENDPOINT" > /dev/null 2>&1 && {
      log "  Deleted old backup: $KEY"
      DELETED=$((DELETED + 1))
    }
  fi
done < <(
  AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
  AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
  aws s3 ls "s3://${BACKUP_S3_BUCKET}/backups/" \
    --endpoint-url "$BACKUP_S3_ENDPOINT" 2>/dev/null || true
)

log "Cleanup done: $DELETED old backup(s) deleted"
log "Backup completed successfully: $BACKUP_FILE ($BACKUP_SIZE)"
