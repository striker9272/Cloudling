#!/usr/bin/env bash
# Claw Lab installer
#
# Detects the host OS, verifies the Rust toolchain (rustc + cargo),
# builds the `clab` binary from the `rust/` workspace, and runs a
# post-install verification step. Linux is the supported target;
# macOS and WSL are best-effort.
#
# Usage:
#   ./install.sh                # debug build (fast, default)
#   ./install.sh --release      # optimized release build
#   ./install.sh --no-verify    # skip post-install verification
#   ./install.sh --help         # print usage
#
# Environment overrides:
#   CLAW_BUILD_PROFILE=debug|release   same as --release toggle
#   CLAW_SKIP_VERIFY=1                 same as --no-verify

set -euo pipefail

# ---------------------------------------------------------------------------
# Pretty printing
# ---------------------------------------------------------------------------

if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
    COLOR_RESET="$(tput sgr0)"
    COLOR_BOLD="$(tput bold)"
    COLOR_DIM="$(tput dim)"
    COLOR_RED="$(tput setaf 1)"
    COLOR_GREEN="$(tput setaf 2)"
    COLOR_YELLOW="$(tput setaf 3)"
    COLOR_BLUE="$(tput setaf 4)"
    COLOR_CYAN="$(tput setaf 6)"
else
    COLOR_RESET=""
    COLOR_BOLD=""
    COLOR_DIM=""
    COLOR_RED=""
    COLOR_GREEN=""
    COLOR_YELLOW=""
    COLOR_BLUE=""
    COLOR_CYAN=""
fi

CURRENT_STEP=0
TOTAL_STEPS=7

step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    printf '\n%s[%d/%d]%s %s%s%s\n' \
        "${COLOR_BLUE}" "${CURRENT_STEP}" "${TOTAL_STEPS}" "${COLOR_RESET}" \
        "${COLOR_BOLD}" "$1" "${COLOR_RESET}"
}

info()  { printf '%s  ->%s %s\n' "${COLOR_CYAN}" "${COLOR_RESET}" "$1"; }
ok()    { printf '%s  ok%s %s\n' "${COLOR_GREEN}" "${COLOR_RESET}" "$1"; }
warn()  { printf '%s  warn%s %s\n' "${COLOR_YELLOW}" "${COLOR_RESET}" "$1"; }
error() { printf '%s  error%s %s\n' "${COLOR_RED}" "${COLOR_RESET}" "$1" 1>&2; }

print_banner() {
    printf '%s' "${COLOR_BOLD}"
    cat <<'EOF'
   ____  _                  _          _
  / ___|| | __ ___      __ | |    __ _| |__
 | |    | |/ _` \ \ /\ / / | |   / _` | '_ \
 | |___ | | (_| |\ V  V /  | |__| (_| | |_) |
  \____||_|\__,_| \_/\_/   |_____\__,_|_.__/
EOF
    printf '%s\n' "${COLOR_RESET}"
    printf '%sClaw Lab installer%s\n' "${COLOR_DIM}" "${COLOR_RESET}"
}

