# Claw Lab

<p align="center">
  <a href="https://github.com/striker9272/claw-lab">striker9272/claw-lab</a>
  ·
  <a href="./USAGE.md">Usage</a>
  ·
  <a href="./rust/README.md">Rust workspace</a>
  ·
  <a href="./PARITY.md">Parity</a>
  ·
  <a href="./ROADMAP.md">Roadmap</a>
  ·
  <a href="./CONTRIBUTING.md">Contributing</a>
  ·
  <a href="./SECURITY.md">Security</a>
</p>

<p align="center">
  <img src="assets/claw-hero.jpeg" alt="Claw Lab" width="300" />
</p>

Claw Lab is an experimental fork of Claw Code focused on running the Rust `claw` agent through a local/OpenAI-compatible stack and Open WebUI.

The canonical implementation lives in [`rust/`](./rust). This fork tracks the upstream Claw Code direction while adding local-agent/server work needed for a home-lab deployment.

## Claw Lab fork focus

Current fork additions include:

* OpenAI-compatible server work for `/v1/chat/completions`.
* Real streaming support for OpenAI-style SSE responses.
* Open WebUI tool-result rendering for Claw tool calls.
* Ephemeral OpenAI sessions by default, so Open WebUI owns chat history through `messages[]`.
* Optional persistent sessions through an explicit valid `X-Claw-Session-Key`.
* Built-in `WebSearch` JSON `results[]` parsing with snippets, while preserving DuckDuckGo/generic HTML fallback.
* Stable served/backend model split: Open WebUI can see a durable model id such as `claw-lab-agent`, while the provider/backend model remains internal.
* Neutral OpenAI service workdir support, so the live OWUI-facing agent does not automatically start inside the Claw source tree.
* Portable quiet deploy helper for safely rebuilding and installing the OpenAI server binary.
* Portable OpenAI service installer for generating the systemd unit, env file, wrapper, neutral workdir, and sandbox layout.


### OpenAI server deploy helper

For an already configured OpenAI-compatible Claw service:

```bash
cd rust

scripts/deploy-openai-server.sh \
  --runtime-bin /path/to/claw \
  --service your-claw-openai.service \
  --health-url http://127.0.0.1:4097/health
```

The deploy helper prints compact staged checks, writes full logs to `/tmp/claw-deploy-openai-*.log`, backs up the previous runtime binary, installs atomically through `.new`, optionally restarts a systemd service, checks health, scans the journal, and prints a rollback command.

On my combsrv host I use a local wrapper outside the repository:

```bash
claw-lab-deploy-openai
```

The wrapper only supplies local paths, service name, and health URL. The portable deploy logic lives in [`rust/scripts/deploy-openai-server.sh`](./rust/scripts/deploy-openai-server.sh).


> [!IMPORTANT]
> Start with [`USAGE.md`](./USAGE.md) for build, auth, CLI, session, and parity-harness workflows. For file submission/navigation questions, see [Navigation and file context](./docs/navigation-file-context.md). For local OpenAI-compatible models and offline skill installs, see [Local OpenAI-compatible providers and skills setup](./docs/local-openai-compatible-providers.md). Windows users can jump to the PowerShell-first [Windows install and release quickstart](./docs/windows-install-release.md). Make `claw doctor` your first health check after building, use [`rust/README.md`](./rust/README.md) for crate-level details, read [`PARITY.md`](./PARITY.md) for the current Rust-port checkpoint, and see [`docs/container.md`](./docs/container.md) for the container-first workflow.
>
> **ACP / Zed status:** `claw-code` does not ship an ACP/Zed daemon or JSON-RPC entrypoint yet. Run `claw acp` (or `claw --acp`) for the current status instead of guessing from source layout; `claw acp serve` is currently a discoverability alias only, returns status with exit code 0, and real ACP support remains tracked separately in `ROADMAP.md`. For the public JSON contract, see [`docs/g011-acp-json-rpc-status-contract.md`](./docs/g011-acp-json-rpc-status-contract.md).

### OpenAI service installer

For a fresh OpenAI-compatible Claw service, use the portable installer:

```bash
cd rust

scripts/install-openai-service.sh \
  --service claw-openai.service \
  --user claw \
  --runtime-bin /opt/claw/bin/claw \
  --wrapper /usr/local/bin/claw-openai-serve \
  --env-file /etc/claw/openai.env \
  --workdir /var/lib/claw/work \
  --sandbox-dir /var/lib/claw/sandbox \
  --tmpdir /var/lib/claw/sandbox/tmp \
  --bind 127.0.0.1:4097 \
  --base-url http://127.0.0.1:8000/v1 \
  --backend-model claw-external-api \
  --served-model-id claw-agent \
  --permission-mode read-only \
  --enable \
  --restart
```

