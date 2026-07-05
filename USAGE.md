# Cloudling Usage

This guide covers the current Rust workspace under `rust/` and the `cloudling` CLI binary. If you are brand new, make the doctor health check your first run: start `cloudling`, then run `/doctor`.

## Quick-start health check

Build once (the installer checks deps and offers to install missing system packages), then run the doctor:

```bash
./install.sh            # from the repo root: checks deps, builds cloudling (debug)
cd rust
./target/debug/cloudling
# first command inside the REPL
/doctor
```

`/doctor` is the built-in setup and preflight diagnostic. Once you have a saved session, you can rerun it with `./target/debug/cloudling --resume latest /doctor`.

## Prerequisites

- Rust toolchain with `cargo`
- One of:
  - `ANTHROPIC_API_KEY` for direct API access
  - `ANTHROPIC_AUTH_TOKEN` for bearer-token auth
- Optional: `ANTHROPIC_BASE_URL` when targeting a proxy or local service

## Install / build the workspace

From the repo root, `install.sh` checks your OS, the Rust toolchain, and system
dependencies (C compiler, OpenSSL, pkg-config) — offering to install missing
system packages — then builds the `cloudling` binary:

```bash
./install.sh            # debug build (fast); add --release for an optimized binary
```

The CLI binary is available at `rust/target/debug/cloudling` after a debug build (`release/` with `--release`; `rust\target\debug\cloudling.exe` on Windows). Make the doctor check above your first post-build step. For PowerShell-first install, release ZIP, PATH, provider-switching, and Windows/WSL notification examples, see [`docs/windows-install-release.md`](./docs/windows-install-release.md).

> Manual build: `cd rust && cargo build --workspace` works too, but does not check dependencies.

## Quick start

### First-run doctor check

```bash
cd rust
./target/debug/cloudling
/doctor
```

Or run doctor directly with JSON output for scripting:

```bash
cd rust
./target/debug/cloudling doctor --output-format json
```

**Note:** Diagnostic verbs (`doctor`, `status`, `sandbox`, `version`) support `--output-format json` for machine-readable output. Invalid suffix arguments (e.g., `--json`) are now rejected at parse time rather than falling through to prompt dispatch.

### Initialize a repository

Set up a new repository with `.claw` config, `.claw.json`, `.gitignore` entries, and a `CLAUDE.md` guidance file:

```bash
cd /path/to/your/repo
./target/debug/cloudling init
```

Text mode (human-readable) shows artifact creation summary with project path and next steps. Idempotent — running multiple times in the same repo marks already-created files as "skipped".

JSON mode for scripting:
```bash
./target/debug/cloudling init --output-format json
```

Returns structured output with `project_path`, `created[]`, `updated[]`, `skipped[]` arrays (one per artifact), and `artifacts[]` carrying each file's `name` and machine-stable `status` tag. The legacy `message` field preserves backward compatibility.

**Why structured fields matter:** Claws can detect per-artifact state (`created` vs `updated` vs `skipped`) without substring-matching human prose. Use the `created[]`, `updated[]`, and `skipped[]` arrays for conditional follow-up logic (e.g., only commit if files were actually created, not just updated).

### Interactive REPL

```bash
cd rust
./target/debug/cloudling
```

### One-shot prompt

```bash
cd rust
./target/debug/cloudling prompt "summarize this repository"
```

### Shorthand prompt mode

```bash
cd rust
./target/debug/cloudling "explain rust/crates/runtime/src/lib.rs"
```

### JSON output for scripting

```bash
cd rust
./target/debug/cloudling --output-format json prompt "status"
```

### Inspect worker state

The `cloudling state` command reads `.claw/worker-state.json`, which is written by the interactive REPL or a one-shot prompt when a worker executes a task. This file contains the worker ID, session reference, model, and permission mode.

Prerequisite: You must run `cloudling` (interactive REPL) or `cloudling prompt <text>` at least once in the repository to produce the worker state file.

```bash
cd rust
./target/debug/cloudling state
```