print_usage() {
    cat <<'EOF'
Usage: ./install.sh [options]

Options:
  --release       Build the optimized release profile (slower, smaller binary).
  --debug         Build the debug profile (default, faster compile).
  --no-verify     Skip the post-install verification step.
  --install-deps  Install any missing system packages without prompting.
  --no-install-deps  Never install system packages; only report what is missing.
  --setup-service Run the OpenAI service wizard after building (Linux only).
  --no-setup-service  Do not run the service wizard; build only.
  --prebuilt      Download a prebuilt release binary instead of building.
  --prebuilt-tag TAG  Release tag to download (default: latest).
  -h, --help      Show this help text and exit.

Environment overrides:
  CLAW_BUILD_PROFILE   debug | release
  CLAW_SKIP_VERIFY     set to 1 to skip verification
  CLAW_INSTALL_DEPS    yes | no   (default: ask interactively)
  CLAW_SETUP_SERVICE   yes | no   (default: ask interactively, Linux only)
  CLAW_PREBUILT        set to 1 to download a prebuilt binary
  CLAW_PREBUILT_TAG    release tag to download (default: latest)
EOF
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

BUILD_PROFILE="${CLAW_BUILD_PROFILE:-debug}"
SKIP_VERIFY="${CLAW_SKIP_VERIFY:-0}"
INSTALL_DEPS="${CLAW_INSTALL_DEPS:-ask}"
SETUP_SERVICE="${CLAW_SETUP_SERVICE:-ask}"
PREBUILT="${CLAW_PREBUILT:-0}"
PREBUILT_TAG="${CLAW_PREBUILT_TAG:-}"

while [ "$#" -gt 0 ]; do
    case "$1" in
        --release)
            BUILD_PROFILE="release"
            ;;
        --debug)
            BUILD_PROFILE="debug"
            ;;
        --no-verify)
            SKIP_VERIFY="1"
            ;;
        --install-deps)
            INSTALL_DEPS="yes"
            ;;
        --no-install-deps)
            INSTALL_DEPS="no"
            ;;
        --setup-service)
            SETUP_SERVICE="yes"
            ;;
        --no-setup-service)
            SETUP_SERVICE="no"
            ;;
        --prebuilt)
            PREBUILT="1"
            ;;
        --prebuilt-tag)
            shift
            PREBUILT_TAG="${1:-}"
            ;;
        --prebuilt-tag=*)
            PREBUILT_TAG="${1#*=}"
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            error "unknown argument: $1"
            print_usage
            exit 2
            ;;
    esac
    shift
done

case "${BUILD_PROFILE}" in
    debug|release) ;;
    *)
        error "invalid build profile: ${BUILD_PROFILE} (expected debug or release)"
        exit 2
        ;;
esac

# Release artifacts are built in release profile; align the binary path for --prebuilt.
if [ "${PREBUILT}" = "1" ]; then
    BUILD_PROFILE="release"
fi

# ---------------------------------------------------------------------------
# Troubleshooting hints
# ---------------------------------------------------------------------------

print_troubleshooting() {
    cat <<EOF

${COLOR_BOLD}Troubleshooting${COLOR_RESET}
${COLOR_DIM}---------------${COLOR_RESET}

  ${COLOR_BOLD}1. Rust toolchain missing${COLOR_RESET}
     Install Rust via rustup:
       curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
     Then reload your shell or run:
       source "\$HOME/.cargo/env"

  ${COLOR_BOLD}2. Linux: missing system packages${COLOR_RESET}
     The build needs git, pkg-config, and OpenSSL headers.
     Debian/Ubuntu:
       sudo apt-get update && sudo apt-get install -y \\
         git pkg-config libssl-dev ca-certificates build-essential
     Fedora/RHEL:
       sudo dnf install -y git pkgconf-pkg-config openssl-devel gcc
     Arch:
       sudo pacman -S --needed git pkgconf openssl base-devel

  ${COLOR_BOLD}3. macOS: missing Xcode CLT${COLOR_RESET}
     Install the command line tools:
       xcode-select --install

  ${COLOR_BOLD}4. Windows users${COLOR_RESET}
     Run this script from inside a WSL distro (Ubuntu/Debian recommended).
     Native Windows builds are not supported by this installer.

  ${COLOR_BOLD}5. Build fails partway through${COLOR_RESET}
     Try a clean build:
       cd rust && cargo clean && cargo build --workspace
     If the failure mentions ring/openssl, double check step 2.

  ${COLOR_BOLD}6. 'clab' not found after install${COLOR_RESET}
     The binary lives at:
       rust/target/${BUILD_PROFILE}/clab
     Add it to your PATH or invoke it with the full path.

EOF
}

trap 'rc=$?; if [ "$rc" -ne 0 ]; then error "installation failed (exit ${rc})"; print_troubleshooting; fi' EXIT

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

require_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# --- prebuilt download helpers ---------------------------------------------

# Map this host to the release artifact name from .github/workflows/release.yml
# (claw-linux-x64, claw-macos-arm64). Echoes the name; returns 1 if unsupported.
prebuilt_artifact_name() {
    local os arch
    case "${OS_FAMILY}" in
        linux) os="linux" ;;
        macos) os="macos" ;;
        *) return 1 ;;
    esac
    case "${UNAME_M}" in
        x86_64|amd64) arch="x64" ;;
        arm64|aarch64) arch="arm64" ;;
        *) return 1 ;;
    esac
    printf 'claw-%s-%s' "${os}" "${arch}"
}

