#!/usr/bin/env bash

SCRIPT_NAME="deploy-openai-server.sh"
RUNTIME_BIN=""
SERVICE_NAME=""
HEALTH_URL=""
TEST_PROFILE="smoke"
ALLOW_DIRTY=0
PULL=1
DRY_RUN=0
VERBOSE=0
QUIET=0
JOURNAL_SINCE="10 minutes ago"
LOG_DIR="${TMPDIR:-/tmp}"
TEST_CMDS=()

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy-openai-server.sh --runtime-bin PATH [options]

Required:
  --runtime-bin PATH       Target runtime binary path to replace atomically.

Options:
  --service NAME           systemd service to restart after install.
  --health-url URL         Health URL to check after restart/install.
  --test-profile NAME      smoke|websearch|full|none. Default: smoke.
  --test-cmd CMD           Extra test command. Can be repeated.
  --allow-dirty            Allow deploy from a dirty working tree.
  --no-pull                Skip syncing the repo to origin (default: fast-forward to upstream).
  --dry-run                Show plan without changing anything.
  --verbose                Stream full command output to terminal and log.
  --quiet                  Print only compact status lines.
  --journal-since TEXT     journalctl --since value. Default: "10 minutes ago".
  -h, --help               Show this help.

Design:
  - No local server paths are hardcoded.
  - Runtime configuration is not edited.
  - Full command output is written to a log file.
  - Terminal output stays compact unless --verbose is used.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --runtime-bin)
      RUNTIME_BIN="${2:-}"
      shift 2
      ;;
    --runtime-bin=*)
      RUNTIME_BIN="${1#*=}"
      shift
      ;;
    --service)
      SERVICE_NAME="${2:-}"
      shift 2
      ;;
    --service=*)
      SERVICE_NAME="${1#*=}"
      shift
      ;;
    --health-url)
      HEALTH_URL="${2:-}"
      shift 2
      ;;
    --health-url=*)
      HEALTH_URL="${1#*=}"
      shift
      ;;
    --test-profile)
      TEST_PROFILE="${2:-}"
      shift 2
      ;;
    --test-profile=*)
      TEST_PROFILE="${1#*=}"
      shift
      ;;
    --test-cmd)
      TEST_CMDS+=("${2:-}")
      shift 2
      ;;
    --test-cmd=*)
      TEST_CMDS+=("${1#*=}")
      shift
      ;;
    --allow-dirty)
      ALLOW_DIRTY=1
      shift
      ;;
    --no-pull)
      PULL=0
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --verbose)
      VERBOSE=1
      shift
      ;;
    --quiet)
      QUIET=1
      shift
      ;;
    --journal-since)
      JOURNAL_SINCE="${2:-}"
      shift 2
      ;;
    --journal-since=*)
      JOURNAL_SINCE="${1#*=}"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "FAIL: unknown argument: $1"
      usage
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"
cd "$REPO_ROOT" || {
  echo "FAIL: cannot cd to repo root"
  exit 1
}

TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="${LOG_DIR%/}/clab-deploy-openai-${TS}.log"
BACKUP_PATH=""
STEP=0
FAILED=0
FAIL_LABEL=""

q() {
  printf "%q" "$1"
}

say() {
  if [ "$QUIET" != "1" ]; then
    printf '%s\n' "$*"
  fi
}

step_line() {
  STEP=$((STEP + 1))
  if [ "$QUIET" = "1" ]; then
    printf '[%02d] %s ... ' "$STEP" "$1"
  else
    printf '[%02d] %-30s ... ' "$STEP" "$1"
  fi
}

tail_log() {
  if [ -f "$LOG_FILE" ]; then
    echo
    echo "Last 60 log lines:"
    tail -n 60 "$LOG_FILE"
  fi
}

fail_now() {
  FAILED=1
  FAIL_LABEL="$1"
  echo "FAIL"
  echo
  echo "Failed step: $FAIL_LABEL"
  echo "Log: $LOG_FILE"
  tail_log
  print_rollback
  exit 1
}

run_logged() {
  label="$1"
  cmd="$2"

  step_line "$label"

  if [ "$DRY_RUN" = "1" ]; then
    echo "DRY-RUN"
    {
      echo
      echo "### DRY-RUN: $label"
      echo "$cmd"
    } >> "$LOG_FILE"
    return 0
  fi

  start="$(date +%s)"
  {
    echo
    echo "### STEP: $label"
    echo "### CMD: $cmd"
  } >> "$LOG_FILE"

  if [ "$VERBOSE" = "1" ]; then
    bash -lc "$cmd" 2>&1 | tee -a "$LOG_FILE"
    rc="${PIPESTATUS[0]}"
  else
    bash -lc "$cmd" >> "$LOG_FILE" 2>&1
    rc="$?"
  fi

  end="$(date +%s)"
  duration=$((end - start))

  if [ "$rc" = "0" ]; then
    echo "OK (${duration}s)"
    return 0
  fi

  echo "FAIL (${duration}s)"
  echo
  echo "Command failed with rc=$rc"
  echo "Log: $LOG_FILE"
  tail_log
  print_rollback
  exit "$rc"
}