The installer writes the environment file, wrapper script, and systemd unit. It keeps the live OpenAI service in a neutral workdir instead of the source repository, which prevents ordinary Open WebUI chats from automatically loading repository-local `CLAUDE.md`, git status, recent commits, and project settings.

The model names have separate roles:

```text
--served-model-id  model id exposed to Open WebUI, /health, and /v1/models
--backend-model    internal OpenAI-compatible provider/adaptor model id
```

Use `scripts/deploy-openai-server.sh` later when only the compiled runtime binary needs to be rebuilt and replaced.

## Current repository shape

- **`rust/`** — canonical Rust workspace and the `claw` CLI binary
- **`USAGE.md`** — task-oriented usage guide for the current product surface
- **`PARITY.md`** — Rust-port parity status and migration notes
- **`ROADMAP.md`** — active roadmap and cleanup backlog
- **`PHILOSOPHY.md`** — project intent and system-design framing
- **`src/` + `tests/`** — companion Python/reference workspace and audit helpers; not the primary runtime surface

## Quick start

> [!NOTE]
> [!WARNING]
> **`cargo install claw-code` installs the wrong thing.** The `claw-code` crate on crates.io is a deprecated stub that places `claw-code-deprecated.exe` — not `claw`. Running it only prints `"claw-code has been renamed to agent-code"`. **Do not use `cargo install claw-code`.** Either build from source (this repo) or install the upstream binary:
> ```bash
> cargo install agent-code   # upstream binary — installs 'agent.exe' (Windows) / 'agent' (Unix), NOT 'agent-code'
> ```
This repo (`striker9272/claw-lab`) is **build-from-source only** — follow the steps below.

```bash
# 1. Clone and build
git clone https://github.com/striker9272/claw-lab
cd claw-lab/rust
cargo build --workspace

# 2. Set your API key (Anthropic API key — not a Claude subscription)
export ANTHROPIC_API_KEY="sk-ant-..."

# 3. Verify everything is wired correctly
./target/debug/claw doctor

# 4. Run a prompt
./target/debug/claw prompt "say hello"
```

> [!NOTE]
> **Windows (PowerShell):** the binary is `claw.exe`, not `claw`. Use `.\target\debug\claw.exe` or run `cargo run -- prompt "say hello"` to skip the path lookup.

### Windows setup

**PowerShell is a supported Windows path.** Use whichever shell works for you. The common onboarding issues on Windows are:

1. **Install Rust first** — download from <https://rustup.rs/> and run the installer. Close and reopen your terminal when it finishes.
2. **Verify Rust is on PATH:**
   ```powershell
   cargo --version
   ```
   If this fails, reopen your terminal or run the PATH setup from the Rust installer output, then retry.
3. **Clone and build** (works in PowerShell, Git Bash, or WSL):
   ```powershell
   git clone https://github.com/striker9272/claw-lab
   cd claw-lab/rust
   cargo build --workspace
   ```
4. **Run** (PowerShell — note `.exe` and backslash):
   ```powershell
   $env:ANTHROPIC_API_KEY = "sk-ant-..."
   .\target\debug\claw.exe prompt "say hello"
   ```

For release ZIPs, PATH setup, provider switching, and notification smoke checks, see [`docs/windows-install-release.md`](./docs/windows-install-release.md).

**Git Bash / WSL** are optional alternatives, not requirements. If you prefer bash-style paths (`/c/Users/you/...` instead of `C:\Users\you\...`), Git Bash (ships with Git for Windows) works well. In Git Bash, the `MINGW64` prompt is expected and normal — not a broken install.

## Post-build: locate the binary and verify

After running `cargo build --workspace`, the `claw` binary is built but **not** automatically installed to your system. Here's where to find it and how to verify the build succeeded.

### Binary location

After `cargo build --workspace` in `claw-lab/rust/`:

**Debug build (default, faster compile):**
- **macOS/Linux:** `rust/target/debug/claw`
- **Windows:** `rust/target/debug/claw.exe`

**Release build (optimized, slower compile):**
- **macOS/Linux:** `rust/target/release/claw`
- **Windows:** `rust/target/release/claw.exe`

If you ran `cargo build` without `--release`, the binary is in the `debug/` folder.

### Verify the build succeeded

Test the binary directly using its path:

