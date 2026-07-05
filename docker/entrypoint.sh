#!/bin/sh
# Entry point for the containerised Cloudling server (UI mode).
#
# Mirrors the UI branch of the systemd wrapper (install-openai-service.sh): inside a
# container the container itself is the isolation boundary, so we run the built-in UI
# and serve. All knobs come from CLOUDLING_*/OPENAI_* env with portable defaults set in
# the image; override them via compose or `docker run -e`.
set -eu

# Drop empty optional vars so the UI first-run setup screen triggers when the backend
# is left unconfigured (the engine can be set in the browser instead).
for v in OPENAI_BASE_URL OPENAI_MODEL OPENAI_API_KEY CLAWD_WEB_SEARCH_BASE_URL CLOUDLING_UI_TOKEN; do
    eval "val=\${$v:-}"
    [ -n "$val" ] || unset "$v" || true
done

BIND="${CLOUDLING_OPENAI_BIND:-0.0.0.0:4097}"
PERMISSION_MODE="${CLAW_PERMISSION_MODE:-read-only}"
WORKDIR="${CLOUDLING_WORKING_DIRECTORY:-/workspace}"

mkdir -p "$WORKDIR" "${CLOUDLING_UI_DATA_DIR:-/data/ui}"
cd "$WORKDIR"

exec cloudling \
    --permission-mode "$PERMISSION_MODE" \
    openai-serve --bind "$BIND" --ui