print_rollback() {
  if [ -n "$BACKUP_PATH" ]; then
    echo
    echo "Rollback:"
    echo "  sudo cp -a $(q "$BACKUP_PATH") $(q "$RUNTIME_BIN")"
    if [ -n "$SERVICE_NAME" ]; then
      echo "  sudo systemctl restart $(q "$SERVICE_NAME")"
    fi
  fi
}

build_test_commands() {
  case "$TEST_PROFILE" in
    smoke)
      TEST_CMDS=("cargo test -p clab-cli --no-run" "${TEST_CMDS[@]}")
      ;;
    websearch)
      TEST_CMDS=("cargo test -p tools web_search -- --nocapture" "${TEST_CMDS[@]}")
      ;;
    full)
      TEST_CMDS=("cargo test -p clab-cli" "${TEST_CMDS[@]}")
      ;;
    none)
      ;;
    *)
      echo "FAIL: unknown --test-profile: $TEST_PROFILE"
      echo "Allowed: smoke, websearch, full, none"
      exit 2
      ;;
  esac
}

print_plan() {
  branch="$(git branch --show-current 2>/dev/null || true)"
  head="$(git rev-parse --short HEAD 2>/dev/null || true)"
  status="$(git status --short 2>/dev/null || true)"

  echo "Deploy plan"
  echo "  repo:        $REPO_ROOT"
  echo "  branch:      ${branch:-unknown}"
  echo "  head:        ${head:-unknown}"
  echo "  dirty:       $([ -n "$status" ] && echo yes || echo no)"
  echo "  runtime-bin: $RUNTIME_BIN"
  echo "  service:     ${SERVICE_NAME:-<none>}"
  echo "  health-url:  ${HEALTH_URL:-<none>}"
  echo "  tests:       $TEST_PROFILE"
  if [ "${#TEST_CMDS[@]}" -gt 0 ]; then
    for cmd in "${TEST_CMDS[@]}"; do
      echo "    - $cmd"
    done
  fi
  echo "  log:         $LOG_FILE"
  echo
}

if [ -z "$RUNTIME_BIN" ]; then
  echo "FAIL: --runtime-bin is required"
  usage
  exit 2
fi

build_test_commands

mkdir -p "$LOG_DIR" 2>/dev/null || true
touch "$LOG_FILE" 2>/dev/null || {
  echo "FAIL: cannot write log file: $LOG_FILE"
  exit 1
}

{
  echo "### $SCRIPT_NAME"
  echo "### started: $(date -Is)"
  echo "### repo: $REPO_ROOT"
} >> "$LOG_FILE"

print_plan

if [ "$DRY_RUN" = "1" ]; then
  echo "Dry-run only. No changes will be made."
fi

run_logged "repo check" "git rev-parse --show-toplevel >/dev/null && git log --oneline -1 && git status --short"

