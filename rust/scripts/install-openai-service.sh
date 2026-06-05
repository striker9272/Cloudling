#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="clab-openai.service"
USER_NAME="$(id -un)"
GROUP_NAME=""
RUNTIME_BIN="/opt/clab/bin/clab"
WRAPPER_PATH="/usr/local/bin/clab-openai-serve"
ENV_FILE="/etc/clab/openai.env"
WORKDIR="/var/lib/clab/work"
SANDBOX_DIR="/var/lib/clab/sandbox"
TMPDIR_VALUE=""
BIND="127.0.0.1:4097"
OPENAI_BASE_URL=""
BACKEND_MODEL=""
SERVED_MODEL_ID=""
PERMISSION_MODE="read-only"
WEBSEARCH_URL=""
API_KEY=""
ENABLE_SERVICE=0
RESTART_SERVICE=0
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage:
  scripts/install-openai-service.sh [options]

Required:
  --service NAME              systemd service name, e.g. claw-lab-openai.service
  --user USER                 service user
  --runtime-bin PATH          installed claw runtime binary
  --wrapper PATH              wrapper script to install
  --env-file PATH             environment file to write
  --workdir PATH              neutral agent working directory
  --sandbox-dir PATH          sandbox directory
  --base-url URL              OpenAI-compatible backend base URL
  --backend-model MODEL       backend/adaptor model id sent to provider
  --served-model-id MODEL     model id exposed by /health and /v1/models

Options:
  --group GROUP               service group. Defaults to USER.
  --tmpdir PATH               TMPDIR. Defaults to SANDBOX_DIR/tmp.
  --bind ADDR                 bind address. Default: 127.0.0.1:4097.
  --permission-mode MODE      read-only|acceptEdits|bypassPermissions|danger-full-access, etc. Default: read-only.
  --websearch-url URL         optional CLAWD_WEB_SEARCH_BASE_URL.
  --api-key VALUE             optional OPENAI_API_KEY. If omitted, existing env value is preserved when present.
  --enable                    enable the systemd service.
  --restart                   restart the systemd service after install.
  --dry-run                   print actions without changing files.
  -h, --help                  show help.

Design:
  - Installs systemd service + env + wrapper for OpenAI-compatible Claw server.
  - Uses a neutral workdir by default via --workdir.
  - Does not build or replace the claw binary; use deploy-openai-server.sh for that.
  - Does not hardcode local host paths or model names.
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
    -h|--help) usage; exit 0 ;;
    *) echo "FAIL: unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

fail() {
  echo "FAIL: $*" >&2
  exit 2
}

need() {
  local name="$1"
  local value="$2"
  [ -n "$value" ] || fail "missing $name"
}

need "--base-url" "$OPENAI_BASE_URL"
need "--backend-model" "$BACKEND_MODEL"
need "--served-model-id" "$SERVED_MODEL_ID"

if [ -z "$GROUP_NAME" ]; then
  GROUP_NAME="$USER_NAME"
fi

if [ -z "$TMPDIR_VALUE" ]; then
  TMPDIR_VALUE="${SANDBOX_DIR%/}/tmp"
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

run_shell() {
  echo "+ $*"
  if [ "$DRY_RUN" != "1" ]; then
    bash -lc "$*"
  fi
}

existing_var() {
  local key="$1"
  if [ -f "$ENV_FILE" ]; then
    grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true
  fi
}

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
