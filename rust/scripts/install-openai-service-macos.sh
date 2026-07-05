#!/usr/bin/env bash
# install-openai-service-macos.sh — macOS counterpart of install-openai-service.sh.
#
# Installs the Cloudling OpenAI-compatible server as a per-user launchd LaunchAgent
# (no root): an env file (single source of truth, the same CLOUDLING_*/OPENAI_* keys as
# the Linux install), a wrapper that sources it and execs `cloudling openai-serve`, and a
# LaunchAgent plist that runs the wrapper at login and keeps it alive. The env file
# is what the built-in UI's "save & restart" rewrites, exactly like on Linux.
#
# Modes:
#   (install — default)  Write env file + wrapper + plist; optionally install a
#       prebuilt binary (--runtime-bin-src) and load the agent (--load).
#   --uninstall          Unload the agent and remove the plist, wrapper, and env
#       file; also the work/ui dirs unless --keep-data.
#
# Nothing hardcodes a host or home: paths derive from $HOME and are overridable via
# flags, so the fork stays portable. NOTE: this script targets macOS (launchctl);
# it is the analogue of the systemd installer, not a replacement for it.
#
# This has not yet been exercised on real macOS hardware — see the project notes.
set -euo pipefail

# --- defaults (cloudling-* canon; per-user macOS paths; all overridable) ---
LABEL="cloudling.openai"
SUPPORT_DIR="${HOME}/Library/Application Support/cloudling"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
ENV_FILE="${SUPPORT_DIR}/openai.env"
WRAPPER_PATH="${SUPPORT_DIR}/cloudling-serve"
RUNTIME_BIN="/usr/local/bin/cloudling"
RUNTIME_BIN_SRC="${CLOUDLING_RUNTIME_BIN_SRC:-}"
WORKDIR="${SUPPORT_DIR}/work"
UI_DATA_DIR="${SUPPORT_DIR}/ui"
LOG_FILE="${SUPPORT_DIR}/openai.log"

DEFAULT_BIND="127.0.0.1:4097"
DEFAULT_SERVED_MODEL_ID="cloudling"
DEFAULT_PERMISSION_MODE="read-only"
BIND=""
OPENAI_BASE_URL=""
BACKEND_MODEL=""
SERVED_MODEL_ID=""
PERMISSION_MODE=""
WEBSEARCH_URL=""
API_KEY=""
UI_MODE=0
UI_TOKEN=""
LOAD_AGENT=0
UNINSTALL=0
KEEP_DATA=0
DRY_RUN=0
ASSUME_YES=0

