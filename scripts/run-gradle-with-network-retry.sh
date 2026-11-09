#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <gradle-command> [arguments...]" >&2
  exit 2
fi

max_attempts="${GRADLE_NETWORK_RETRY_ATTEMPTS:-5}"
if ! [[ "$max_attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "GRADLE_NETWORK_RETRY_ATTEMPTS must be a positive integer." >&2
  exit 2
fi

log_file="$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/hadir-gradle-retry.XXXXXX")"
trap 'rm -f "$log_file"' EXIT

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  echo "Gradle attempt $attempt/$max_attempts: $*"
  set +e
  "$@" 2>&1 | tee "$log_file"
  command_status="${PIPESTATUS[0]}"
  set -e

  if [ "$command_status" -eq 0 ]; then
    exit 0
  fi

  # Gradle may report transient repository failures in different formats:
  # its wrapper uses "HTTP response code", while Maven artifact resolution
  # commonly reports "Received status code 504" from a redirected host.
  if ! grep -Eiq 'HTTP response code: (502|503|504)|status code (502|503|504)|gateway[ -]time[- ]?out|connection reset|connection timed out|read timed out' "$log_file"; then
    echo "Gradle failed for a non-transient reason; not retrying." >&2
    exit "$command_status"
  fi

  if [ "$attempt" -eq "$max_attempts" ]; then
    echo "Gradle network failure persisted after $max_attempts attempts." >&2
    exit "$command_status"
  fi

  delay_seconds=$((attempt * 10))
  echo "Transient Gradle download/network failure detected; retrying in $delay_seconds seconds."
  sleep "$delay_seconds"
done