JSON mode:
```bash
./target/debug/cloudling state --output-format json
```

If you run `cloudling state` before any worker has executed, you will see a helpful error:
```
error: no worker state file found at .claw/worker-state.json
  Hint: worker state is written by the interactive REPL or a non-interactive prompt.
  Run:   cloudling               # start the REPL (writes state on first turn)
  Or:    cloudling prompt <text> # run one non-interactive turn
  Then rerun: cloudling state [--output-format json]
```

## Advanced slash commands (Interactive REPL only)

These commands are available inside the interactive REPL (`cloudling` with no args). They extend the assistant with workspace analysis, planning, and navigation features.

### `/ultraplan` — Deep planning with multi-step reasoning

**Purpose:** Break down a complex task into steps using extended reasoning.

```bash
# Start the REPL
cloudling

# Inside the REPL
/ultraplan refactor the auth module to use async/await
/ultraplan design a caching layer for database queries
/ultraplan analyze this module for performance bottlenecks
```

Output: A structured plan with numbered steps, reasoning for each step, and expected outcomes. Use this when you want the assistant to think through a problem in detail before coding.

### `/teleport` — Jump to a file or symbol

**Purpose:** Quickly navigate to a file, function, class, or struct by name.

```bash
# Jump to a symbol
/teleport UserService
/teleport authenticate_user
/teleport RequestHandler

# Jump to a file
/teleport src/auth.rs
/teleport crates/runtime/lib.rs
/teleport ./ARCHITECTURE.md
```

Output: The file content, with the requested symbol highlighted or the file fully loaded. Useful for exploring the codebase without manually navigating directories. If multiple matches exist, the assistant shows the top candidates.

### `/bughunter` — Scan for likely bugs and issues

**Purpose:** Analyze code for common pitfalls, anti-patterns, and potential bugs.

```bash
# Scan the entire workspace
/bughunter

# Scan a specific directory or file
/bughunter src/handlers
/bughunter rust/crates/runtime
/bughunter src/auth.rs
```

Output: A list of suspicious patterns with explanations (e.g., "unchecked unwrap()", "potential race condition", "missing error handling"). Each finding includes the file, line number, and suggested fix. Use this as a first pass before a full code review.

## Model and permission controls

```bash
cd rust
./target/debug/cloudling --model sonnet prompt "review this diff"
./target/debug/cloudling --permission-mode read-only prompt "summarize Cargo.toml"
./target/debug/cloudling --permission-mode workspace-write prompt "update README.md"
./target/debug/cloudling --allowedTools read,glob "inspect the runtime crate"
```

Supported permission modes:

- `read-only`
- `workspace-write`
- `danger-full-access`

