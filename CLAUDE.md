# CLAUDE.md

Guidance for Claude when working in this repository. Collaboration rules live in
the project Instructions (set in the app); this file documents the **codebase**.

## What this is

Claw Lab is an agentic layer between a model backend and a chat frontend. It wraps
any OpenAI-compatible backend (Ollama, llama.cpp, vLLM, cloud) with built-in tools,
web search, and an agent workflow, and serves the result as an OpenAI-compatible
endpoint (`/v1/chat/completions`) that Open WebUI and other clients see as a single
model. Built for self-hosted home-lab use.

Fork of [Claw Code](https://github.com/ultraworkers/claw-code) (UltraWorkers, MIT).
The agent core comes from upstream; the OpenAI-serving layer, Open WebUI integration,
and deploy tooling are Claw Lab's.

## Stack & repository shape

- Language: Rust. The workspace lives in `rust/` (members under `rust/crates/*`).
- Binary: **`clab`** (defined in crate `clab-cli`). Other notable crates: `clab-desktop`
  (desktop integration — Windows + Linux tray), `clab-analog`, `clab-rag-service`.
- `USAGE.md` — task-oriented usage guide. `docs/` — Windows, local providers, containers,
  model compatibility, RAG/web-ui, navigation/file-context.
- `src/` + `tests/` — companion reference/audit workspace, not the primary runtime.
- **Desktop (`clab tray` / `clab uninstall`):** `clab tray` runs serve + the built-in UI in
  the background as a system-tray app (a bare double-click does the same on Windows; `clab` in
  a terminal stays the CLI/REPL); `clab uninstall` removes per-user data + the autostart entry.
  Lives in the `clab-desktop` crate, gated by `cfg`: **Windows** uses win32 FFI (`tray-icon`,
  hidden-console relaunch, `HKCU\...\Run`); **Linux** uses `ksni` — a pure-Rust StatusNotifierItem
  tray over D-Bus (no gtk, no `unsafe`), `~/.config/autostart`, `xdg-open` — so the Linux build
  stays a static musl binary; **macOS** uses `tray-icon` again (Cocoa via `objc2`, not gtk) driven by a
  minimal `NSApplication` run loop on the main thread (no `unsafe` — the AppKit methods are safe),
  `~/Library/LaunchAgents`, `open`. The Linux desktop artifact is a `.deb` (double-click install via the
  graphical App Center, then "Claw Lab" in the apps menu; built in `release.yml`); the in-repo
  `assets/` holds its `.desktop` entry and `claw-lab.svg` icon. The macOS desktop artifact is a `.dmg`
  holding a `Claw Lab.app` (a menu-bar agent via `LSUIElement`, drag-to-Applications). macOS is **new and
  not yet verified on hardware**, so its binary/`.dmg` ship as pre-release artifacts only (see Install &
  release). See `docs/windows-install-release.md` and `docs/macos.md`.

## Build, verify, test

Run from `rust/` (the Linux build host has cargo 1.96; the local sandbox does not):

```bash
cargo build --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Formatting from repo root: `scripts/fmt.sh --check` (or `scripts/fmt.sh` to apply).

A plain Linux/macOS `cargo build` does **not** compile the `#[cfg(windows)]` code (the `clab-desktop`
tray/FFI). To compile-check the Windows-only code without a Windows machine:
`cargo check -p clab-cli --target x86_64-pc-windows-gnu` (one-time: `rustup target add
x86_64-pc-windows-gnu` + a mingw cross C toolchain — `ring`/`rusqlite` build their C for the target).
This is a dev convenience on the build host, **not** a product dependency. The real Windows `.exe` is
built MSVC by `release.yml`.

## Install & release

`install.sh` (repo root) is the entry point for getting a working binary/service. It detects the
OS, checks the Rust toolchain, and checks system build deps (C compiler, OpenSSL, pkg-config),
offering to install missing ones via the host package manager (`y/n`, or `--install-deps` /
`--no-install-deps`). Key flags: `--release`; `--prebuilt` (download a release asset instead of
building — needs `gh` or `curl`, `--prebuilt-tag vX.Y.Z` to pin); `--setup-service` (after the
binary is ready, place it and run the service wizard end-to-end; Linux only).

The OpenAI service is set up by `rust/scripts/install-openai-service.sh` — run with no flags on a
terminal it drops into an interactive wizard; with flags it runs non-interactively (CI). It writes
the env file (single source of truth), wrapper, and systemd unit, and can place a freshly built
binary at the runtime path via `--runtime-bin-src` (or the `CLAB_RUNTIME_BIN_SRC` env, which
`install.sh --setup-service` sets). Defaults follow the `claw-lab-*` naming
(`claw-lab-openai.service`, `/opt/claw-lab/bin/clab`, `/etc/claw-lab/openai.env`,
`/var/lib/claw-lab/{work,sandbox}`) and are all overridable via flags. For rebuild-and-swap of an
existing service, use `rust/scripts/deploy-openai-server.sh`. To remove the service, use
`uninstall.sh` (repo root) — a thin counterpart to `install.sh` that delegates to
`install-openai-service.sh --uninstall` (also removes work/sandbox dirs and backups unless
`--keep-data`).

