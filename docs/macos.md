# macOS install quickstart

> **Status:** the macOS port is **new and not yet verified on real hardware.** The workspace builds and
> the `cloudling` binary runs on Apple Silicon (verified in CI), and the release pipeline produces a macOS
> binary and a `.dmg` desktop bundle — but those are currently published as **pre-release / build
> artifacts only** (not attached to public GitHub releases) until a live smoke test on a Mac passes. The
> menu-bar tray, `.app` bundle, and launchd service below are implemented but **unverified end-to-end**.
> Linux remains the primary server platform; for the server/Linux path see the root
> [`README.md`](../README.md) and [`USAGE.md`](../USAGE.md). Treat this page as experimental.

## Requirements

The prebuilt macOS binary and `.dmg`/`.app` target **Apple Silicon (`aarch64-apple-darwin`) running
macOS 11.0 Big Sur or later** (the bundle declares `LSMinimumSystemVersion 11.0`). This is not an
arbitrary floor: every Apple Silicon Mac ships with macOS 11.0 or newer, so it covers the whole
Apple-Silicon fleet.

What this means in practice:

- **Intel Macs** cannot run the prebuilt binary at all — it is an arm64 build. Intel (`x86_64-apple-darwin`)
  is **build-from-source only** for now (see below). Note Apple itself is winding Intel down: macOS Tahoe
  (26) is the last release to support Intel Macs, and macOS 27 is Apple-Silicon-only.
- **macOS older than 11.0** (Big Sur) is not supported. Opening the `.app` on, say, macOS 10.x (High Sierra,
  Mojave, Catalina) raises *"the application requires macOS 11.0 or later"* — that is the OS-version gate
  doing its job, not a bug. Such machines are also Intel, so the arm64 build would not run regardless.

Lowering the floor to old/Intel macOS is intentionally out of scope: it cannot be smoke-tested on CI
(GitHub runners are modern macOS) and targets an OS Apple no longer maintains.

## Desktop app (menu-bar tray) — experimental

The intended "no terminal" path, mirroring the Windows tray and the Linux `.deb`. Not yet verified on a Mac.

1. Get the `cloudling-macos-arm64.dmg` artifact (from a release once published, or build it — see below) and open it.
2. Drag **Cloudling** to **Applications**, then launch it from Launchpad/Applications.
3. It starts the agent server with the built-in web UI in the background and adds a cloud icon to the
   **menu bar** (top-right). The app is a menu-bar agent — it has no Dock icon.
4. Click the menu-bar icon for the menu:
   - **Open Cloudling** — opens the chat UI in your browser (`http://127.0.0.1:4097/`). On first run, point it
     at your model backend and save.
   - **Start at login** — optional autostart (off by default; a per-user
     `~/Library/LaunchAgents/cloudling.plist`).
   - **Uninstall…** — after a confirmation, removes the per-user data (conversations, keys, settings) and the
     autostart entry.
   - **Quit** — stops the background server and exits.

Per-user data (settings + conversations) lives under `~/.claw`. The same `cloudling` binary run from a terminal
stays a normal CLI/REPL. Under the hood the tray is `cloudling tray` and the menu's uninstall is `cloudling uninstall`.

> The `.dmg`/`.app` are **unsigned**, so Gatekeeper will block the first launch: right-click the app →
> **Open** → **Open**, or allow it under **System Settings → Privacy & Security**. Code signing /
> notarization is planned (same status as Windows SmartScreen).

## Build from source

macOS has everything `cloudling` needs (Apple Clang from the Xcode Command Line Tools covers the C dependencies
`ring` and `rusqlite`). Install Rust from <https://rustup.rs/> if you do not have it, then:

```bash
git clone https://github.com/striker9272/claw-lab
cd claw-lab/rust
cargo build --workspace
./target/debug/cloudling --help
./target/debug/cloudling doctor
```

For an optimized binary:

```bash
cd claw-lab/rust
cargo build --release -p cloudling-cli
./target/release/cloudling --help
```

The repository `install.sh` also supports macOS (build-from-source; it offers to install missing build deps
via Homebrew). `install.sh --prebuilt` reports "build from source" on macOS until a prebuilt asset is
published.