# Derive owner/repo from the checkout's git remote so forks work without edits.
prebuilt_repo_slug() {
    local url
    url="$(git -C "${SCRIPT_DIR}" config --get remote.origin.url 2>/dev/null)" || return 1
    [ -n "${url}" ] || return 1
    printf '%s' "${url}" | sed -E 's#^.*github\.com[:/]##; s#\.git$##'
}

# Verify $1 against the sibling <artifact>.sha256 file in its directory.
verify_checksum() {
    local file="$1" dir base
    dir="$(dirname "${file}")"
    base="$(basename "${file}")"
    if require_cmd sha256sum; then
        ( cd "${dir}" && sha256sum -c "${base}.sha256" ) >/dev/null 2>&1
    elif require_cmd shasum; then
        ( cd "${dir}" && shasum -a 256 -c "${base}.sha256" ) >/dev/null 2>&1
    else
        warn "no sha256sum/shasum available — skipping checksum verification"
        return 0
    fi
}

# Download the release artifact for this host into $1 (target binary path),
# verifying its sha256. Prefers gh (handles private repos); falls back to curl
# against the public release URL.
download_prebuilt() {
    local dest="$1" artifact slug tmp
    artifact="$(prebuilt_artifact_name)" || {
        error "no prebuilt artifact for ${OS_FAMILY}/${UNAME_M}; build from source instead"
        exit 1
    }
    slug="$(prebuilt_repo_slug)" || {
        error "could not determine the GitHub repo from the git remote; use a source build"
        exit 1
    }
    tmp="$(mktemp -d)"

    info "artifact:  ${artifact}"
    info "repo:      ${slug}"
    info "release:   ${PREBUILT_TAG:-latest}"

    if require_cmd gh; then
        info "downloading via gh"
        local gh_args=(release download)
        [ -n "${PREBUILT_TAG}" ] && gh_args+=("${PREBUILT_TAG}")
        gh_args+=(--repo "${slug}" --dir "${tmp}" --clobber
            --pattern "${artifact}" --pattern "${artifact}.sha256")
        gh "${gh_args[@]}" || { error "gh release download failed"; exit 1; }
    elif require_cmd curl; then
        info "downloading via curl (public release)"
        local rel
        if [ -n "${PREBUILT_TAG}" ]; then rel="download/${PREBUILT_TAG}"; else rel="latest/download"; fi
        local base="https://github.com/${slug}/releases/${rel}"
        curl -fsSL -o "${tmp}/${artifact}" "${base}/${artifact}" \
            && curl -fsSL -o "${tmp}/${artifact}.sha256" "${base}/${artifact}.sha256" \
            || { error "curl download failed (private repo? install 'gh' and authenticate)"; exit 1; }
    else
        error "need 'gh' or 'curl' to download a prebuilt binary"
        exit 1
    fi

    if verify_checksum "${tmp}/${artifact}"; then
        ok "checksum verified"
    else
        error "checksum verification failed for ${artifact}"
        exit 1
    fi

    mkdir -p "$(dirname "${dest}")"
    install -m 0755 "${tmp}/${artifact}" "${dest}"
    rm -rf "${tmp}"
}

# ---------------------------------------------------------------------------
# Step 1: detect OS / arch / WSL
# ---------------------------------------------------------------------------

print_banner
step "Detecting host environment"

UNAME_S="$(uname -s 2>/dev/null || echo unknown)"
UNAME_M="$(uname -m 2>/dev/null || echo unknown)"
OS_FAMILY="unknown"
IS_WSL="0"

case "${UNAME_S}" in
    Linux*)
        OS_FAMILY="linux"
        if grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then
            IS_WSL="1"
        fi
        ;;
    Darwin*)
        OS_FAMILY="macos"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        OS_FAMILY="windows-shell"
        ;;
esac

info "uname:        ${UNAME_S} ${UNAME_M}"
info "os family:    ${OS_FAMILY}"
if [ "${IS_WSL}" = "1" ]; then
    info "wsl:          yes"
