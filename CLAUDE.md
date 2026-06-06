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
- Binary: **`clab`** (defined in crate `clab-cli`). Other notable crates: `clab-analog`,
  `clab-rag-service`.
- `USAGE.md` — task-oriented usage guide. `docs/` — Windows, local providers, containers,
  model compatibility, RAG/web-ui, navigation/file-context.
- `src/` + `tests/` — companion reference/audit workspace, not the primary runtime.

## Build, verify, test

Run from `rust/` (combsrv has cargo 1.96; the local sandbox does not):

```bash
cargo build --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Formatting from repo root: `scripts/fmt.sh --check` (or `scripts/fmt.sh` to apply).

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
binary is `clab`. `install.sh --prebuilt` consumes these. Keep the tag in sync with the workspace
version in `rust/Cargo.toml`.

## Deploy (combsrv)

The live service is `claw-lab-openai.service`, started via the wrapper
`/usr/local/bin/claw-lab-openai-serve`, which runs the `clab` binary in a neutral
workdir. Rebuild + install + restart with:

```bash
claw-lab-deploy-openai     # run as combiner, NOT with outer sudo
```

Run it **without** an outer `sudo`: the script builds/tests as the current user (cargo
lives in combiner's `~/.cargo/bin`, not on root's PATH) and self-escalates with `sudo`
only for the install/backup/restart steps, prompting for the password once at the
"sudo preflight" step. Running it as `sudo claw-lab-deploy-openai` fails with
`cargo: command not found`. combsrv has no passwordless sudo, so Alexander runs the
deploy interactively. The runtime binary path keeps the filename `claw` for now
(internal plumbing); the source/build product is `clab`.

## Conventions

- **Branding:** the project, binary, and crates are `clab` / `clab-*`. When renaming,
  do NOT touch plumbing: the config dir `.claw/`, env vars `CLAW_*`, or config files
  like `.claw-analog.toml`. Keep all `claw-code` / "Claw Code" references that credit
  the **upstream** project (MIT attribution requirement — `LICENSE` must stay intact).
- **Language:** code, commits, and public docs in English; conversation with Alexander
  in Russian.
- **CI:** GitHub Actions (`.github/workflows/rust-ci.yml`) runs doc checks, fmt, clippy,
  tests, build. Keep `rust/` source and `tests/` in sync when behavior changes.
- Prefer small, reviewable changes. Reserve machine-local overrides for
  `.claude/settings.local.json`; keep shared defaults in `.claude.json`.
