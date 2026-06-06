#!/usr/bin/env bash
# install-openai-service.sh — install, configure, or remove the Claw Lab
# OpenAI-compatible service (systemd unit + env file + wrapper).
#
# Modes:
#   (install — default)  Write the env file (single source of truth), wrapper, and
#       systemd unit; optionally install a prebuilt binary and enable/restart the
#       service. Run with no required flags on a terminal to get an interactive
#       wizard; pass flags for non-interactive / CI use.
#   --uninstall          Stop and disable the service, then remove the unit,
#       wrapper, env file, and runtime binary. By default also removes the
#       work/sandbox directories and *.bak-* backups (use --keep-data to keep them).
#
# Nothing here hardcodes a host: every path and name is a flag with a portable
# claw-lab-* default, so the fork stays movable across machines.
set -euo pipefail

# --- defaults (claw-lab-* canon; all overridable via flags) ---
SERVICE_NAME="claw-lab-openai.service"
USER_NAME="$(id -un)"
GROUP_NAME=""
RUNTIME_BIN="/opt/claw-lab/bin/clab"
# A freshly built binary to install at RUNTIME_BIN. install.sh passes this via
# CLAB_RUNTIME_BIN_SRC for end-to-end setup; --runtime-bin-src overrides it.
RUNTIME_BIN_SRC="${CLAB_RUNTIME_BIN_SRC:-}"
WRAPPER_PATH="/usr/local/bin/claw-lab-openai-serve"
ENV_FILE="/etc/claw-lab/openai.env"
WORKDIR="/var/lib/claw-lab/work"
SANDBOX_DIR="/var/lib/claw-lab/sandbox"
TMPDIR_VALUE=""
BIND="127.0.0.1:4097"
OPENAI_BASE_URL=""
BACKEND_MODEL=""
SERVED_MODEL_ID="clab-agent"
PERMISSION_MODE="read-only"
WEBSEARCH_URL=""
API_KEY=""
ENABLE_SERVICE=0
RESTART_SERVICE=0
DRY_RUN=0
UNINSTALL=0
ASSUME_YES=0
KEEP_DATA=0