```bash
cd claw-lab
./install.sh
```

## Prebuilt binary

Once a release publishes the macOS asset, the headless binary is `cloudling-macos-arm64` (plus
`cloudling-macos-arm64.sha256`):

```bash
asset="cloudling-macos-arm64"
# Download "$asset" and "$asset.sha256" from the release page, then verify:
shasum -a 256 -c "$asset.sha256"
chmod +x "$asset"
sudo mv "$asset" /usr/local/bin/cloudling
cloudling --help
cloudling doctor
```

## Headless server as a launchd service — experimental

To run the OpenAI-compatible server as a background **LaunchAgent** (the macOS counterpart of the Linux
systemd installer), use `rust/scripts/install-openai-service-macos.sh`. It writes a per-user env file
(single source of truth), a wrapper, and `~/Library/LaunchAgents/cloudling.openai.plist`. Not yet verified
on a Mac.

```bash
# built-in web UI mode (configure the engine in the browser):
rust/scripts/install-openai-service-macos.sh \
  --ui \
  --runtime-bin /usr/local/bin/cloudling \
  --load

# or a fixed backend, no UI:
rust/scripts/install-openai-service-macos.sh \
  --base-url http://127.0.0.1:11434/v1 \
  --backend-model llama3.2 \
  --runtime-bin /usr/local/bin/cloudling \
  --load
```

Remove it with `--uninstall`. Pass `--dry-run` to preview every file it would write without touching
anything. The agent's stdout/stderr go to `~/Library/Application Support/cloudling/openai.log`.

## First-run health checks

```bash
cd claw-lab/rust
./target/debug/cloudling --help
./target/debug/cloudling doctor
./target/debug/cloudling status --output-format json
./target/debug/cloudling config --output-format json
```

`doctor`, `status`, `config`, and `version` support `--output-format json`; do not use a separate `--json`
suffix.

## Safe provider switching examples

Provider routing is model-prefix first; when multiple credentials exist, choose an explicit model prefix or
set `OPENAI_BASE_URL` so `cloudling` does not infer the wrong backend. Set keys only in your local environment —
do not paste real keys into shared shell history or docs.

### OpenAI-compatible gateway or OpenRouter

```bash
unset ANTHROPIC_API_KEY
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
export OPENAI_API_KEY="sk-or-v1-REPLACE_ME"

./target/debug/cloudling --model "openai/gpt-4.1-mini" prompt "reply with ready"
```

### Local OpenAI-compatible server

```bash
unset ANTHROPIC_API_KEY
export OPENAI_BASE_URL="http://127.0.0.1:11434/v1"
export OPENAI_API_KEY="local-dev-token"   # or `unset OPENAI_API_KEY` if authless

./target/debug/cloudling --model "llama3.2" prompt "reply with ready"
```

### Anthropic direct

```bash
unset OPENAI_BASE_URL OPENAI_API_KEY
export ANTHROPIC_API_KEY="sk-ant-REPLACE_ME"

./target/debug/cloudling --model "sonnet" prompt "reply with ready"
```

## Troubleshooting checklist

- `cloudling` not found: run it by full path (`./target/debug/cloudling`) or move the prebuilt binary onto your `PATH`
  (e.g. `/usr/local/bin`).
- `cargo` not found: install Rust from <https://rustup.rs/> and reopen the terminal.
- Gatekeeper blocks the app/binary: right-click → **Open**, or allow it under
  **System Settings → Privacy & Security** (the build is unsigned).
- *"The application requires macOS 11.0 or later"*: your Mac is on macOS older than 11.0 (Big Sur) — and
  therefore an Intel Mac. The prebuilt arm64 build does not target that machine; see **Requirements** above.
  This is expected, not a bug.
- Wrong provider selected: add an explicit model prefix (`openai/gpt-4.1-mini`, `qwen-plus`, `grok`) or set
  `OPENAI_BASE_URL` to pin the backend.
- Menu-bar icon missing after "Start at login": the tray detects an already-running instance on
  `127.0.0.1:4097` and just opens the browser instead of starting a second copy — check whether the launchd
  service (above) is already serving that port.
