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

### Installer (recommended): UI-first setup

The service installer wires this up for you. Run `install.sh` (or
`rust/scripts/install-openai-service.sh`) and, at the first prompt, choose the
built-in web UI. In that mode the wizard:

- skips all backend questions — you set the model and URL in the browser later;
- asks only the bind address (use `0.0.0.0:<port>` or a LAN address to reach it
  from another machine; `127.0.0.1` is local-only);
- generates a `CLAW_UI_TOKEN` and sets `CLAW_OPENAI_UI=1`, `CLAW_UI_DATA_DIR`,
  and `CLAW_OPENAI_ENV_FILE`, makes the env file writable by the service user,
  and sets `Restart=always` (needed for save-restart);
- prints the UI address and token at the end.

Open the printed address, enter the token, and the first-run setup screen guides
you to point clab at your engine — saving there restarts the service with your
model. Non-interactively, pass `--ui` (plus `--bind`, and optionally
`--ui-token` / `--ui-data-dir`) to `install-openai-service.sh`, or forward them
through the top-level installer after `--`:
`./install.sh --release -- --ui --bind 0.0.0.0:4097 --enable --restart`.

Re-running the installer with `--ui` on an already-configured service keeps the
engine and the other env values, so you can re-enable or tweak the UI without
re-entering your backend.

## Environment variables

| Variable | Default | What it does |
|---|---|---|
| `CLAW_UI_TOKEN` | *(unset)* | Bearer token guarding the `/ui/*` data endpoints. When set, every `/ui/*` request must send `Authorization: Bearer <token>`; the browser prompts for it once and remembers it. When unset, `/ui/*` are open on a loopback bind only and disabled (403) on any other bind — see [Auth model](#auth-model). |
| `CLAW_UI_DATA_DIR` | `CLAW_CONFIG_HOME/ui`, else `$HOME/.claw/ui` | Directory for the SQLite store that holds dialogs, presets, and UI preferences. Created on first use. |
| `CLAW_OPENAI_ENV_FILE` | *(unset)* | Path to the service env file. Lets the UI's **General** settings save engine/model/key changes and self-restart the core. When unset, the settings form loads as read-only (`_can_save: false`) and the save button is disabled. |
| `CLAB_UI_DIR` | *(unset)* | Dev override: serve `index.html` / `app.css` / `app.js` from this directory at runtime instead of the embedded copies, so UI edits don't need a rebuild. Leave unset in production to serve the embedded assets. |
| `CLAW_OPENAI_UI` | *(unset)* | Set to `1` by the installer's UI mode. The generated service wrapper turns it into the `--ui` flag and relaxes the backend requirement so the service can start unconfigured. Read by the wrapper, not by `clab` itself. |

The UI also reads and writes the access/permission config in `settings.json`
(`filesystemMode`, `workspaceFolder`, `trustedRoots`, `permissions`, `mcpServers`;
via `/ui/config`) and the agent backend settings (`OPENAI_BASE_URL`,
`OPENAI_MODEL`, `CLAW_PERMISSION_MODE`, `CLAWD_WEB_SEARCH_BASE_URL`, …) through
the env file above. Backend timeout/retry tuning is via the `CLAW_BACKEND_*`
variables documented in [`../USAGE.md`](../USAGE.md).

## Auth model

The chat API (`/v1/*`) and the static page are never gated — the page itself is
where the user enters the token. Only the `/ui/*` data endpoints are protected,
because they can read the API key, rewrite the env file, browse the host
filesystem, and change the access/permission config. The decision is:

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
directory resets the UI to a clean slate without affecting the agent;
`uninstall.sh` removes it as well unless you pass `--keep-data`.

## Settings panels

The right-hand drawer groups settings into:

- **General** — engine URL, API key, backend model, served model id, web-search
  URL. Saving applies live and persists to the env file (`CLAW_OPENAI_ENV_FILE`).
- **System prompt** — manage presets.
- **Chat** — toggle whether the model's reasoning block is shown.
- **Tools** — configure MCP servers (`mcpServers` in `settings.json`); applied on
  the next message, no restart. See [MCP servers](#mcp-servers) below.
- **Security** — a single **Access level** preset that the UI maps onto the
  underlying axes (applied on the next message, no restart):
  - *Read-only* — read and search files anywhere on the machine; no writes or
    shell commands (`CLAW_PERMISSION_MODE=read-only`, `filesystemMode=off`).
  - *Working folder* — read, write, and run commands confined to a working folder
    you pick (`danger-full-access` + `filesystemMode=allow-list` with the folder
    in the allowed roots). A **Browse** button opens a server-side folder picker
    (lists directories and drives/mounts on the host).
  - *Full access* — unrestricted (`danger-full-access`, `filesystemMode=off`).

  The working folder is the `workspaceFolder` key in `settings.json`. The bash
  namespace sandbox is no longer exposed here (confinement is the working folder);
  trusted extra roots and allow/deny permission rules live under **Advanced**.

## MCP servers

An MCP server is an external program that gives the model extra tools. Claw Lab
launches the configured servers over the **stdio** transport, discovers their
tools, and exposes them to the model as `mcp__<server>__<tool>`. Configuration is
a runtime concern, not an install-time one — set it per deployment in the UI or
in `settings.json`, never in the install wizard.

### Add a server

In the UI, open **Settings → Tools → MCP servers** and add one with its launch
command and arguments. Under the hood this writes the `mcpServers` map in
`settings.json` under `CLAW_CONFIG_HOME`; for a headless instance (no UI) edit
that file directly:

```json
{
  "mcpServers": {
    "fs": {
      "command": "/path/to/mcp-server-filesystem",
      "args": ["/path/to/exposed/dir"],
      "env": { "EXAMPLE": "1" }
    }
  }
}
```

The config is read on every message, so adding, changing, or removing a server
applies on the next send — no restart.

### Wire framing

The MCP specification frames stdio messages as newline-delimited JSON, which is
the default. A server written against clab's older transport (LSP-style
`Content-Length` headers) can be selected with `"framing": "content-length"` on
its entry. Reads auto-detect both formats; the setting only controls what the
client writes.

### Server lifetime (pooling)

Launching a server and discovering its tools costs about a second, and the agent
rebuilds its runtime several times per message, so Claw Lab keeps a single live
set of servers warm and reuses it across messages instead of respawning each
time. The pool is rebuilt only when the `mcpServers` config changes or a pooled
server is found dead; removing the last server stops the pooled processes.

Prefer a **direct command** (the server's own executable) over a launcher like
`npx`. A launcher is a wrapper process that spawns the real server as a child;
when the pool stops a server it signals the wrapper, which can leave the real
process orphaned on a config change. A direct command is a single process that
stops cleanly.

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