usage() {
  cat <<'USAGE'
Usage:
  install-openai-service.sh [options]              # install / configure
  install-openai-service.sh --uninstall [options]  # remove the service

Install (no required flags on a terminal -> interactive wizard):
  --base-url URL              OpenAI-compatible backend base URL
  --backend-model MODEL       backend/adaptor model id sent to the provider
  --served-model-id MODEL     model id exposed to clients. Default: clab-agent.

Common options:
  --service NAME              systemd service name. Default: claw-lab-openai.service
  --user USER                 service user. Default: current user.
  --group GROUP               service group. Default: USER.
  --runtime-bin PATH          installed clab runtime binary. Default: /opt/claw-lab/bin/clab
  --runtime-bin-src PATH      install this binary to --runtime-bin before setup.
  --wrapper PATH              wrapper script. Default: /usr/local/bin/claw-lab-openai-serve
  --env-file PATH             environment file. Default: /etc/claw-lab/openai.env
  --workdir PATH              neutral agent working directory. Default: /var/lib/claw-lab/work
  --sandbox-dir PATH          sandbox directory. Default: /var/lib/claw-lab/sandbox
  --tmpdir PATH               TMPDIR. Default: SANDBOX_DIR/tmp.
  --bind ADDR                 bind address. Default: 127.0.0.1:4097.
  --permission-mode MODE      read-only|workspace-write|danger-full-access, etc. Default: read-only.
  --websearch-url URL         optional CLAWD_WEB_SEARCH_BASE_URL.
  --api-key VALUE             optional OPENAI_API_KEY. If omitted, an existing env value is kept.
  --enable                    enable the systemd service.
  --restart                   restart the systemd service after install.
  --dry-run                   print actions without changing anything.
  -y, --yes                   do not prompt for confirmation (required for non-interactive uninstall).
  -h, --help                  show this help.

Uninstall:
  --uninstall                 remove the service named by --service and its files.
  --keep-data                 keep the work/sandbox directories and *.bak-* backups.

Design:
  - Installs systemd service + env + wrapper for the OpenAI-compatible Claw Lab server.
  - Uses a neutral workdir by default via --workdir.
  - Does not build the binary; install a prebuilt one via --runtime-bin-src, or use
    deploy-openai-server.sh to build and replace it.
  - Does not hardcode local host paths or model names; everything is a flag/default.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --service) SERVICE_NAME="${2:-}"; shift 2 ;;
    --service=*) SERVICE_NAME="${1#*=}"; shift ;;
    --user) USER_NAME="${2:-}"; shift 2 ;;
    --user=*) USER_NAME="${1#*=}"; shift ;;
    --group) GROUP_NAME="${2:-}"; shift 2 ;;
    --group=*) GROUP_NAME="${1#*=}"; shift ;;
    --runtime-bin) RUNTIME_BIN="${2:-}"; shift 2 ;;
    --runtime-bin=*) RUNTIME_BIN="${1#*=}"; shift ;;
    --runtime-bin-src) RUNTIME_BIN_SRC="${2:-}"; shift 2 ;;
    --runtime-bin-src=*) RUNTIME_BIN_SRC="${1#*=}"; shift ;;
    --wrapper) WRAPPER_PATH="${2:-}"; shift 2 ;;
    --wrapper=*) WRAPPER_PATH="${1#*=}"; shift ;;
    --env-file) ENV_FILE="${2:-}"; shift 2 ;;
    --env-file=*) ENV_FILE="${1#*=}"; shift ;;
    --workdir) WORKDIR="${2:-}"; shift 2 ;;
    --workdir=*) WORKDIR="${1#*=}"; shift ;;
    --sandbox-dir) SANDBOX_DIR="${2:-}"; shift 2 ;;
    --sandbox-dir=*) SANDBOX_DIR="${1#*=}"; shift ;;
    --tmpdir) TMPDIR_VALUE="${2:-}"; shift 2 ;;
    --tmpdir=*) TMPDIR_VALUE="${1#*=}"; shift ;;
    --bind) BIND="${2:-}"; shift 2 ;;
    --bind=*) BIND="${1#*=}"; shift ;;
    --base-url) OPENAI_BASE_URL="${2:-}"; shift 2 ;;
    --base-url=*) OPENAI_BASE_URL="${1#*=}"; shift ;;
    --backend-model) BACKEND_MODEL="${2:-}"; shift 2 ;;
    --backend-model=*) BACKEND_MODEL="${1#*=}"; shift ;;
    --served-model-id) SERVED_MODEL_ID="${2:-}"; shift 2 ;;
    --served-model-id=*) SERVED_MODEL_ID="${1#*=}"; shift ;;
    --permission-mode) PERMISSION_MODE="${2:-}"; shift 2 ;;
    --permission-mode=*) PERMISSION_MODE="${1#*=}"; shift ;;
    --websearch-url) WEBSEARCH_URL="${2:-}"; shift 2 ;;
    --websearch-url=*) WEBSEARCH_URL="${1#*=}"; shift ;;
    --api-key) API_KEY="${2:-}"; shift 2 ;;
    --api-key=*) API_KEY="${1#*=}"; shift ;;
    --enable) ENABLE_SERVICE=1; shift ;;
    --restart) RESTART_SERVICE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --keep-data) KEEP_DATA=1; shift ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "FAIL: unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

fail() {
  echo "FAIL: $*" >&2
  exit 2
}

need() {
  local name="$1" value="$2"
  [ -n "$value" ] || fail "missing $name"
}

if [ -z "$GROUP_NAME" ]; then
  GROUP_NAME="$USER_NAME"
fi

if [ "$(id -u)" = "0" ]; then
  SUDO=()
else
  SUDO=(sudo)
fi

run() {
  echo "+ $*"
  if [ "$DRY_RUN" != "1" ]; then
    "$@"
  fi
}

existing_var() {
  local key="$1"
  if [ -f "$ENV_FILE" ]; then
    grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true
  fi
}

confirm() {  # confirm "question" -> returns 0 to proceed, else aborts
  local q="$1" reply
  [ "$ASSUME_YES" = "1" ] && return 0
  if [ ! -t 0 ]; then
    fail "refusing to proceed non-interactively; pass --yes to confirm"
  fi
  read -r -p "$q [y/N]: " reply
  case "${reply:-N}" in
    y|Y) return 0 ;;
    *) echo "aborted."; exit 0 ;;
  esac
}

# ---------------------------------------------------------------------------
# Uninstall mode
# ---------------------------------------------------------------------------

