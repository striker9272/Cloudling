# Production image for the Claw Lab `clab` server (built-in UI + OpenAI-compatible serve).
#
# Multi-stage (Path A): the binary is built from source in a Rust toolchain layer,
# then only the binary ships on a slim runtime layer. The web UI assets are embedded
# in the binary at compile time (include_str!), so no static files are copied.
#
# glibc note: builder and runtime share the same Debian release (bookworm), so the
# binary's glibc requirement matches the runtime. A binary built on a newer glibc
# (e.g. Ubuntu 24.04 / glibc 2.39) would NOT run on an older base.
#
# Build context is the repository root (the Rust workspace lives under rust/):
#   docker build -f docker/Dockerfile -t claw-lab:dev .

# --- Stage 1: builder ---
FROM rust:bookworm AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        git \
        libssl-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
# .dockerignore trims target/, .git, notes/, etc. from the context.
COPY rust ./rust
WORKDIR /build/rust
RUN cargo build --release -p clab-cli

# --- Stage 2: runtime ---
FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        git \
        libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/rust/target/release/clab /usr/local/bin/clab
COPY docker/entrypoint.sh /usr/local/bin/clab-entrypoint
RUN chmod +x /usr/local/bin/clab-entrypoint \
    && mkdir -p /workspace /data/ui

# Portable defaults — all overridable via env / compose. No secrets, no LAN addresses.
# CLAW_UI_TOKEN is intentionally NOT baked in: the operator supplies it at run time.
ENV CLAW_OPENAI_UI=1 \
    CLAW_OPENAI_BIND=0.0.0.0:4097 \
    CLAW_PERMISSION_MODE=read-only \
    CLAW_WORKING_DIRECTORY=/workspace \
    CLAW_UI_DATA_DIR=/data/ui

EXPOSE 4097
ENTRYPOINT ["/usr/local/bin/clab-entrypoint"]
