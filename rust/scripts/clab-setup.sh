#!/usr/bin/env bash
# clab-setup.sh — interactive one-line setup for the Claw Lab OpenAI-compatible service.
#
# Asks only for the essentials — your backend (where the model comes from) and the
# served model id (what your chat sees) — then calls install-openai-service.sh with
# portable defaults for everything else. All defaults are overridable; run
# install-openai-service.sh directly for full control.
#
# This wizard intentionally knows nothing about engine internals: it only collects
# values and delegates to the installer, which writes the env file (the single source
# of truth). Adding a new engine option later usually means editing the installer's
# env template, not this script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER="$SCRIPT_DIR/install-openai-service.sh"

if [ ! -x "$INSTALLER" ]; then
  echo "error: installer not found or not executable: $INSTALLER" >&2
  exit 1
fi

# --- defaults (match install-openai-service.sh) ---
DEFAULT_SERVED_ID="clab-agent"
DEFAULT_BIND="127.0.0.1:4097"
DEFAULT_RUNTIME_BIN="/opt/clab/bin/clab"

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

echo "=== Claw Lab — service setup ==="
echo "Press Enter to accept the [default]. You only need your backend + a served model id."
echo

# Backend (where the model comes from)
BASE_URL="$(ask 'Backend base URL (OpenAI-compatible, e.g. http://127.0.0.1:8000/v1)' '')"
[ -n "$BASE_URL" ] || { echo "error: backend base URL is required" >&2; exit 2; }

BACKEND_MODEL="$(ask 'Backend model id (the model your backend serves)' '')"
[ -n "$BACKEND_MODEL" ] || { echo "error: backend model id is required" >&2; exit 2; }

read -r -s -p "Backend API key (leave blank if your backend needs none): " API_KEY; echo

# Output (what the chat frontend sees)
SERVED_ID="$(ask 'Served model id (shown to Open WebUI)' "$DEFAULT_SERVED_ID")"
BIND="$(ask 'Bind address' "$DEFAULT_BIND")"

read -r -p "Start now and enable on boot? [Y/n]: " START_REPLY
START_REPLY="${START_REPLY:-Y}"

echo
echo "--- Summary ---"
echo "  backend URL:     $BASE_URL"
echo "  backend model:   $BACKEND_MODEL"
echo "  api key:         $( [ -n "$API_KEY" ] && echo '(set)' || echo '(none)')"
echo "  served model id: $SERVED_ID"
echo "  bind:            $BIND"
echo "  defaults:        service=clab-openai.service, user=$(id -un), bin=$DEFAULT_RUNTIME_BIN,"
echo "                   env=/etc/clab/openai.env, workdir=/var/lib/clab/work"
echo
read -r -p "Proceed? [y/N]: " CONFIRM
case "${CONFIRM:-N}" in
  y|Y) ;;
  *) echo "aborted."; exit 0 ;;
esac

if [ ! -e "$DEFAULT_RUNTIME_BIN" ]; then
  RUST_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  echo
  echo "NOTE: runtime binary $DEFAULT_RUNTIME_BIN does not exist yet."
  echo "      The service runs this exact path, so build a release binary and install it"
  echo "      there before starting the service:"
  echo "        (cd \"$RUST_DIR\" && cargo build --release -p clab-cli)"
  echo "        sudo install -D -m 755 \"$RUST_DIR/target/release/clab\" \"$DEFAULT_RUNTIME_BIN\""
  echo "      Or use deploy-openai-server.sh --runtime-bin \"$DEFAULT_RUNTIME_BIN\" to build"
  echo "      and install it atomically. To use a different location, run"
  echo "      install-openai-service.sh --runtime-bin <path> directly."
fi

ARGS=(
  --base-url "$BASE_URL"
  --backend-model "$BACKEND_MODEL"
  --served-model-id "$SERVED_ID"
  --bind "$BIND"
)
[ -n "$API_KEY" ] && ARGS+=(--api-key "$API_KEY")
case "$START_REPLY" in
  y|Y) ARGS+=(--enable --restart) ;;
esac

echo
echo "Running: install-openai-service.sh ${ARGS[*]//$API_KEY/<api-key>}"
exec "$INSTALLER" "${ARGS[@]}"
