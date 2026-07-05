#!/usr/bin/env bash
# Cloudling uninstaller — the counterpart to install.sh.
#
# Removes the OpenAI-compatible service: the systemd unit, wrapper, env file, and
# runtime binary, plus (unless --keep-data) the work/sandbox directories and any
# *.bak-* backups. It is a thin entry point that delegates to the install engine
# so paths and names have a single source of truth.
#
# Usage:
#   ./uninstall.sh                 # remove the default cloudling-* service
#   ./uninstall.sh --dry-run       # show what would be removed, change nothing
#   ./uninstall.sh --keep-data     # keep work/sandbox dirs and backups
#   ./uninstall.sh --yes           # do not prompt (for scripts/CI)
#
# Any flag understood by install-openai-service.sh is passed through, so you can
# target a non-default service or paths, e.g.:
#   ./uninstall.sh --service my.service --runtime-bin /opt/foo/bin/cloudling
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENGINE="${SCRIPT_DIR}/rust/scripts/install-openai-service.sh"

if [ ! -f "${ENGINE}" ]; then
  echo "error: install engine not found at ${ENGINE}" >&2
  exit 1
fi

exec bash "${ENGINE}" --uninstall "$@"