do_uninstall() {
  local unit="/etc/systemd/system/$SERVICE_NAME"
  echo "Uninstall plan"
  echo "  service:      $SERVICE_NAME"
  echo "  unit:         $unit"
  echo "  wrapper:      $WRAPPER_PATH"
  echo "  env-file:     $ENV_FILE"
  echo "  runtime-bin:  $RUNTIME_BIN"
  if [ "$KEEP_DATA" = "1" ]; then
    echo "  data:         kept (workdir, sandbox, and *.bak-* backups left in place)"
  else
    echo "  workdir:      $WORKDIR (removed)"
    echo "  sandbox-dir:  $SANDBOX_DIR (removed)"
    echo "  backups:      *.bak-* for unit/wrapper/env/bin (removed)"
  fi
  echo "  dry-run:      $DRY_RUN"
  echo

  if [ "$DRY_RUN" = "1" ]; then
    echo "Dry-run complete. No changes made."
    return 0
  fi

  confirm "Remove the service and files above?"

  run "${SUDO[@]}" systemctl stop "$SERVICE_NAME" || true
  run "${SUDO[@]}" systemctl disable "$SERVICE_NAME" || true

  local f
  for f in "$unit" "$WRAPPER_PATH" "$ENV_FILE" "$RUNTIME_BIN"; do
    if [ -e "$f" ]; then
      run "${SUDO[@]}" rm -f "$f"
    fi
  done

  if [ "$KEEP_DATA" != "1" ]; then
    local d
    for d in "$WORKDIR" "$SANDBOX_DIR"; do
      if [ -d "$d" ]; then
        run "${SUDO[@]}" rm -rf "$d"
      fi
    done
    shopt -s nullglob
    local baks=( "$unit".bak-* "$WRAPPER_PATH".bak-* "$ENV_FILE".bak-* "$RUNTIME_BIN".bak-* )
    shopt -u nullglob
    if [ "${#baks[@]}" -gt 0 ]; then
      run "${SUDO[@]}" rm -f "${baks[@]}"
    fi
  fi

  run "${SUDO[@]}" systemctl daemon-reload
  run "${SUDO[@]}" systemctl reset-failed "$SERVICE_NAME" || true

  echo
  echo "Uninstall complete."
}

if [ "$UNINSTALL" = "1" ]; then
  do_uninstall
  exit 0
fi

# ---------------------------------------------------------------------------
# Interactive wizard (install mode, on a terminal, when essentials are missing)
# ---------------------------------------------------------------------------

ask() {  # ask "Prompt" "default" -> echoes the answer (default if empty)
  local prompt="$1" def="${2:-}" reply
  if [ -n "$def" ]; then
    read -r -p "$prompt [$def]: " reply
    printf '%s' "${reply:-$def}"
  else
    read -r -p "$prompt: " reply
    printf '%s' "$reply"
  fi
}

run_wizard() {
  echo "=== Claw Lab — service setup ==="
  echo "Press Enter to accept the [default]. You only need your backend + a served model id."
  echo

  while :; do
    OPENAI_BASE_URL="$(ask 'Backend base URL (OpenAI-compatible, e.g. http://127.0.0.1:8000/v1)' '')"
    [ -n "$OPENAI_BASE_URL" ] || { echo "  required: backend base URL" >&2; continue; }
    case "$OPENAI_BASE_URL" in
      http://?*|https://?*) break ;;
      *) echo "  invalid: must start with http:// or https:// and include a host" >&2 ;;
    esac
  done

  BACKEND_MODEL="$(ask 'Backend model id (the model your backend serves)' '')"
  [ -n "$BACKEND_MODEL" ] || fail "backend model id is required"

  read -r -s -p "Backend API key (leave blank if your backend needs none): " API_KEY; echo

  SERVED_MODEL_ID="$(ask 'Served model id (shown to Open WebUI)' "$SERVED_MODEL_ID")"
  BIND="$(ask 'Bind address' "$BIND")"
  PERMISSION_MODE="$(ask 'Permission mode (read-only | workspace-write | danger-full-access)' "$PERMISSION_MODE")"
  WEBSEARCH_URL="$(ask 'Web search backend URL (optional; JSON/SearXNG, e.g. http://127.0.0.1:8888/search?format=json)' "$WEBSEARCH_URL")"

  local start_reply
  read -r -p "Start now and enable on boot? [Y/n]: " start_reply
  case "${start_reply:-Y}" in
    y|Y) ENABLE_SERVICE=1; RESTART_SERVICE=1 ;;
  esac

  echo
  echo "--- Summary ---"
  echo "  backend URL:     $OPENAI_BASE_URL"
  echo "  backend model:   $BACKEND_MODEL"
  echo "  api key:         $( [ -n "$API_KEY" ] && echo '(set)' || echo '(none)')"
  echo "  served model id: $SERVED_MODEL_ID"
  echo "  bind:            $BIND"
  echo "  permission mode: $PERMISSION_MODE"
  [ -n "$WEBSEARCH_URL" ] && echo "  web search:      $WEBSEARCH_URL"
  [ -n "$RUNTIME_BIN_SRC" ] && echo "  install binary:  $RUNTIME_BIN_SRC -> $RUNTIME_BIN"
  echo "  service:         $SERVICE_NAME (user=$USER_NAME)"
  echo "  paths:           bin=$RUNTIME_BIN, env=$ENV_FILE, workdir=$WORKDIR"
  echo
  confirm "Proceed?"
}