```bash
# macOS/Linux (debug build)
./rust/target/debug/claw --help
./rust/target/debug/claw doctor

# Windows PowerShell (debug build)
.\rust\target\debug\claw.exe --help
.\rust\target\debug\claw.exe doctor
```

PowerShell smoke commands that do not require live credentials:

```powershell
$env:CLAW_CONFIG_HOME = Join-Path $env:TEMP "claw config home"
New-Item -ItemType Directory -Force -Path $env:CLAW_CONFIG_HOME | Out-Null
Remove-Item Env:\ANTHROPIC_API_KEY, Env:\ANTHROPIC_AUTH_TOKEN, Env:\OPENAI_API_KEY -ErrorAction SilentlyContinue
.\rust\target\debug\claw.exe help
.\rust\target\debug\claw.exe status
.\rust\target\debug\claw.exe config env
.\rust\target\debug\claw.exe doctor
```

If these commands succeed, the build is working. `claw doctor` is your first health check — it validates your API key, model access, and tool configuration.

### Optional: Add to PATH

If you want to run `claw` from any directory without the full path, choose one of these approaches:

**Option 1: Symlink (macOS/Linux)**
```bash
ln -s $(pwd)/rust/target/debug/claw /usr/local/bin/claw
```
Then reload your shell and test:
```bash
claw --help
```

**Option 2: Use `cargo install` (all platforms)**

Build and install to Cargo's default location (`~/.cargo/bin/`, which is usually on PATH):
```bash
# From the claw-code/rust/ directory
cargo install --path . --force

# Then from anywhere
claw --help
```

**Option 3: Update shell profile (bash/zsh)**

Add this line to `~/.bashrc` or `~/.zshrc`:
```bash
export PATH="$(pwd)/rust/target/debug:$PATH"
```

Reload your shell:
```bash
source ~/.bashrc  # or source ~/.zshrc
claw --help
```

### Troubleshooting

- **"command not found: claw"** — The binary is in `rust/target/debug/claw`, but it's not on your PATH. Use the full path `./rust/target/debug/claw` or symlink/install as above.
- **"permission denied"** — On macOS/Linux, you may need `chmod +x rust/target/debug/claw` if the executable bit isn't set (rare).
- **Debug vs. release** — If the build is slow, you're in debug mode (default). Add `--release` to `cargo build` for faster runtime, but the build itself will take 5–10 minutes.

> [!NOTE]
> **Auth:** claw requires an **API key** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) — Claude subscription login is not a supported auth path.

Run the workspace test suite after verifying the binary works:

```bash
cd rust
cargo test --workspace
```

## Documentation map

- [`USAGE.md`](./USAGE.md) — quick commands, auth, sessions, config, parity harness
- [`docs/navigation-file-context.md`](./docs/navigation-file-context.md) — terminal navigation, scrollback, `@path` file context, attachments, and secret-safety guidance
- [`docs/local-openai-compatible-providers.md`](./docs/local-openai-compatible-providers.md) — Ollama/llama.cpp/vLLM setup, Claw multi-provider positioning, and local skills install checks
- [`docs/windows-install-release.md`](./docs/windows-install-release.md) — PowerShell-first install, release artifact, provider switching, and Windows/WSL notification smoke paths
- [`rust/README.md`](./rust/README.md) — crate map, CLI surface, features, workspace layout
- [`PARITY.md`](./PARITY.md) — parity status for the Rust port
- [`rust/MOCK_PARITY_HARNESS.md`](./rust/MOCK_PARITY_HARNESS.md) — deterministic mock-service harness details
- [`ROADMAP.md`](./ROADMAP.md) — active roadmap and open cleanup work
- [`docs/g004-events-reports-contract.md`](./docs/g004-events-reports-contract.md) — Stream 2 lane event/report contract guidance for consumers
- [`PHILOSOPHY.md`](./PHILOSOPHY.md) — why the project exists and how it is operated
- [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`SECURITY.md`](./SECURITY.md), [`SUPPORT.md`](./SUPPORT.md), and [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — contribution, vulnerability-reporting, support, and community policies
- [`LICENSE`](./LICENSE) — MIT license for this repository

## Ecosystem

Claw Code is built in the open alongside the broader UltraWorkers toolchain:

- [clawhip](https://github.com/Yeachan-Heo/clawhip)
- [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)
- [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)
- [UltraWorkers Discord](https://discord.gg/5TUQKqFWd)

## Ownership / affiliation disclaimer

- This repository does **not** claim ownership of the original Claude Code source material.
- This repository is **not affiliated with, endorsed by, or maintained by Anthropic**.