fi

case "${OS_FAMILY}" in
    linux|macos)
        ok "supported platform detected"
        ;;
    windows-shell)
        error "Detected a native Windows shell (MSYS/Cygwin/MinGW)."
        error "Please re-run this script from inside a WSL distribution."
        exit 1
        ;;
    *)
        error "Unsupported or unknown OS: ${UNAME_S}"
        error "Supported: Linux, macOS, and Windows via WSL."
        exit 1
        ;;
esac

# ---------------------------------------------------------------------------
# Step 2: locate the Rust workspace
# ---------------------------------------------------------------------------

step "Locating the Rust workspace"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUST_DIR="${SCRIPT_DIR}/rust"

if [ ! -d "${RUST_DIR}" ]; then
    error "Could not find rust/ workspace next to install.sh"
    error "Expected: ${RUST_DIR}"
    exit 1
fi

if [ ! -f "${RUST_DIR}/Cargo.toml" ]; then
    error "Missing ${RUST_DIR}/Cargo.toml — repository layout looks unexpected."
    exit 1
fi

ok "workspace at ${RUST_DIR}"

# ---------------------------------------------------------------------------
# Step 3: prerequisite checks
# ---------------------------------------------------------------------------

step "Checking prerequisites"

if [ "${PREBUILT}" = "1" ]; then
    # Prebuilt download needs a downloader, not a build toolchain.
    if require_cmd gh; then
        ok "gh found — will download a prebuilt binary (no build toolchain needed)"
    elif require_cmd curl; then
        ok "curl found — will download a prebuilt binary (no build toolchain needed)"
    else
        error "prebuilt install needs 'gh' or 'curl'. Install one, or omit --prebuilt to build from source."
        exit 1
    fi
else

# The Rust toolchain is installed via rustup, not the OS package manager, so we
# never auto-install it — we only point at rustup when it is missing.
MISSING_RUST=0

if require_cmd rustc; then
    ok "rustc found: $(rustc --version 2>/dev/null || echo 'unknown')"
else
    error "rustc not found in PATH"
    MISSING_RUST=1
fi

if require_cmd cargo; then
    ok "cargo found: $(cargo --version 2>/dev/null || echo 'unknown')"
else
    error "cargo not found in PATH"
    MISSING_RUST=1
fi

if [ "${MISSING_RUST}" -ne 0 ]; then
    error "Install the Rust toolchain first (see troubleshooting below)."
    exit 1
fi

# System build dependencies (C compiler/linker, pkg-config, OpenSSL headers, git)
# come from the OS package manager, so we can detect and offer to install them.

detect_pkg_mgr() {
    PKG_MGR=""
    if [ "${OS_FAMILY}" = "macos" ]; then
        require_cmd brew && PKG_MGR="brew"
        return
    fi
    if require_cmd apt-get; then PKG_MGR="apt"
    elif require_cmd dnf; then PKG_MGR="dnf"
    elif require_cmd pacman; then PKG_MGR="pacman"
    elif require_cmd zypper; then PKG_MGR="zypper"
    fi
}

# Map a generic dependency name to the package name for the detected manager.
pkg_name_for() {
    case "${PKG_MGR}:$1" in
        apt:compiler) echo "build-essential" ;;
        apt:pkg-config) echo "pkg-config" ;;
        apt:openssl) echo "libssl-dev" ;;
        apt:git) echo "git" ;;
        dnf:compiler) echo "gcc" ;;
        dnf:pkg-config) echo "pkgconf-pkg-config" ;;
        dnf:openssl) echo "openssl-devel" ;;
        dnf:git) echo "git" ;;
        pacman:compiler) echo "base-devel" ;;
        pacman:pkg-config) echo "pkgconf" ;;
        pacman:openssl) echo "openssl" ;;
        pacman:git) echo "git" ;;
        zypper:compiler) echo "gcc" ;;
        zypper:pkg-config) echo "pkg-config" ;;
        zypper:openssl) echo "libopenssl-devel" ;;
        zypper:git) echo "git" ;;
        brew:pkg-config) echo "pkg-config" ;;
        brew:openssl) echo "openssl@3" ;;
        brew:git) echo "git" ;;
        *) echo "" ;;
    esac
}