usage() {
  cat <<'USAGE'
Usage:
  install-openai-service-macos.sh [options]              # install / configure
  install-openai-service-macos.sh --uninstall [options]  # remove the agent

Install:
  --base-url URL              OpenAI-compatible backend base URL
  --backend-model MODEL       backend/adaptor model id sent to the provider
  --served-model-id MODEL     model id exposed to clients. Default: cloudling
  --bind ADDR                 listen address. Default: 127.0.0.1:4097
  --permission-mode MODE      read-only | workspace-write | danger-full-access. Default: read-only
  --api-key VALUE             OPENAI_API_KEY for the backend (optional)
  --websearch-url URL         CLAWD_WEB_SEARCH_BASE_URL (optional)
  --ui                        enable the built-in web UI; configure engine in browser
  --ui-token VALUE            CLOUDLING_UI_TOKEN guarding /ui/* (auto-generated if omitted)
  --runtime-bin PATH          installed cloudling binary. Default: /usr/local/bin/cloudling
  --runtime-bin-src PATH      install this binary to --runtime-bin before setup
  --env-file PATH             environment file (source of truth)
  --plist PATH                LaunchAgent plist path
  --workdir PATH              neutral agent working directory
  --ui-data-dir PATH          UI dialog/preset storage
  --load                      load (start) the agent after install
  -y, --yes                   assume yes to prompts
  --dry-run                   print actions without making changes
  -h, --help                  this help

Uninstall:
  --uninstall                 unload and remove plist/wrapper/env (+ data dirs)
  --keep-data                 keep work/ui dirs on uninstall
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --base-url) OPENAI_BASE_URL="${2:-}"; shift 2 ;;
    --base-url=*) OPENAI_BASE_URL="${1#*=}"; shift ;;
    --backend-model) BACKEND_MODEL="${2:-}"; shift 2 ;;
    --backend-model=*) BACKEND_MODEL="${1#*=}"; shift ;;
    --served-model-id) SERVED_MODEL_ID="${2:-}"; shift 2 ;;
    --served-model-id=*) SERVED_MODEL_ID="${1#*=}"; shift ;;
    --bind) BIND="${2:-}"; shift 2 ;;
    --bind=*) BIND="${1#*=}"; shift ;;
    --permission-mode) PERMISSION_MODE="${2:-}"; shift 2 ;;
    --permission-mode=*) PERMISSION_MODE="${1#*=}"; shift ;;
    --api-key) API_KEY="${2:-}"; shift 2 ;;
    --api-key=*) API_KEY="${1#*=}"; shift ;;
    --websearch-url) WEBSEARCH_URL="${2:-}"; shift 2 ;;
    --websearch-url=*) WEBSEARCH_URL="${1#*=}"; shift ;;
    --ui) UI_MODE=1; shift ;;
    --ui-token) UI_TOKEN="${2:-}"; shift 2 ;;
    --ui-token=*) UI_TOKEN="${1#*=}"; shift ;;
    --runtime-bin) RUNTIME_BIN="${2:-}"; shift 2 ;;
    --runtime-bin=*) RUNTIME_BIN="${1#*=}"; shift ;;
    --runtime-bin-src) RUNTIME_BIN_SRC="${2:-}"; shift 2 ;;
    --runtime-bin-src=*) RUNTIME_BIN_SRC="${1#*=}"; shift ;;
    --env-file) ENV_FILE="${2:-}"; shift 2 ;;
    --env-file=*) ENV_FILE="${1#*=}"; shift ;;
    --plist) PLIST="${2:-}"; shift 2 ;;
    --plist=*) PLIST="${1#*=}"; shift ;;
    --workdir) WORKDIR="${2:-}"; shift 2 ;;
    --workdir=*) WORKDIR="${1#*=}"; shift ;;
    --ui-data-dir) UI_DATA_DIR="${2:-}"; shift 2 ;;
    --ui-data-dir=*) UI_DATA_DIR="${1#*=}"; shift ;;
    --load) LOAD_AGENT=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --keep-data) KEEP_DATA=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

run() {
  if [ "$DRY_RUN" = "1" ]; then
    printf 'DRY-RUN:'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

confirm() {
  [ "$ASSUME_YES" = "1" ] && return 0
  printf '%s [y/N] ' "$1"
  read -r reply || true
  case "$reply" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

if [ "$UNINSTALL" = "1" ]; then
  echo "Will remove the Cloudling launchd agent:"
  echo "  label:    $LABEL"
  echo "  plist:    $PLIST"
  echo "  wrapper:  $WRAPPER_PATH"
  echo "  env-file: $ENV_FILE"
  if [ "$KEEP_DATA" != "1" ]; then
    echo "  workdir:  $WORKDIR (removed)"
    echo "  ui-data:  $UI_DATA_DIR (removed if present)"
  fi
  confirm "Remove the agent and files above?" || { echo "Aborted."; exit 0; }
  # `bootout` is the modern unload; fall back to legacy `unload` for older macOS.
  run launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || \
    run launchctl unload -w "$PLIST" 2>/dev/null || true
  for f in "$PLIST" "$WRAPPER_PATH" "$ENV_FILE"; do
    [ -e "$f" ] && run rm -f "$f" && echo "Removed $f"
  done
  if [ "$KEEP_DATA" != "1" ]; then
    for d in "$WORKDIR" "$UI_DATA_DIR"; do
      [ -d "$d" ] && run rm -rf "$d" && echo "Removed $d"
    done
  fi
  echo "Done."
  exit 0
fi

# --- install ---
# Resolve precedence: flag > built-in default.
BIND="${BIND:-$DEFAULT_BIND}"
SERVED_MODEL_ID="${SERVED_MODEL_ID:-$DEFAULT_SERVED_MODEL_ID}"
PERMISSION_MODE="${PERMISSION_MODE:-$DEFAULT_PERMISSION_MODE}"
# UI mode with no token on a non-loopback bind would expose /ui/*; auto-generate one.
if [ "$UI_MODE" = "1" ] && [ -z "$UI_TOKEN" ]; then
  UI_TOKEN="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32 || true)"
fi

run mkdir -p "$SUPPORT_DIR" "$WORKDIR" "$(dirname "$PLIST")"

# Optionally install a freshly built binary at RUNTIME_BIN.
if [ -n "$RUNTIME_BIN_SRC" ]; then
  run mkdir -p "$(dirname "$RUNTIME_BIN")"
  run install -m 755 "$RUNTIME_BIN_SRC" "$RUNTIME_BIN"
fi

# Env file (single source of truth) — same keys as the Linux installer.
write_env() {
  if [ -n "$API_KEY" ]; then printf 'OPENAI_API_KEY=%s\n' "$API_KEY"; fi
  if [ -n "$OPENAI_BASE_URL" ]; then printf 'OPENAI_BASE_URL=%s\n' "$OPENAI_BASE_URL"; fi
  if [ -n "$BACKEND_MODEL" ]; then printf 'OPENAI_MODEL=%s\n' "$BACKEND_MODEL"; fi
  printf 'CLOUDLING_SERVED_MODEL_ID=%s\n' "$SERVED_MODEL_ID"
  printf 'CLOUDLING_OPENAI_BIND=%s\n' "$BIND"
  printf 'CLAW_PERMISSION_MODE=%s\n' "$PERMISSION_MODE"
  printf 'CLOUDLING_WORKING_DIRECTORY=%s\n' "$WORKDIR"
  if [ -n "$WEBSEARCH_URL" ]; then printf 'CLAWD_WEB_SEARCH_BASE_URL=%s\n' "$WEBSEARCH_URL"; fi
  if [ "$UI_MODE" = "1" ]; then
    printf 'CLOUDLING_OPENAI_UI=1\n'
    printf 'CLOUDLING_UI_DATA_DIR=%s\n' "$UI_DATA_DIR"
    printf 'CLOUDLING_OPENAI_ENV_FILE=%s\n' "$ENV_FILE"
    if [ -n "$UI_TOKEN" ]; then printf 'CLOUDLING_UI_TOKEN=%s\n' "$UI_TOKEN"; fi
  fi
}
if [ "$DRY_RUN" = "1" ]; then
  echo "DRY-RUN: would write env file $ENV_FILE:"; write_env | sed 's/^/  /'
else
  umask 077  # env file may hold an API key/token
  write_env > "$ENV_FILE"
fi

# Wrapper: launchd has no EnvironmentFile, so the wrapper sources the env file
# itself, then execs cloudling — mirroring the Linux wrapper's start logic.
write_wrapper() {
  cat <<EOF
#!/bin/sh
set -eu
ENV_FILE="$ENV_FILE"
if [ -f "\$ENV_FILE" ]; then
  set -a
  . "\$ENV_FILE"
  set +a
fi
BIND="\${CLOUDLING_OPENAI_BIND:-$DEFAULT_BIND}"
PERMISSION_MODE="\${CLAW_PERMISSION_MODE:-$DEFAULT_PERMISSION_MODE}"
WORKDIR="\${CLOUDLING_WORKING_DIRECTORY:-$WORKDIR}"
mkdir -p "\$WORKDIR"
cd "\$WORKDIR"
if [ "\${CLOUDLING_OPENAI_UI:-0}" = "1" ]; then
  # UI mode: the engine can be set in the browser, so no backend is required.
  exec "$RUNTIME_BIN" --permission-mode "\$PERMISSION_MODE" openai-serve --bind "\$BIND" --ui
fi
if [ -z "\${OPENAI_MODEL:-}" ]; then echo "missing OPENAI_MODEL" >&2; exit 64; fi
if [ -z "\${OPENAI_BASE_URL:-}" ]; then echo "missing OPENAI_BASE_URL" >&2; exit 64; fi
exec "$RUNTIME_BIN" --permission-mode "\$PERMISSION_MODE" openai-serve --bind "\$BIND"
EOF
}
if [ "$DRY_RUN" = "1" ]; then
  echo "DRY-RUN: would write wrapper $WRAPPER_PATH"
else
  write_wrapper > "$WRAPPER_PATH"
  chmod 755 "$WRAPPER_PATH"
fi

# LaunchAgent plist. KeepAlive relaunches the server: always in UI mode (so the
# UI's "save & restart" exit brings it back, like Restart=always on Linux), or
# only on failure otherwise (SuccessfulExit=false, like Restart=on-failure).
write_plist() {
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTD/PropertyList-1.0.dtd">'
  echo '<plist version="1.0">'
  echo '<dict>'
  echo '	<key>Label</key>'
  printf '	<string>%s</string>\n' "$LABEL"
  echo '	<key>ProgramArguments</key>'
  echo '	<array>'
  printf '		<string>%s</string>\n' "$WRAPPER_PATH"
  echo '	</array>'
  echo '	<key>RunAtLoad</key>'
  echo '	<true/>'
  if [ "$UI_MODE" = "1" ]; then
    echo '	<key>KeepAlive</key>'
    echo '	<true/>'
  else
    echo '	<key>KeepAlive</key>'
    echo '	<dict>'
    echo '		<key>SuccessfulExit</key>'
    echo '		<false/>'
    echo '	</dict>'
  fi
  echo '	<key>StandardOutPath</key>'
  printf '	<string>%s</string>\n' "$LOG_FILE"
  echo '	<key>StandardErrorPath</key>'
  printf '	<string>%s</string>\n' "$LOG_FILE"
  echo '</dict>'
  echo '</plist>'
}
if [ "$DRY_RUN" = "1" ]; then
  echo "DRY-RUN: would write plist $PLIST:"; write_plist | sed 's/^/  /'
else
  write_plist > "$PLIST"
fi

echo "Installed Cloudling launchd agent:"
echo "  label:        $LABEL"
echo "  plist:        $PLIST"
echo "  wrapper:      $WRAPPER_PATH"
echo "  env-file:     $ENV_FILE"
echo "  runtime-bin:  $RUNTIME_BIN"
echo "  workdir:      $WORKDIR"

if [ "$LOAD_AGENT" = "1" ]; then
  # `bootstrap` is the modern load; fall back to legacy `load` for older macOS.
  run launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || \
    run launchctl load -w "$PLIST"
  echo "Loaded $LABEL. Open http://$BIND/ once it is up."
else
  echo "Run 'launchctl bootstrap gui/\$(id -u) \"$PLIST\"' (or pass --load) to start it."
fi