if [ -z "$OPENAI_BASE_URL" ] && [ -t 0 ]; then
  run_wizard
fi

# ---------------------------------------------------------------------------
# Install mode
# ---------------------------------------------------------------------------

need "--base-url" "$OPENAI_BASE_URL"
need "--backend-model" "$BACKEND_MODEL"
need "--served-model-id" "$SERVED_MODEL_ID"

case "$OPENAI_BASE_URL" in
  http://?*|https://?*) ;;
  *) fail "--base-url must start with http:// or https:// and include a host (got: $OPENAI_BASE_URL)" ;;
esac

if [ -n "$RUNTIME_BIN_SRC" ] && [ ! -f "$RUNTIME_BIN_SRC" ]; then
  fail "--runtime-bin-src not found: $RUNTIME_BIN_SRC"
fi

if [ -z "$TMPDIR_VALUE" ]; then
  TMPDIR_VALUE="${SANDBOX_DIR%/}/tmp"
fi

if [ -z "$API_KEY" ]; then
  API_KEY="$(existing_var OPENAI_API_KEY)"
fi

if [ -z "$WEBSEARCH_URL" ]; then
  WEBSEARCH_URL="$(existing_var CLAWD_WEB_SEARCH_BASE_URL)"
fi

UNIT_PATH="/etc/systemd/system/$SERVICE_NAME"
TMP_ENV="$(mktemp)"
TMP_WRAPPER="$(mktemp)"
TMP_UNIT="$(mktemp)"

cleanup() {
  rm -f "$TMP_ENV" "$TMP_WRAPPER" "$TMP_UNIT"
}
trap cleanup EXIT

{
  if [ -n "$API_KEY" ]; then
    printf 'OPENAI_API_KEY=%s\n' "$API_KEY"
  fi
  printf 'OPENAI_BASE_URL=%s\n' "$OPENAI_BASE_URL"
  printf 'OPENAI_MODEL=%s\n' "$BACKEND_MODEL"
  printf 'CLAW_SERVED_MODEL_ID=%s\n' "$SERVED_MODEL_ID"
  printf 'CLAW_OPENAI_BIND=%s\n' "$BIND"
  printf 'CLAW_PERMISSION_MODE=%s\n' "$PERMISSION_MODE"
  printf 'CLAW_WORKING_DIRECTORY=%s\n' "$WORKDIR"
  printf 'CLAW_SANDBOX_DIR=%s\n' "$SANDBOX_DIR"
  printf 'TMPDIR=%s\n' "$TMPDIR_VALUE"
  if [ -n "$WEBSEARCH_URL" ]; then
    printf 'CLAWD_WEB_SEARCH_BASE_URL=%s\n' "$WEBSEARCH_URL"
  fi
} > "$TMP_ENV"

cat > "$TMP_WRAPPER" <<EOF
#!/usr/bin/env bash
set -euo pipefail

if [ -z "\${OPENAI_MODEL:-}" ]; then
  echo "missing OPENAI_MODEL" >&2
  exit 64
fi

if [ -z "\${OPENAI_BASE_URL:-}" ]; then
  echo "missing OPENAI_BASE_URL" >&2
  exit 64
fi

BIND="\${CLAW_OPENAI_BIND:-127.0.0.1:4097}"
PERMISSION_MODE="\${CLAW_PERMISSION_MODE:-read-only}"
WORKDIR="\${CLAW_WORKING_DIRECTORY:-$WORKDIR}"

if [ ! -d "\$WORKDIR" ]; then
  echo "missing CLAW_WORKING_DIRECTORY: \$WORKDIR" >&2
  exit 66