install_cmd_prefix() {
    case "${PKG_MGR}" in
        apt) echo "sudo apt-get install -y" ;;
        dnf) echo "sudo dnf install -y" ;;
        pacman) echo "sudo pacman -S --needed --noconfirm" ;;
        zypper) echo "sudo zypper install -y" ;;
        brew) echo "brew install" ;;
        *) echo "" ;;
    esac
}

MISSING_DEPS=()

if require_cmd cc || require_cmd gcc; then
    ok "C compiler found"
elif [ "${OS_FAMILY}" = "macos" ]; then
    # The macOS compiler ships with the Xcode command line tools, which the
    # package manager cannot install for us.
    error "No C compiler found. Install the Xcode command line tools:"
    error "  xcode-select --install"
    exit 1
else
    warn "C compiler (cc/gcc) not found"
    MISSING_DEPS+=("compiler")
fi

if require_cmd pkg-config; then
    ok "pkg-config found"
else
    warn "pkg-config not found"
    MISSING_DEPS+=("pkg-config")
fi

if require_cmd pkg-config && pkg-config --exists openssl 2>/dev/null; then
    ok "OpenSSL development headers found"
else
    warn "OpenSSL development headers not found"
    MISSING_DEPS+=("openssl")
fi

if require_cmd git; then
    ok "git found: $(git --version 2>/dev/null || echo 'unknown')"
else
    warn "git not found"
    MISSING_DEPS+=("git")
fi

if [ "${#MISSING_DEPS[@]}" -gt 0 ]; then
    detect_pkg_mgr

    PKGS=()
    for dep in "${MISSING_DEPS[@]}"; do
        name="$(pkg_name_for "${dep}")"
        if [ -n "${name}" ]; then
            case " ${PKGS[*]} " in
                *" ${name} "*) ;;
                *) PKGS+=("${name}") ;;
            esac
        fi
    done

    INSTALL_PREFIX="$(install_cmd_prefix)"

    if [ -z "${PKG_MGR}" ] || [ -z "${INSTALL_PREFIX}" ] || [ "${#PKGS[@]}" -eq 0 ]; then
        error "Missing system dependencies: ${MISSING_DEPS[*]}"
        error "No supported package manager detected — install them manually (see troubleshooting below)."
        exit 1
    fi

    INSTALL_CMD="${INSTALL_PREFIX} ${PKGS[*]}"

    printf '\n'
    warn "Missing system build dependencies: ${MISSING_DEPS[*]}"
    info "They can be installed with:"
    printf '    %s\n' "${INSTALL_CMD}"

    DO_INSTALL=0
    case "${INSTALL_DEPS}" in
        yes)
            DO_INSTALL=1
            ;;
        no)
            error "Run the command above, then re-run this installer."
            exit 1
            ;;
        *)
            if [ -t 0 ]; then
                printf '\n'
                read -r -p "Install these packages now? [y/N]: " REPLY_INSTALL
                case "${REPLY_INSTALL}" in
                    y|Y|yes|YES) DO_INSTALL=1 ;;
                    *) DO_INSTALL=0 ;;
                esac
            else
                error "Non-interactive shell: re-run with --install-deps, or run the command above first."
                exit 1
            fi
            ;;
    esac

    if [ "${DO_INSTALL}" -ne 1 ]; then
        error "Cannot continue without the system dependencies above."
        exit 1
    fi

    if [ "${PKG_MGR}" = "apt" ]; then
        info "running: sudo apt-get update"
        sudo apt-get update
    fi

    info "running: ${INSTALL_CMD}"
    # shellcheck disable=SC2086
    ${INSTALL_CMD}

    if ! require_cmd cc && ! require_cmd gcc; then
        error "C compiler still not found after install."
        exit 1
    fi
    ok "system dependencies installed"
fi

fi  # end prerequisite checks (source build)

# ---------------------------------------------------------------------------
# Step 4: obtain the clab binary (build from source or download prebuilt)
# ---------------------------------------------------------------------------

CLAW_BIN="${RUST_DIR}/target/${BUILD_PROFILE}/clab"

