# Built-in web UI (`--ui`)

Claw Lab is headless by default: it serves an OpenAI-compatible API and nothing
else. The `clab` binary can *also* serve a small chat page on the same port, so
you can talk to the agent from a browser without running a separate frontend.
This is opt-in — the API surface is byte-for-byte unchanged unless you ask for
the UI.

## Enabling it

Add the `--ui` flag to the `openai-serve` command:

```bash
clab --permission-mode read-only openai-serve --bind 127.0.0.1:4097 --ui
```

With `--ui` the server adds:

- `GET /`, `GET /app.css`, `GET /app.js` — the single-page chat UI (three files
  embedded into the binary at build time, so the shipped binary is
  self-contained).
- `GET/PUT/DELETE /ui/*` — data endpoints for server-side persistence (dialogs,
  presets, settings, small key/value preferences).

Without `--ui` none of these routes exist; only `/health`, `/v1/models`, and
`/v1/chat/completions` are served.

> The service installer (`install-openai-service.sh`) does not yet expose a
> `--ui` toggle. For now enable the UI manually — pass `--ui` in the service
> wrapper / launch command and set the environment variables below.

## Environment variables

| Variable | Default | What it does |
|---|---|---|
| `CLAW_UI_TOKEN` | *(unset)* | Bearer token guarding the `/ui/*` data endpoints. When set, every `/ui/*` request must send `Authorization: Bearer <token>`; the browser prompts for it once and remembers it. When unset, `/ui/*` are open on a loopback bind only and disabled (403) on any other bind — see [Auth model](#auth-model). |
| `CLAW_UI_DATA_DIR` | `CLAW_CONFIG_HOME/ui`, else `$HOME/.claw/ui` | Directory for the SQLite store that holds dialogs, presets, and UI preferences. Created on first use. |
| `CLAW_OPENAI_ENV_FILE` | *(unset)* | Path to the service env file. Lets the UI's **General** settings save engine/model/key changes and self-restart the core. When unset, the settings form loads as read-only (`_can_save: false`) and the save button is disabled. |
| `CLAB_UI_DIR` | *(unset)* | Dev override: serve `index.html` / `app.css` / `app.js` from this directory at runtime instead of the embedded copies, so UI edits don't need a rebuild. Leave unset in production to serve the embedded assets. |

The UI also reads and writes the sandbox/permission config in `settings.json`
(via `/ui/config`) and the agent backend settings (`OPENAI_BASE_URL`,
`OPENAI_MODEL`, `CLAW_PERMISSION_MODE`, `CLAWD_WEB_SEARCH_BASE_URL`, …) through
the env file above. Backend timeout/retry tuning is via the `CLAW_BACKEND_*`
variables documented in [`../USAGE.md`](../USAGE.md).

## Auth model

The chat API (`/v1/*`) and the static page are never gated — the page itself is
where the user enters the token. Only the `/ui/*` data endpoints are protected,
because they can read the API key, rewrite the env file, and change the sandbox
config. The decision is:

- **Token configured** (`CLAW_UI_TOKEN` set) → `/ui/*` require a matching
  `Authorization: Bearer <token>`; a wrong/missing token returns 401.
- **No token, loopback bind** (e.g. `127.0.0.1`) → `/ui/*` are open (dev
  convenience: only local processes can reach the port).
- **No token, non-loopback bind** (LAN, Docker bridge, `0.0.0.0`) → `/ui/*` are
  disabled with 403 (fail closed). Set `CLAW_UI_TOKEN` to use them there.

So if you bind beyond loopback (the usual case for a home-lab service reachable
from another machine), set `CLAW_UI_TOKEN` to any string you choose and enter it
in the browser prompt.

## Persistence

The chat endpoint stays **stateless** — the browser owns the conversation and
resends the full history on every turn, exactly like any other OpenAI client.
The UI adds a separate, optional persistence layer so you can list and reopen
past dialogs:

- **Dialogs** — transcripts, listed newest-first, reopenable, searchable,
  pinnable, deletable.
- **Presets** — named system prompts; the active one is prepended as a `system`
  message on send.
- **Preferences** — small key/value state (active preset, token counters, error
  flags, reasoning visibility).

All of this lives in `dialogs.sqlite` under `CLAW_UI_DATA_DIR`. Deleting that
directory resets the UI to a clean slate without affecting the agent.

## Settings panels

The right-hand drawer groups settings into:

- **General** — engine URL, API key, backend model, served model id, permission
  mode, web-search URL. Saving rewrites the env file (`CLAW_OPENAI_ENV_FILE`) and
  restarts the core; needs `Restart=always` on the systemd unit so the process
  comes back up.
- **System prompt** — manage presets.
- **Chat** — toggle whether the model's reasoning block is shown.
- **Tools** — configure MCP servers (`mcpServers` in `settings.json`); applied on
  the next message, no restart.
- **Security** — sandbox on/off, filesystem mode, network isolation, namespace
  restrictions, trusted roots, and allow/deny permission rules. Applied on the
  next message, no restart.

## Attachments

The composer accepts file attachments. Images are sent to the backend as an
OpenAI vision `image_url` part; text files are inlined as text; other files are
noted as a chip without their contents. If the backend has no vision support, it
returns an "image input is not supported" error — the server strips the images,
replaces them with a short text note, and retries once, so the conversation is
not blocked. The image stays in the UI history, so switching to a vision-capable
backend lets it through again.

## First-run / onboarding

A fresh instance whose engine is not yet configured (empty `OPENAI_BASE_URL`)
opens the guided setup screen instead of a dead-end home view. After a successful
"check connection" it switches to the chat home. Appending `?firstrun` to the URL
forces the setup screen regardless.

## Relationship to the headless service

The UI is an additive mode, not a replacement. The headless service (no `--ui`)
behaves exactly as before; turning on `--ui` only adds the page and the `/ui/*`
endpoints. The design and internals are intentionally minimal so the shipped
binary stays a single self-contained file.