Releases: pushing a tag `v*` triggers `.github/workflows/release.yml`, which builds and publishes
assets named `claw-<os>-<arch>` (+ `.sha256`) — asset names keep the `claw-` prefix though the
binary is `clab`. The matrix builds **Linux, Windows, and macOS (Apple Silicon)**: `claw-linux-x64`
+ a `.deb` desktop package, `claw-windows-x64.exe`, and `claw-macos-arm64` + a `.dmg`/`.app` desktop
bundle. macOS is **artifact-only** for now (matrix `publish: false`): the macOS jobs build and upload
workflow artifacts but the "Upload release asset" step is gated on `matrix.publish`, so macOS is **not
attached to the public release** until the new port is smoke-tested on real hardware — then flip
`publish: true` for `macos-arm64`. (Intel macOS / a universal binary remain build-from-source.)
`install.sh --prebuilt` consumes the published assets (and reports "build from source" on macOS until
its asset is published). A separate dispatch-only `.github/workflows/macos-check.yml` compiles the
workspace + runs a `clab --version` smoke on macOS without publishing — the Phase-0 de-risk check.
Keep the tag in sync with the workspace version in `rust/Cargo.toml`.

## Deploy

The repo is checked out under the deploying user's home (`~/claw-lab`); the install
defaults place the runtime binary at `/opt/claw-lab/bin/clab`, the env file at
`/etc/claw-lab/openai.env`, and the work/sandbox dirs under `/var/lib/claw-lab`. The
live service is `claw-lab-openai.service`, started via the wrapper
`/usr/local/bin/claw-lab-openai-serve`, which runs the `clab` binary from the neutral
workdir. First-time setup is `install.sh` (builds + runs the service wizard); removal
is `uninstall.sh`.

For rebuild + install + restart of an existing service, use the deploy helper:

```bash
cd ~/claw-lab/rust
scripts/deploy-openai-server.sh \
  --runtime-bin /opt/claw-lab/bin/clab \
  --service claw-lab-openai.service \
  --health-url http://127.0.0.1:4097/health
```

Run it as the current user, **NOT** with an outer `sudo`: the script builds/tests as the
user (cargo lives in `~/.cargo/bin`, not on root's PATH) and self-escalates with `sudo`
only for the install/backup/restart steps, prompting for the password once at the
"sudo preflight" step. If the host has no passwordless sudo, the maintainer runs the
deploy interactively.

## Conventions

- **Branding:** the project, binary, and crates are `clab` / `clab-*`. When renaming,
  do NOT touch plumbing: the config dir `.claw/`, env vars `CLAW_*`, or config files
  like `.claw-analog.toml`. Keep all `claw-code` / "Claw Code" references that credit
  the **upstream** project (MIT attribution requirement — `LICENSE` must stay intact).
- **Language:** code, commits, and public docs in English; maintainer conversation may
  be in another language.
- **Unsafe code:** the workspace sets `unsafe_code = "forbid"` (from upstream) — keep it. The one
  exception is `clab-desktop`, which opts out via its own crate-level `[lints]` so its **Windows**
  FFI (tray/console/registry) may use `unsafe`, each block documented with `// SAFETY:`. The
  crate's **Linux** path (the `ksni` tray) and **macOS** path (the `objc2`/AppKit tray) use no
  `unsafe` — the AppKit methods used (`NSApplication::sharedApplication`/`setActivationPolicy`/`run`)
  are safe in `objc2-app-kit`. Do not introduce `unsafe` anywhere
  else; new unavoidable FFI belongs in `clab-desktop` (or a similarly-quarantined crate).
- **CI:** GitHub Actions does **not** gate on the build. `.github/workflows/rust-ci.yml`
  (push/PR to `main`) runs only the docs source-of-truth job — two Python checks
  (`check_doc_source_of_truth.py` for branding/links and `check_release_readiness.py`);
  it does **not** run fmt, clippy, tests, or build. `.github/workflows/release.yml` builds
  the platform binaries only on a `v*` tag. The real build/test signal is `cargo build`
  (and the commands above) on the Linux build host — keep `rust/` source and `tests/` in
  sync when behavior changes.
- Prefer small, reviewable changes. Reserve machine-local overrides for
  `.claude/settings.local.json`; keep shared defaults in `.claude.json`.