if [ "${PREBUILT}" = "1" ]; then
    step "Downloading the prebuilt clab binary"
    download_prebuilt "${CLAW_BIN}"
else
    step "Building the clab workspace (${BUILD_PROFILE})"

    CARGO_FLAGS=("build" "--workspace")
    if [ "${BUILD_PROFILE}" = "release" ]; then
        CARGO_FLAGS+=("--release")
    fi

    info "running: cargo ${CARGO_FLAGS[*]}"
    info "this may take a few minutes on the first build"

    (
        cd "${RUST_DIR}"
        CARGO_TERM_COLOR="${CARGO_TERM_COLOR:-always}" cargo "${CARGO_FLAGS[@]}"
    )
fi

if [ ! -x "${CLAW_BIN}" ]; then
    error "Expected binary not found at ${CLAW_BIN}"
    exit 1
fi

ok "binary ready: ${CLAW_BIN}"

# ---------------------------------------------------------------------------
# Step 5: post-install verification
# ---------------------------------------------------------------------------

step "Verifying the installed binary"

if [ "${SKIP_VERIFY}" = "1" ]; then
    warn "verification skipped (--no-verify or CLAW_SKIP_VERIFY=1)"
else
    info "running: clab --version"
    if VERSION_OUT="$("${CLAW_BIN}" --version 2>&1)"; then
        ok "clab --version -> ${VERSION_OUT}"
    else
        error "clab --version failed:"
        printf '%s\n' "${VERSION_OUT}" 1>&2
        exit 1
    fi

    info "running: clab --help (smoke test)"
    if "${CLAW_BIN}" --help >/dev/null 2>&1; then
        ok "clab --help responded"
    else
        error "clab --help failed"
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Step 6: optional OpenAI service setup
# ---------------------------------------------------------------------------

step "Setting up the OpenAI service (optional)"

DO_SETUP=0
SETUP_SCRIPT="${RUST_DIR}/scripts/install-openai-service.sh"

if [ "${OS_FAMILY}" != "linux" ]; then
    info "service setup is Linux/systemd only — skipping on ${OS_FAMILY}"
elif [ ! -f "${SETUP_SCRIPT}" ]; then
    warn "service installer not found at ${SETUP_SCRIPT} — skipping"
else
    case "${SETUP_SERVICE}" in
        yes) DO_SETUP=1 ;;
        no)  info "service setup skipped (--no-setup-service)" ;;
        *)
            if [ -t 0 ]; then
                printf '\n'
                read -r -p "Set up the OpenAI service now (systemd unit for Open WebUI)? [y/N]: " REPLY_SETUP
                case "${REPLY_SETUP}" in
                    y|Y|yes|YES) DO_SETUP=1 ;;
                esac
            else
                info "non-interactive shell — skipping (use --setup-service to force)"
            fi
            ;;
    esac
fi

if [ "${DO_SETUP}" = "1" ]; then
    info "launching service setup: scripts/install-openai-service.sh"
    # Hand the freshly built binary to the installer so it gets placed at the
    # runtime path without a manual copy step. Run with no flags, the installer
    # drops into its interactive wizard.
    CLAB_RUNTIME_BIN_SRC="${CLAW_BIN}" bash "${SETUP_SCRIPT}"
    ok "service setup finished"
else
    info "you can run it later with: bash ${SETUP_SCRIPT}"
fi

# ---------------------------------------------------------------------------
# Step 7: next steps
# ---------------------------------------------------------------------------

step "Next steps"

cat <<EOF
${COLOR_GREEN}Claw Lab is built and ready.${COLOR_RESET}

  Binary:  ${COLOR_BOLD}${CLAW_BIN}${COLOR_RESET}
  Profile: ${BUILD_PROFILE}

Run it as a service (the main use case — backend, served model id, bind, permissions):

  bash ${SETUP_SCRIPT}

Or try the CLI directly:

  ${COLOR_DIM}# smoke test${COLOR_RESET}
  ${CLAW_BIN} --help

  ${COLOR_DIM}# one-shot prompt against your configured backend${COLOR_RESET}
  ${CLAW_BIN} prompt "summarize this repository"

For deeper docs, see USAGE.md and rust/README.md.
EOF

# clear the failure trap on clean exit
trap - EXIT