DIRTY_STATUS="$(git status --short)"
if [ -n "$DIRTY_STATUS" ] && [ "$ALLOW_DIRTY" != "1" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    say "WARN: repo is dirty; real deploy would stop unless --allow-dirty"
    say "$DIRTY_STATUS"
  else
    echo
    echo "FAIL: repo is dirty. Commit/stash first, or use --allow-dirty."
    echo "$DIRTY_STATUS"
    echo "Log: $LOG_FILE"
    exit 1
  fi
fi

if [ -n "$DIRTY_STATUS" ] && [ "$ALLOW_DIRTY" = "1" ]; then
  say "WARN: deploying dirty working tree"
fi

# Sync the checkout to origin so we always deploy current upstream (opt out with --no-pull).
if [ "$PULL" = "1" ] && [ -n "$DIRTY_STATUS" ]; then
  say "sync: working tree dirty; skipping pull"
elif [ "$PULL" = "1" ]; then
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  if [ -z "$upstream" ]; then
    say "sync: no upstream tracking branch; skipping pull"
  elif [ "$DRY_RUN" = "1" ]; then
    say "sync: would fast-forward to $upstream (dry-run)"
  else
    git fetch -q "${upstream%%/*}" 2>/dev/null || say "sync: WARN: git fetch failed; deploying current checkout"
    local_rev="$(git rev-parse @ 2>/dev/null || true)"
    remote_rev="$(git rev-parse '@{u}' 2>/dev/null || true)"
    base_rev="$(git merge-base @ '@{u}' 2>/dev/null || true)"
    if [ -n "$remote_rev" ] && [ "$local_rev" = "$remote_rev" ]; then
      say "sync: already up to date with $upstream"
    elif [ -n "$base_rev" ] && [ "$local_rev" = "$base_rev" ]; then
      if git merge --ff-only -q '@{u}' 2>/dev/null; then
        say "sync: fast-forwarded to $(git rev-parse --short @) ($upstream)"
      else
        say "sync: WARN: fast-forward failed; deploying current checkout"
      fi
    else
      say "sync: WARN: local branch diverged from $upstream; deploying current checkout"
    fi
  fi
fi

NEED_SUDO=0
if [ -n "$SERVICE_NAME" ]; then
  NEED_SUDO=1
fi
runtime_parent="$(dirname "$RUNTIME_BIN")"
if [ ! -w "$runtime_parent" ]; then
  NEED_SUDO=1
fi

if [ "$NEED_SUDO" = "1" ] && [ "$DRY_RUN" != "1" ]; then
  step_line "sudo preflight"
  sudo -v
  rc="$?"
  if [ "$rc" = "0" ]; then
    echo "OK"
  else
    echo "FAIL"
    echo "sudo preflight failed"
    exit "$rc"
  fi
fi

if [ "${#TEST_CMDS[@]}" -gt 0 ]; then
  i=0
  for cmd in "${TEST_CMDS[@]}"; do
    i=$((i + 1))
    run_logged "tests $i" "$cmd"
  done
else
  say "[--] tests skipped"
fi

run_logged "release build" "cargo build --release -p clab-cli"

SOURCE_BIN="$REPO_ROOT/target/release/clab"
run_logged "built binary version" "$(q "$SOURCE_BIN") --version | sed -n '1,20p'"

suffix="$TS"
if [ -n "$DIRTY_STATUS" ]; then
  suffix="dirty-$TS"
fi
BACKUP_PATH="${RUNTIME_BIN}.bak-${suffix}"
RUNTIME_NEW="${RUNTIME_BIN}.new"

run_logged "backup runtime binary" "if [ -f $(q "$RUNTIME_BIN") ]; then sudo cp -a $(q "$RUNTIME_BIN") $(q "$BACKUP_PATH"); else echo 'WARN: runtime binary does not exist yet'; fi"
run_logged "install runtime binary" "sudo install -D -m 755 $(q "$SOURCE_BIN") $(q "$RUNTIME_NEW") && $(q "$RUNTIME_NEW") --version | sed -n '1,20p' && sudo mv $(q "$RUNTIME_NEW") $(q "$RUNTIME_BIN")"

if [ -n "$SERVICE_NAME" ]; then
  run_logged "restart service" "sudo systemctl restart $(q "$SERVICE_NAME") && sleep 2 && systemctl is-active $(q "$SERVICE_NAME")"
else
  say "[--] service restart skipped"
fi

if [ -n "$HEALTH_URL" ]; then
  run_logged "health check" "curl -fsS --max-time 15 $(q "$HEALTH_URL")"
else
  say "[--] health check skipped"
fi

if [ -n "$SERVICE_NAME" ]; then
  run_logged "journal scan" "if journalctl -u $(q "$SERVICE_NAME") --since $(q "$JOURNAL_SINCE") --no-pager | grep -Ei 'panic|panicked|Cannot block|thread .* panicked'; then echo 'WARN: suspicious journal lines found'; else echo 'OK: no suspicious journal lines'; fi"
else
  say "[--] journal scan skipped"
fi

echo
if [ "$DRY_RUN" = "1" ]; then
  echo "Dry-run complete"
else
  echo "Deploy complete"
fi
echo "  commit:      $(git rev-parse --short HEAD)"
echo "  runtime-bin: $RUNTIME_BIN"
if [ -n "$BACKUP_PATH" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    echo "  planned backup: $BACKUP_PATH"
  else
    echo "  backup:      $BACKUP_PATH"
  fi
fi
if [ -n "$SERVICE_NAME" ]; then
  echo "  service:     $SERVICE_NAME"
fi
if [ -n "$HEALTH_URL" ]; then
  echo "  health-url:  $HEALTH_URL"
fi
echo "  log:         $LOG_FILE"
print_rollback

exit 0
