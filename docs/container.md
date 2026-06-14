# Container-first claw-code workflows

This repo already had **container detection** in the Rust runtime before this document was added:

- `rust/crates/runtime/src/sandbox.rs` detects Docker/Podman/container markers such as `/.dockerenv`, `/run/.containerenv`, matching env vars, and `/proc/1/cgroup` hints.
- `rust/crates/rusty-claude-cli/src/main.rs` exposes that state through the `clab sandbox` / `cargo run -p rusty-claude-cli -- sandbox` report.
- `.github/workflows/rust-ci.yml` runs on `ubuntu-latest`, but it does **not** define a Docker or Podman container job.
- Before this change, the repo did **not** have a checked-in `Dockerfile`, `Containerfile`, or `.devcontainer/` config.

The repo ships **two** container setups for two different jobs:

- **Production server image** — [`../docker/Dockerfile`](../docker/Dockerfile): a ready-to-run image of the
  `clab` server (built-in web UI + OpenAI-compatible endpoint). Use this to *run* Claw Lab in a container.
- **Dev build/test shell** — [`../Containerfile`](../Containerfile): a reusable Rust toolchain shell you
  bind-mount your checkout into to build and test. Use this to *develop*. Covered further below.

## Production server image (`docker/`)

`docker/Dockerfile` is a multi-stage build: a Rust toolchain layer compiles `clab` from source, then only
the binary ships on a slim `debian:bookworm-slim` runtime. The web UI assets are embedded in the binary at
compile time, so no static files are copied. Builder and runtime share the same Debian release so the
binary's glibc requirement always matches the runtime.

### Run it

The quickest path is the bundled compose file, which exposes the container on host port **4098** by default
(so it never collides with a host service on 4097):

```bash
# Required: a token guarding the /ui/* endpoints on a non-loopback bind.
export CLAW_UI_TOKEN="$(openssl rand -hex 16)"
# Optional: point at a backend now, or leave unset and configure the engine in the browser.
export OPENAI_BASE_URL="http://your-backend:8080/v1" OPENAI_MODEL="your-model"
export CLAW_PERMISSION_MODE="danger-full-access"   # default in the image is read-only

docker compose -f docker/compose.yaml up --build -d
# open http://<host>:4098/ and enter CLAW_UI_TOKEN when prompted
```

Plain `docker build` + `docker run` works too:

```bash
docker build -f docker/Dockerfile -t claw-lab:dev .
docker run -d -p 4098:4097 \
  -e CLAW_UI_TOKEN="$(openssl rand -hex 16)" \
  -e OPENAI_BASE_URL="http://your-backend:8080/v1" -e OPENAI_MODEL="your-model" \
  -e CLAW_PERMISSION_MODE="danger-full-access" \
  -v clab-ui-data:/data/ui -v clab-workspace:/workspace \
  claw-lab:dev
```

### Configuration (env)

All knobs are env with portable defaults baked into the image; override via compose or `-e`. No secrets or
addresses are hardcoded.

| Variable | Default (image) | Purpose |
| --- | --- | --- |
| `CLAW_OPENAI_BIND` | `0.0.0.0:4097` | Bind address inside the container (mapped to a host port). |
| `CLAW_UI_TOKEN` | *(unset)* | Bearer token for `/ui/*`. **Required** for a non-loopback bind, else `/ui/*` return 403. |
| `CLAW_PERMISSION_MODE` | `read-only` | Tool permission mode (`read-only` / `workspace-write` / `danger-full-access`). |
| `CLAW_WORKING_DIRECTORY` | `/workspace` | Agent working directory (mount a volume to persist). |
| `CLAW_UI_DATA_DIR` | `/data/ui` | SQLite store for dialogs/presets/settings (mount a volume to persist). |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` / `OPENAI_API_KEY` | *(unset)* | Backend engine. Leave unset to configure it in the browser on first run. |
| `CLAWD_WEB_SEARCH_BASE_URL` | *(unset)* | SearXNG-style web search endpoint, reachable from inside the container. |

### Sandbox: namespace off by design

The image bakes `sandbox.namespaceRestrictions = false` (via a settings file at `CLAW_CONFIG_HOME=/etc/clab`).
Inside a container the container itself is the isolation boundary, and unprivileged `unshare` user namespaces
are typically blocked anyway (Docker seccomp; on hosts like Ubuntu 24.04 also AppArmor). Turning namespace
isolation off makes `clab sandbox` report an honest **Active** state with filesystem `workspace-only`
isolation still on, instead of a noisy fallback warning. The agent's tools run directly inside the container.

### Published image (GHCR)

On a `v*` git tag (and on pushes to `main`), the **Container image** workflow
([`../.github/workflows/container.yml`](../.github/workflows/container.yml)) builds this `Dockerfile` and
publishes it to the GitHub Container Registry at `ghcr.io/<owner>/<repo>`:

- tag `vX.Y.Z` → `X.Y.Z`, `X.Y`, and `latest`
- push to `main` → `edge`

Once an image is published you can run it instead of building locally:

```bash
docker run -d -p 4098:4097 \
  -e CLAW_UI_TOKEN="$(openssl rand -hex 16)" \
  -e OPENAI_BASE_URL="http://your-backend:8080/v1" -e OPENAI_MODEL="your-model" \
  ghcr.io/<owner>/<repo>:latest
