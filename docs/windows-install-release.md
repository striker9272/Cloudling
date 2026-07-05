# Windows install and release quickstart

> **Status:** Linux is the primary server platform for Cloudling. On Windows, the **native desktop app
> (system tray)** described below is the recommended path and has been tested on Windows 11; the
> PowerShell CLI / build-from-source paths are also supported for development. macOS is build-from-source
> / best-effort only — CI does not produce macOS release binaries (there is no macOS port yet). For the
> server/Linux path, see the root [`README.md`](../README.md) and [`USAGE.md`](../USAGE.md).

## Native desktop app (system tray)

The simplest way to run Cloudling on Windows — no Docker, no WSL, no terminal. Tested on Windows 11.

1. Get `cloudling-windows-x64.exe` from a GitHub release (or build it — see Option A below) and put it anywhere,
   e.g. your Desktop. You may rename it to `cloudling.exe`.
2. **Double-click it.** It starts the agent server with the built-in web UI in the background and adds a
   cloud icon to the system tray (near the clock). No console window stays open.
3. **Right-click the tray icon** for the menu:
   - **Open Cloudling** — opens the chat UI in your browser (`http://127.0.0.1:4097/`). On first run, point it
     at your model backend and save.
   - **Start at login** — optional autostart (off by default; a per-user `HKCU\...\Run` registry entry).
   - **Uninstall…** — after a confirmation, removes the per-user data (conversations, keys, settings) and the
     autostart entry.
   - **Quit** — stops the background server and exits.

Per-user data (settings + conversations) lives under `%USERPROFILE%\.claw`. The same `cloudling.exe` run from a
terminal stays a normal CLI/REPL (see below). Under the hood the tray mode is `cloudling tray` and the menu's
uninstall is `cloudling uninstall`.

> Windows SmartScreen may warn about an unsigned download — choose **More info → Run anyway**. Code signing
> is planned.

## PowerShell CLI / build-from-source

The rest of this page is the PowerShell-first path for installing, verifying, and safely switching providers
on Windows from the command line. It is intentionally copyable without embedding live secrets.

## Choose an install path

### Option A: build from source in PowerShell

Use this when you are developing Cloudling or testing a local checkout.

```powershell
git clone https://github.com/striker9272/claw-lab
Set-Location .\claw-lab\rust
cargo build --workspace
.\target\debug\cloudling.exe --help
.\target\debug\cloudling.exe doctor
```

For an optimized local binary:

```powershell
Set-Location .\claw-lab\rust
cargo build --workspace --release
.\target\release\cloudling.exe --help
```

### Option B: use a release artifact

Use this when a GitHub release publishes a Windows artifact. The release workflow publishes `cloudling-windows-x64.exe` plus `cloudling-windows-x64.exe.sha256`; if a future release wraps the binary in a ZIP, prefer the `windows-x86_64` / `pc-windows-msvc` asset and its matching checksum file.

```powershell
$Asset = "cloudling-windows-x64.exe"
$InstallRoot = "$env:LOCALAPPDATA\Programs\cloudling"
New-Item -ItemType Directory -Force $InstallRoot | Out-Null

# Download $Asset and $Asset.sha256 from the release page, then verify them:
$Actual = (Get-FileHash ".\$Asset" -Algorithm SHA256).Hash.ToLowerInvariant()
$Expected = (Get-Content ".\$Asset.sha256" | Select-Object -First 1).Split()[0].ToLowerInvariant()
if ($Actual -ne $Expected) { throw "checksum mismatch for $Asset" }

Copy-Item ".\$Asset" "$InstallRoot\cloudling.exe" -Force
& "$InstallRoot\cloudling.exe" --help
& "$InstallRoot\cloudling.exe" doctor
```

To make that binary available in new PowerShell windows:

```powershell
$InstallRoot = "$env:LOCALAPPDATA\Programs\cloudling"
[Environment]::SetEnvironmentVariable(
  "Path",
  [Environment]::GetEnvironmentVariable("Path", "User") + ";$InstallRoot",
  "User"
)
```

Open a new terminal before running `cloudling --help` from another directory.

### Option C: WSL

The repository `install.sh` path is for Linux, macOS, and Windows via WSL. Run it from inside your WSL distribution, not from native PowerShell:

```powershell
wsl --install
wsl
```

Then inside WSL:

```bash
git clone https://github.com/striker9272/claw-lab
cd claw-lab
./install.sh
```

## First-run health checks

Run these before using live prompts:

```powershell
Set-Location .\claw-lab\rust
.\target\debug\cloudling.exe --help
.\target\debug\cloudling.exe doctor
.\target\debug\cloudling.exe status --output-format json
.\target\debug\cloudling.exe config --output-format json
```

`doctor`, `status`, `config`, and `version` support `--output-format json`; do not use a separate `--json` suffix.

## Safe credential setup

Set keys only in your local environment or a private `.env` file. Do not paste real keys into shell history shared with others, issue trackers, or documentation.

Current PowerShell session only:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-REPLACE_ME"
```

Persist for future PowerShell windows:

```powershell
setx ANTHROPIC_API_KEY "sk-ant-REPLACE_ME"
```

Open a new terminal after `setx`. To remove a session-local key while testing provider switching:

```powershell
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
```

## Safe provider switching examples

Provider routing is model-prefix first. When multiple credentials exist, choose an explicit model prefix so `cloudling` does not infer the wrong backend.

### Anthropic direct

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-REPLACE_ME"
Remove-Item Env:\OPENAI_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:\OPENAI_API_KEY -ErrorAction SilentlyContinue

.\target\debug\cloudling.exe --model "sonnet" prompt "reply with ready"
```

### OpenAI-compatible gateway or OpenRouter

```powershell
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
$env:OPENAI_BASE_URL = "https://openrouter.ai/api/v1"
$env:OPENAI_API_KEY = "sk-or-v1-REPLACE_ME"

.\target\debug\cloudling.exe --model "openai/gpt-4.1-mini" prompt "reply with ready"
```

For the default OpenAI-compatible API, omit `OPENAI_BASE_URL` or set it to `https://api.openai.com/v1`, and keep the `openai/` or `gpt-` model prefix explicit.

### Local OpenAI-compatible server

Use a loopback URL and a placeholder token unless your local server requires a real one:

```powershell
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
$env:OPENAI_BASE_URL = "http://127.0.0.1:11434/v1"
$env:OPENAI_API_KEY = "local-dev-token"

.\target\debug\cloudling.exe --model "llama3.2" prompt "reply with ready"
```

If the local server is authless, remove `OPENAI_API_KEY` instead of putting a real cloud key into local testing:

```powershell
Remove-Item Env:\OPENAI_API_KEY -ErrorAction SilentlyContinue
```

### DashScope / Qwen

```powershell
Remove-Item Env:\ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
$env:DASHSCOPE_API_KEY = "sk-REPLACE_ME"

.\target\debug\cloudling.exe --model "qwen-plus" prompt "reply with ready"
```

## Windows and WSL notifications

Notification support is exposed through the `notifications` slash command in the interactive REPL. Use JSON/status commands first to confirm the CLI runs, then configure notifications from the REPL if your workflow needs them.

Native PowerShell smoke path:

```powershell
Set-Location .\claw-lab\rust
.\target\debug\cloudling.exe
# inside the REPL:
/notifications
```

WSL smoke path:

```bash
cd claw-lab/rust
./target/debug/cloudling
# inside the REPL:
/notifications
```

When moving between PowerShell and WSL, keep provider keys in the environment where `cloudling` is actually running; Windows user env vars set with `setx` are not automatically the same as WSL shell exports.

## Troubleshooting checklist

- `cloudling` not found: use `cloudling.exe` on Windows or run the binary by full path (`.\target\debug\cloudling.exe`).
- `cargo` not found: reopen PowerShell after installing Rust from <https://rustup.rs/>.
- `401 Invalid bearer token`: put `sk-ant-*` values in `ANTHROPIC_API_KEY`, not `ANTHROPIC_AUTH_TOKEN`.
- Wrong provider selected: add an explicit model prefix such as `openai/gpt-4.1-mini`, `qwen-plus`, or `grok`.
- Release ZIP extracted but command still fails: open a new terminal after updating the user `Path`, or call `& "$env:LOCALAPPDATA\Programs\cloudling\cloudling.exe"` directly.