fi

cd "\$WORKDIR"

exec "$RUNTIME_BIN" \\
  --permission-mode "\$PERMISSION_MODE" \\
  openai-serve --bind "\$BIND"
EOF

cat > "$TMP_UNIT" <<EOF
[Unit]
Description=Claw Lab OpenAI-compatible API server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
Group=$GROUP_NAME
WorkingDirectory=$WORKDIR
EnvironmentFile=$ENV_FILE
ExecStart=$WRAPPER_PATH
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "Install plan"
echo "  service:      $SERVICE_NAME"
echo "  unit:         $UNIT_PATH"
echo "  user/group:   $USER_NAME:$GROUP_NAME"
echo "  runtime-bin:  $RUNTIME_BIN"
echo "  runtime-src:  ${RUNTIME_BIN_SRC:-<none>}"
echo "  wrapper:      $WRAPPER_PATH"
echo "  env-file:     $ENV_FILE"
echo "  workdir:      $WORKDIR"
echo "  sandbox-dir:  $SANDBOX_DIR"
echo "  tmpdir:       $TMPDIR_VALUE"
echo "  bind:         $BIND"
echo "  base-url:     $OPENAI_BASE_URL"
echo "  backend:      $BACKEND_MODEL"
echo "  served-id:    $SERVED_MODEL_ID"
echo "  permission:   $PERMISSION_MODE"
echo "  websearch:    ${WEBSEARCH_URL:-<none>}"
echo "  enable:       $ENABLE_SERVICE"
echo "  restart:      $RESTART_SERVICE"
echo "  dry-run:      $DRY_RUN"
echo

echo "--- env file preview, redacted ---"
sed -E 's/(API_KEY|AUTH_TOKEN|TOKEN|SECRET|PASSWORD)=.*/\1=<redacted>/' "$TMP_ENV"

echo
echo "--- wrapper preview ---"
sed -n '1,160p' "$TMP_WRAPPER"

echo
echo "--- unit preview ---"
sed -n '1,160p' "$TMP_UNIT"

if [ "$DRY_RUN" = "1" ]; then
  echo
  echo "Dry-run complete. No changes made."
  exit 0
fi

TS="$(date +%Y%m%d-%H%M%S)"
for target in "$ENV_FILE" "$WRAPPER_PATH" "$UNIT_PATH"; do
  if [ -e "$target" ]; then
    run "${SUDO[@]}" cp -a "$target" "$target.bak-$TS"
  fi
done

run "${SUDO[@]}" mkdir -p "$(dirname "$ENV_FILE")" "$(dirname "$WRAPPER_PATH")" "$WORKDIR" "$SANDBOX_DIR" "$TMPDIR_VALUE"
run "${SUDO[@]}" chown "$USER_NAME:$GROUP_NAME" "$WORKDIR" "$SANDBOX_DIR" "$TMPDIR_VALUE"
run "${SUDO[@]}" chmod 755 "$WORKDIR" "$SANDBOX_DIR" "$TMPDIR_VALUE"

run "${SUDO[@]}" install -m 0640 -o root -g "$GROUP_NAME" "$TMP_ENV" "$ENV_FILE"
run "${SUDO[@]}" install -m 0755 -o root -g root "$TMP_WRAPPER" "$WRAPPER_PATH"
run "${SUDO[@]}" install -m 0644 -o root -g root "$TMP_UNIT" "$UNIT_PATH"

if [ -n "$RUNTIME_BIN_SRC" ]; then
  if [ -e "$RUNTIME_BIN" ]; then
    run "${SUDO[@]}" cp -a "$RUNTIME_BIN" "$RUNTIME_BIN.bak-$TS"
  fi
  run "${SUDO[@]}" install -D -m 0755 "$RUNTIME_BIN_SRC" "$RUNTIME_BIN"
fi

run "${SUDO[@]}" systemctl daemon-reload

if [ "$ENABLE_SERVICE" = "1" ]; then
  run "${SUDO[@]}" systemctl enable "$SERVICE_NAME"
fi

if [ "$RESTART_SERVICE" = "1" ]; then
  run "${SUDO[@]}" systemctl restart "$SERVICE_NAME"
fi

echo
echo "Install complete."
echo "Verify:"
echo "  systemctl status $SERVICE_NAME --no-pager"
echo "  systemctl cat $SERVICE_NAME"