In the built-in web UI these are presented as a single **Access level** preset
(read-only / working folder / full access) plus a server-side working-folder
picker — see [`docs/web-ui.md`](docs/web-ui.md#settings-panels).

Model aliases currently supported by the CLI:

- `opus` → `claude-opus-4-6`
- `sonnet` → `claude-sonnet-4-6`
- `haiku` → `claude-haiku-4-5-20251213`

## Authentication

### API key

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### OAuth

```bash
cd rust
export ANTHROPIC_AUTH_TOKEN="anthropic-oauth-or-proxy-bearer-token"
```

### Which env var goes where

`cloudling` accepts two Anthropic credential env vars and they are **not interchangeable** — the HTTP header Anthropic expects differs per credential shape. Putting the wrong value in the wrong slot is the most common 401 we see.

| Credential shape | Env var | HTTP header | Typical source |
|---|---|---|---|
| `sk-ant-*` API key | `ANTHROPIC_API_KEY` | `x-api-key: sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) |
| OAuth access token (opaque) | `ANTHROPIC_AUTH_TOKEN` | `Authorization: Bearer ...` | an Anthropic-compatible proxy or OAuth flow that mints bearer tokens |
| OpenRouter key (`sk-or-v1-*`) | `OPENAI_API_KEY` + `OPENAI_BASE_URL=https://openrouter.ai/api/v1` | `Authorization: Bearer ...` | [openrouter.ai/keys](https://openrouter.ai/keys) |

**Why this matters:** if you paste an `sk-ant-*` key into `ANTHROPIC_AUTH_TOKEN`, Anthropic's API will return `401 Invalid bearer token` because `sk-ant-*` keys are rejected over the Bearer header. The fix is a one-line env var swap — move the key to `ANTHROPIC_API_KEY`. Recent `cloudling` builds detect this exact shape (401 + `sk-ant-*` in the Bearer slot) and append a hint to the error message pointing at the fix.

**If you meant a different provider:** if `cloudling` reports missing Anthropic credentials but you already have `OPENAI_API_KEY`, `XAI_API_KEY`, or `DASHSCOPE_API_KEY` exported, you most likely forgot to prefix the model name with the provider's routing prefix. Use `--model openai/gpt-4.1-mini` (OpenAI-compat / OpenRouter / Ollama), `--model grok` (xAI), or `--model qwen-plus` (DashScope) and the prefix router will select the right backend regardless of the ambient credentials. The error message now includes a hint that names the detected env var.


### Windows PowerShell provider switching

The same provider rules work in PowerShell. Use placeholder values in docs and tests; put real keys only in your private environment. Remove unrelated provider env vars when validating a switch so failures are easy to diagnose.

`CLAUDE_CODE_PROVIDER` is not required for normal Claw routing; prefer explicit model prefixes such as `openai/` and provider-specific env vars so PowerShell examples stay portable.

```powershell
# Anthropic direct
$env:ANTHROPIC_API_KEY = "sk-ant-REPLACE_ME"
Remove-Item Env:\OPENAI_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:\OPENAI_API_KEY -ErrorAction SilentlyContinue
.\target\debug\cloudling.exe --model "sonnet" prompt "reply with ready"

# OpenAI-compatible gateway / OpenRouter
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
$env:OPENAI_BASE_URL = "https://openrouter.ai/api/v1"
$env:OPENAI_API_KEY = "sk-or-v1-REPLACE_ME"
.\target\debug\cloudling.exe --model "openai/gpt-4.1-mini" prompt "reply with ready"

# Local OpenAI-compatible server
$env:OPENAI_BASE_URL = "http://127.0.0.1:11434/v1"
Remove-Item Env:\OPENAI_API_KEY -ErrorAction SilentlyContinue
.\target\debug\cloudling.exe --model "llama3.2" prompt "reply with ready"
```

See the full [Windows install and release quickstart](./docs/windows-install-release.md) for release artifact setup, persistent `setx` usage, and WSL notes.

## Local Models

`cloudling` can talk to local servers and provider gateways through either Anthropic-compatible or OpenAI-compatible endpoints. Use `ANTHROPIC_BASE_URL` with `ANTHROPIC_AUTH_TOKEN` for Anthropic-compatible services, or `OPENAI_BASE_URL` with `OPENAI_API_KEY` for OpenAI-compatible services. For copyable Ollama, llama.cpp, vLLM, raw `/v1/chat/completions`, and local skills install examples, see [`docs/local-openai-compatible-providers.md`](./docs/local-openai-compatible-providers.md).

### Anthropic-compatible endpoint

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:8080"
export ANTHROPIC_AUTH_TOKEN="local-dev-token"

cd rust
./target/debug/cloudling --model "claude-sonnet-4-6" prompt "reply with the word ready"
```

### OpenAI-compatible endpoint

```bash
export OPENAI_BASE_URL="http://127.0.0.1:8000/v1"
export OPENAI_API_KEY="local-dev-token"

cd rust
./target/debug/cloudling --model "qwen2.5-coder" prompt "reply with the word ready"
```

### Ollama

```bash
export OPENAI_BASE_URL="http://127.0.0.1:11434/v1"
unset OPENAI_API_KEY

cd rust
./target/debug/cloudling --model "llama3.2" prompt "summarize this repository in one sentence"
```

### OpenRouter

```bash
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
export OPENAI_API_KEY="sk-or-v1-..."

cd rust
./target/debug/cloudling --model "openai/gpt-4.1-mini" prompt "summarize this repository in one sentence"
```

### Alibaba DashScope (Qwen)

For Qwen models via Alibaba's native DashScope API (higher rate limits than OpenRouter):

```bash
export DASHSCOPE_API_KEY="sk-..."

cd rust
./target/debug/cloudling --model "qwen/qwen-max" prompt "hello"
# or bare:
./target/debug/cloudling --model "qwen-plus" prompt "hello"
```

Model names starting with `qwen/` or `qwen-` are automatically routed to the DashScope compatible-mode endpoint (`https://dashscope.aliyuncs.com/compatible-mode/v1`). You do **not** need to set `OPENAI_BASE_URL` or unset `ANTHROPIC_API_KEY` — the model prefix wins over the ambient credential sniffer.

Reasoning variants (`qwen-qwq-*`, `qwq-*`, `*-thinking`) automatically strip `temperature`/`top_p`/`frequency_penalty`/`presence_penalty` before the request hits the wire (these params are rejected by reasoning models).

## Supported Providers & Models

`cloudling` has three built-in provider backends. The provider is selected automatically based on the model name, falling back to whichever credential is present in the environment.

### Provider matrix

| Provider | Protocol | Auth env var(s) | Base URL env var | Default base URL |
|---|---|---|---|---|
| **Anthropic** (direct) | Anthropic Messages API | `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` | `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` |
| **xAI** | OpenAI-compatible | `XAI_API_KEY` | `XAI_BASE_URL` | `https://api.x.ai/v1` |
| **OpenAI-compatible** | OpenAI Chat Completions | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| **DashScope** (Alibaba) | OpenAI-compatible | `DASHSCOPE_API_KEY` | `DASHSCOPE_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |

The OpenAI-compatible backend also serves as the gateway for **OpenRouter**, **Ollama**, and any other service that speaks the OpenAI `/v1/chat/completions` wire format — just point `OPENAI_BASE_URL` at the service.

**Model-name prefix routing:** If a model name starts with `openai/`, `gpt-`, `qwen/`, `qwen-`, `kimi/`, or `kimi-`, the provider is selected by the prefix regardless of which env vars are set. This prevents accidental misrouting to Anthropic when multiple credentials exist in the environment. For the default OpenAI API, `openai/` is a routing prefix and is stripped before the request hits the wire. For a custom `OPENAI_BASE_URL`, slash-containing OpenAI-compatible slugs (for example OpenRouter-style `openai/gpt-4.1-mini`) are preserved so the gateway receives the model ID it expects.

### Tested models and aliases

These are the models registered in the built-in alias table with known token limits:

| Alias | Resolved model name | Provider | Max output tokens | Context window |
|---|---|---|---|---|
| `opus` | `claude-opus-4-6` | Anthropic | 32 000 | 200 000 |
| `sonnet` | `claude-sonnet-4-6` | Anthropic | 64 000 | 200 000 |
| `haiku` | `claude-haiku-4-5-20251213` | Anthropic | 64 000 | 200 000 |
| `grok` / `grok-3` | `grok-3` | xAI | 64 000 | 131 072 |
| `grok-mini` / `grok-3-mini` | `grok-3-mini` | xAI | 64 000 | 131 072 |
| `grok-2` | `grok-2` | xAI | — | — |
| `kimi` | `kimi-k2.5` | DashScope | 16 384 | 256 000 |
| `gpt-4.1` / `gpt-4.1-mini` / `gpt-4.1-nano` | same | OpenAI-compatible | 32 768 | 1 047 576 |
| `gpt-5.4` / `gpt-5.4-mini` / `gpt-5.4-nano` | same | OpenAI-compatible | 128 000 | 1 000 000 / 400 000 |

Any model name that does not match an alias is passed through verbatim after provider routing is resolved. This is how you use OpenRouter model slugs (`openai/gpt-4.1-mini` with a custom `OPENAI_BASE_URL`), Ollama tags (`llama3.2`), or full Anthropic model IDs (`claude-sonnet-4-20250514`).

### User-defined aliases

You can add custom aliases in any settings file (`~/.claw/settings.json`, `.claw/settings.json`, or `.claw/settings.local.json`):

```json
{
  "aliases": {
    "fast": "claude-haiku-4-5-20251213",
    "smart": "claude-opus-4-6",
    "cheap": "grok-3-mini"
  }
}
```

Local project settings override user-level settings. Aliases resolve through the built-in table, so `"fast": "haiku"` also works.

### How provider detection works

1. If the resolved model name starts with `claude` → Anthropic.
2. If it starts with `grok` → xAI.
3. If it starts with `openai/` or `gpt-` → OpenAI-compatible.
4. If it starts with `qwen/`, `qwen-`, `kimi/`, or `kimi-` → DashScope-compatible OpenAI wire format.
5. If `OPENAI_BASE_URL` and `OPENAI_API_KEY` are set, unknown model names route to the OpenAI-compatible client for local/gateway servers.
6. Otherwise, `cloudling` checks which credential is set: Anthropic first, then OpenAI, then xAI. If only `OPENAI_BASE_URL` is set, it still routes to OpenAI-compatible for authless local servers.
7. If nothing matches, it defaults to Anthropic.


### Provider diagnostics and custom OpenAI-compatible parameters

The API layer exposes a provider diagnostics snapshot via `api::provider_diagnostics_for_model(model)`. It reports the resolved provider, auth/base-url environment variables, default base URL, whether the provider uses the OpenAI-compatible wire format, whether reasoning tuning parameters are stripped, whether DeepSeek V4 reasoning history is preserved, proxy support, extra-body support, and whether slash-containing model IDs are preserved for custom OpenAI-compatible gateways.

For gateway features that are not first-class request fields yet, `MessageRequest::extra_body` passes through provider-specific JSON parameters such as `web_search_options` or `parallel_tool_calls`. Core protocol fields (`model`, `messages`, `stream`, `tools`, `tool_choice`, `max_tokens`, and `max_completion_tokens`) are protected and cannot be overridden through `extra_body`.

## File context and navigation

Use `@path/to/file` in prompts to submit repository files as context, for example `Read @src/app.ts and explain the bug`, `Compare @old.md and @new.md`, or `Use @logs/error.txt as context and suggest a fix`. Prompt history, `Ctrl-r`, and long-output scrolling come from your shell, terminal, or tmux rather than from Claw itself. See [`docs/navigation-file-context.md`](./docs/navigation-file-context.md) for scrollback, attachment, and secret-redaction guidance.

## FAQ

### Is Cloudling Claude-only?

No. Cloudling is a Claude-Code-shaped workflow/runtime, not a Claude-only product. It can target Anthropic and OpenAI-compatible/provider-routed/local models depending on config. Non-Claude providers may require stricter response-shape and tool-call compatibility, so some workflows can be rougher than first-party Anthropic/OpenAI paths; provider-specific identity leaks are bugs, not product intent. See [`docs/local-openai-compatible-providers.md`](./docs/local-openai-compatible-providers.md) for local provider examples.

### What about Codex?

The name "codex" appears in the Cloudling ecosystem but it does **not** refer to OpenAI Codex (the code-generation model). Here is what it means in this project:

- **`.codex/` directories** (e.g. `.codex/skills`, `.codex/agents`, `.codex/commands`) are legacy lookup paths that `cloudling` still scans alongside the primary `.claw/` directories.
- **`CODEX_HOME`** is an optional environment variable that points to a custom root for user-level skill and command lookups.

`cloudling` does **not** support OpenAI Codex sessions, the Codex CLI, or Codex session import/export. If you need to use OpenAI models (like GPT-4.1), configure the OpenAI-compatible provider as shown above in the [OpenAI-compatible endpoint](#openai-compatible-endpoint) and [OpenRouter](#openrouter) sections.

## HTTP proxy support

`cloudling` honours the standard `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` environment variables (both upper- and lower-case spellings are accepted) when issuing outbound requests to Anthropic, OpenAI-, and xAI-compatible endpoints. Set them before launching the CLI and the underlying `reqwest` client will be configured automatically.

### Environment variables

```bash
export HTTPS_PROXY="http://proxy.corp.example:3128"
export HTTP_PROXY="http://proxy.corp.example:3128"
export NO_PROXY="localhost,127.0.0.1,.corp.example"

cd rust
./target/debug/cloudling prompt "hello via the corporate proxy"
```

### Programmatic `proxy_url` config option

As an alternative to per-scheme environment variables, the `ProxyConfig` type exposes a `proxy_url` field that acts as a single catch-all proxy for both HTTP and HTTPS traffic. When `proxy_url` is set it takes precedence over the separate `http_proxy` and `https_proxy` fields.

```rust
use api::{build_http_client_with, ProxyConfig};

// From a single unified URL (config file, CLI flag, etc.)
let config = ProxyConfig::from_proxy_url("http://proxy.corp.example:3128");
let client = build_http_client_with(&config).expect("proxy client");

// Or set the field directly alongside NO_PROXY
let config = ProxyConfig {
    proxy_url: Some("http://proxy.corp.example:3128".to_string()),
    no_proxy: Some("localhost,127.0.0.1".to_string()),
    ..ProxyConfig::default()
};
let client = build_http_client_with(&config).expect("proxy client");
```

### Notes

- When both `HTTPS_PROXY` and `HTTP_PROXY` are set, the secure proxy applies to `https://` URLs and the plain proxy applies to `http://` URLs.
- `proxy_url` is a unified alternative: when set, it applies to both `http://` and `https://` destinations, overriding the per-scheme fields.
- `NO_PROXY` accepts a comma-separated list of host suffixes (for example `.corp.example`) and IP literals.
- Empty values are treated as unset, so leaving `HTTPS_PROXY=""` in your shell will not enable a proxy.
- If a proxy URL cannot be parsed, `cloudling` falls back to a direct (no-proxy) client so existing workflows keep working; double-check the URL if you expected the request to be tunnelled.

## Built-in web UI

`cloudling openai-serve --ui` serves a browser chat page on the same port as the API (the service is headless by default). The easiest way to enable it is the service installer's **UI-first mode**: choose the built-in web UI at the first wizard prompt and it skips the backend questions, generates a `CLOUDLING_UI_TOKEN`, sets the UI env vars, and prints the page address + token — you then point cloudling at your engine in the browser. Manually, pass the `--ui` flag and set `CLOUDLING_UI_TOKEN` (Bearer token for the `/ui/*` data endpoints), `CLOUDLING_UI_DATA_DIR` (dialog/preset storage), and `CLOUDLING_OPENAI_ENV_FILE` (so the UI can save engine settings and restart the core). See [`docs/web-ui.md`](./docs/web-ui.md) for the full guide, all environment variables, and the `/ui/*` auth model.

## Windows desktop (tray)

On Windows, the same `cloudling.exe` can run as a native system-tray app instead of from a terminal:
double-click it (or run `cloudling tray`) and it starts serve + the built-in UI in the background, with no
console window, and shows a tray icon. The right-click menu opens the UI in the browser, toggles
start-at-login (off by default), or uninstalls (`cloudling uninstall` removes per-user data under
`%USERPROFILE%\.claw` plus the autostart entry). Running `cloudling` from a terminal stays the normal
CLI/REPL. No Docker or WSL required. Full walkthrough: [`docs/windows-install-release.md`](./docs/windows-install-release.md).

## Backend timeouts and retries

The HTTP client that talks to your model backend has a tunable connect timeout and retry policy, set via optional `CLOUDLING_BACKEND_*` environment variables. They are read when the client is built per request, so changes apply without a restart, and the defaults are sensible — an unreachable backend surfaces as an error in seconds rather than minutes.

| Variable | Default | Effect |
|---|---|---|
| `CLOUDLING_BACKEND_CONNECT_TIMEOUT_SECS` | `10` | Connection-establishment timeout. `0` disables it. |
| `CLOUDLING_BACKEND_READ_TIMEOUT_SECS` | *(off)* | Max idle gap between response bytes. Off by default so a long/streaming reply is never cut short; `0` also means off. Enable deliberately. |
| `CLOUDLING_BACKEND_MAX_RETRIES` | `3` | Retries on a retryable failure (connection refused, timeout, 429, 5xx). |
| `CLOUDLING_BACKEND_INITIAL_BACKOFF_SECS` | `1` | Starting backoff, doubled up to the cap. |
| `CLOUDLING_BACKEND_MAX_BACKOFF_SECS` | `8` | Backoff ceiling. |

No overall request timeout is set on purpose: a single call may stream for a long time and the agent loop makes many calls, so a wall-clock cap would cut off legitimate long replies.

## Skills

Use `/skills list` in the interactive REPL or `cloudling skills --output-format json` from the direct CLI to inspect installed skills. For offline/local installs, install the directory that contains `SKILL.md`, then verify the discovered name before invoking it:

```text
/skills install /absolute/path/to/my-skill
/skills list
/skills my-skill
```

If install succeeds but invocation fails with a provider HTTP error, treat provider setup separately: run `cloudling doctor` and a one-shot prompt smoke test before reinstalling the skill. See [`docs/local-openai-compatible-providers.md`](./docs/local-openai-compatible-providers.md#local-skills-install-from-disk) for the full checklist.

## Common operational commands

```bash
cd rust
./target/debug/cloudling status
./target/debug/cloudling sandbox
./target/debug/cloudling agents
./target/debug/cloudling mcp
./target/debug/cloudling skills
./target/debug/cloudling system-prompt --cwd .. --date 2026-04-04
```

## Install an external skill

`cloudling skills install <path>` accepts a local skill directory that contains
`SKILL.md` or a standalone markdown file. This is useful when a companion
repository ships a skill prompt that should be available through `/skills`.

For example, install TweetClaw as an X/Twitter automation skill:

```bash
# From a parent directory that contains claw-lab
git clone https://github.com/Xquik-dev/tweetclaw
cd claw-lab/rust
./target/debug/cloudling skills install ../../tweetclaw/skills/tweetclaw
./target/debug/cloudling skills show tweetclaw
```

TweetClaw gives `cloudling` users a local skill guide for OpenClaw/Xquik workflows
such as tweet search, reply search, follower export, monitors, webhooks, and
approval-gated posting. Configure any Xquik credentials outside the prompt and
avoid pasting API keys into chat.

## Session management

REPL turns are persisted under `.claw/sessions/` in the current workspace.

```bash
cd rust
./target/debug/cloudling --resume latest
./target/debug/cloudling --resume latest /status /diff
```

Useful interactive commands include `/help`, `/status`, `/cost`, `/config`, `/session`, `/model`, `/permissions`, and `/export`.

## Config file resolution order

Runtime config is loaded in this order, with later entries overriding earlier ones:

1. `~/.claw.json`
2. `~/.config/claw/settings.json`
3. `<repo>/.claw.json`
4. `<repo>/.claw/settings.json`
5. `<repo>/.claw/settings.local.json`

## Mock parity harness

The workspace includes a deterministic Anthropic-compatible mock service and parity harness.

```bash
cd rust
./scripts/run_mock_parity_harness.sh
```

Manual mock service startup:

```bash
cd rust
cargo run -p mock-anthropic-service -- --bind 127.0.0.1:0
```

## Verification

```bash
cd rust
cargo test --workspace
```

## Workspace overview

Current Rust crates:

- `api`
- `cloudling-analog`
- `cloudling-desktop` (Windows-only tray/desktop integration; no-op stubs elsewhere)
- `cloudling-rag-service`
- `commands`
- `compat-harness`
- `mock-anthropic-service`
- `plugins`
- `runtime`
- `cloudling-cli` (package `cloudling-cli`; the `cloudling` binary)
- `telemetry`
- `tools`