```

Package visibility (private vs public) is controlled in the repository's package settings; a private package
requires `docker login ghcr.io` with a token that has `read:packages`.

## What the checked-in dev shell image is for

The root [`../Containerfile`](../Containerfile) gives you a reusable Rust build/test shell with the extra packages this workspace commonly needs (`git`, `pkg-config`, `libssl-dev`, certificates).

It does **not** copy the repository into the image. Instead, the recommended flow is to bind-mount your checkout into `/workspace` so edits stay on the host.

## Build the image

From the repository root:

### Docker

```bash
docker build -t claw-code-dev -f Containerfile .
```

### Podman

```bash
podman build -t claw-code-dev -f Containerfile .
```

## Run `cargo test --workspace` in the container

These commands mount the repo, keep Cargo build artifacts out of the working tree, and run from the Rust workspace at `rust/`.

### Docker

```bash
docker run --rm -it \
  -v "$PWD":/workspace \
  -e CARGO_TARGET_DIR=/tmp/claw-target \
  -w /workspace/rust \
  claw-code-dev \
  cargo test --workspace
```

### Podman

```bash
podman run --rm -it \
  -v "$PWD":/workspace:Z \
  -e CARGO_TARGET_DIR=/tmp/claw-target \
  -w /workspace/rust \
  claw-code-dev \
  cargo test --workspace
```

If you want a fully clean rebuild, add `cargo clean &&` before `cargo test --workspace`.

## Open a shell in the container

### Docker

```bash
docker run --rm -it \
  -v "$PWD":/workspace \
  -e CARGO_TARGET_DIR=/tmp/claw-target \
  -w /workspace/rust \
  claw-code-dev
```

### Podman

```bash
podman run --rm -it \
  -v "$PWD":/workspace:Z \
  -e CARGO_TARGET_DIR=/tmp/claw-target \
  -w /workspace/rust \
  claw-code-dev
```

Inside the shell:

```bash
cargo build --workspace
cargo test --workspace
cargo run -p rusty-claude-cli -- --help
cargo run -p rusty-claude-cli -- sandbox
```

The `sandbox` command is a useful sanity check: inside Docker or Podman it should report `In container true` and list the markers the runtime detected.

## Bind-mount this repo and another repo at the same time

If you want to run `clab` against a second checkout while keeping `claw-code` itself mounted read-write:

### Docker

```bash
docker run --rm -it \
  -v "$PWD":/workspace \
  -v "$HOME/src/other-repo":/repo \
  -e CARGO_TARGET_DIR=/tmp/claw-target \
  -w /workspace/rust \
  claw-code-dev
```

### Podman

```bash
podman run --rm -it \
  -v "$PWD":/workspace:Z \
  -v "$HOME/src/other-repo":/repo:Z \
  -e CARGO_TARGET_DIR=/tmp/claw-target \
  -w /workspace/rust \
  claw-code-dev
```

Then, for example:

```bash
cargo run -p rusty-claude-cli -- prompt "summarize /repo"
```

## Notes

- Docker and Podman use the same checked-in `Containerfile`.
- The `:Z` suffix in the Podman examples is for SELinux relabeling; keep it on Fedora/RHEL-class hosts.
- Running with `CARGO_TARGET_DIR=/tmp/claw-target` avoids leaving container-owned `target/` artifacts in your bind-mounted checkout.
- For non-container local development, keep using [`../USAGE.md`](../USAGE.md) and [`../rust/README.md`](../rust/README.md).
