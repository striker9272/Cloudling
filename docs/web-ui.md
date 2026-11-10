# Built-in web UI (`--ui`)

Cloudling is headless by default: it serves an OpenAI-compatible API and nothing
else. The `cloudling` binary can *also* serve a small chat page on the same port, so
you can talk to the agent from a browser without running a separate frontend.
This is opt-in — the API surface is byte-for-byte unchanged unless you ask for
the UI.

## Enabling it

Add the `--ui` flag to the `openai-serve` command:

```bash
cloudling --permission-mode read-only openai-serve --bind 127.0.0.1:4097 --ui
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
- generates a `CLOUDLING_UI_TOKEN` and sets `CLOUDLING_OPENAI_UI=1`, `CLOUDLING_UI_DATA_DIR`,
  and `CLOUDLING_OPENAI_ENV_FILE`, makes the env file writable by the service user,
  and sets `Restart=always` (needed for save-restart);
- prints the UI address and token at the end.

Open the printed address, enter the token, and the first-run setup screen guides
you to point cloudling at your engine — saving there restarts the service with your
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
| `CLOUDLING_UI_TOKEN` | *(unset)* | Bearer token guarding the `/ui/*` data endpoints. When set, every `/ui/*` request must send `Authorization: Bearer <token>`; the browser prompts for it once and remembers it. When unset, `/ui/*` are open on a loopback bind only and disabled (403) on any other bind — see [Auth model](#auth-model). |
| `CLOUDLING_UI_DATA_DIR` | `CLAW_CONFIG_HOME/ui`, else `$HOME/.claw/ui` | Directory for the SQLite store that holds dialogs, presets, and UI preferences. Created on first use. |
| `CLOUDLING_OPENAI_ENV_FILE` | *(unset)* | Path to the service env file. Lets the UI's **General** settings save engine/model/key changes and self-restart the core. When unset, the settings form loads as read-only (`_can_save: false`) and the save button is disabled. |
| `CLOUDLING_UI_DIR` | *(unset)* | Dev override: serve `index.html` / `app.css` / `app.js` from this directory at runtime instead of the embedded copies, so UI edits don't need a rebuild. Leave unset in production to serve the embedded assets. |
| `CLOUDLING_OPENAI_UI` | *(unset)* | Set to `1` by the installer's UI mode. The generated service wrapper turns it into the `--ui` flag and relaxes the backend requirement so the service can start unconfigured. Read by the wrapper, not by `cloudling` itself. |

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

- **Token configured** (`CLOUDLING_UI_TOKEN` set) → `/ui/*` require a matching
  `Authorization: Bearer <token>`; a wrong/missing token returns 401.
- **No token, loopback bind** (e.g. `127.0.0.1`) → `/ui/*` are open (dev
  convenience: only local processes can reach the port).
- **No token, non-loopback bind** (LAN, Docker bridge, `0.0.0.0`) → `/ui/*` are
  disabled with 403 (fail closed). Set `CLOUDLING_UI_TOKEN` to use them there.

So if you bind beyond loopback (the usual case for a home-lab service reachable
from another machine), set `CLOUDLING_UI_TOKEN` to any string you choose and enter it
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

All of this lives in `dialogs.sqlite` under `CLOUDLING_UI_DATA_DIR`. Deleting that
directory resets the UI to a clean slate without affecting the agent;
`uninstall.sh` removes it as well unless you pass `--keep-data`.

## Settings panels

The right-hand drawer groups settings into:

- **General** — engine URL, API key, backend model, served model id, web-search
  URL. Saving applies live and persists to the env file (`CLOUDLING_OPENAI_ENV_FILE`).
- **System prompt** — manage presets.
- **Chat** — toggle whether the model's reasoning block is shown.
- **Voice** — the text-to-speech server behind the **Speak** button (see
  [Voice output](#voice-output)) and the speech-to-text server behind the microphone (see
  [Voice input](#voice-input)); saved to the env file, applied live.
- **Tools** — configure MCP servers (`mcpServers` in `settings.json`); applied on
  the next message, no restart. See [MCP servers](#mcp-servers) below.
- **Security** — a single **Access level** preset that the UI maps onto the
  underlying axes (applied on the next message, no restart):
  - *Read-only* — read and search files anywhere on the machine; no writes or
    shell commands (`CLAW_PERMISSION_MODE=read-only`, `filesystemMode=off`).
  - *Working folder* — the built-in file tools (read/write/edit/search) are
    confined to a working folder you pick (`danger-full-access` + `filesystemMode=allow-list`
    with the folder in the allowed roots). A **Browse** button opens a server-side folder
    picker (lists directories and drives/mounts on the host). **Caveat:** shell commands
    (`bash`) run as your OS user and are **not** OS-confined to the folder — a command can
    still read/write outside it. Treat the folder as a guardrail for the file tools, not an
    OS sandbox for the shell. Real command isolation needs Linux namespaces (see the sandbox
    section) or a container.
  - *Full access* — unrestricted (`danger-full-access`, `filesystemMode=off`).

  The working folder is the `workspaceFolder` key in `settings.json`. The bash
  namespace sandbox is no longer exposed here (confinement is the working folder);
  trusted extra roots and allow/deny permission rules live under **Advanced**.

## MCP servers

An MCP server is an external program that gives the model extra tools. Cloudling
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
the default. A server written against cloudling's older transport (LSP-style
`Content-Length` headers) can be selected with `"framing": "content-length"` on
its entry. Reads auto-detect both formats; the setting only controls what the
client writes.

### Server lifetime (pooling)

Launching a server and discovering its tools costs about a second, and the agent
rebuilds its runtime several times per message, so Cloudling keeps a single live
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

## Voice output

With a text-to-speech server configured, every answer gets a **Speak** button next to
**Copy**. The server reads the saved message aloud: reasoning, tool-call and question
blocks and code are skipped, markdown is stripped, and text the agent wrote between tool
calls is kept. The message is cut into sentence groups (a short first piece so the voice
starts early, then up to ~400 characters, never splitting a sentence or a paragraph), sent
one after another to the TTS server, and the audio is streamed to the browser as raw 16-bit
mono PCM (`POST /ui/speak`, `audio/L16; rate=…`) as soon as it arrives. Another **Speak**, a
new question or switching the dialog stops playback; the open TTS request is closed too.

Any OpenAI-compatible TTS server works — only `POST {base}/audio/speech` is required:

| Variable | What it does |
|---|---|
| `CLOUDLING_TTS_BASE_URL` | TTS base URL including `/v1`, e.g. `http://host:8020/v1`. Empty — voice output is off and the button is hidden. |
| `CLOUDLING_TTS_API_KEY` | Bearer key, if the server needs one. |
| `CLOUDLING_TTS_MODEL` | `model` field (required by OpenAI itself, e.g. `gpt-4o-mini-tts`); omitted when empty. |
| `CLOUDLING_TTS_VOICE` | `voice` field; omitted when empty (server default). |
| `CLOUDLING_TTS_EXTRA` | Extra request fields for options a particular server understands, as `key=value` pairs separated by commas, e.g. `stream=true, sample_rate=48000` (`true`/`false` and numbers are typed). Not JSON on purpose: systemd strips double quotes from `EnvironmentFile` values. If the server answers 400/422, the request is repeated without these fields. |

Cloudling asks for `pcm` (OpenAI's contract: 24 kHz unless the response states its rate in
`Content-Type`) and falls back to `wav` if the server rejects `pcm`. A server that streams its
audio is relayed chunk by chunk; one that returns a whole file per request still works — each
sentence group then arrives whole.

## Voice input

With a speech-to-text server configured, the message field gets a **microphone** button next
to **Send**. Press it, speak, press **Done**: the browser records the utterance, the server
passes the recording to the STT backend (`POST /ui/transcribe` → `{"text": "…"}`) and the
recognised text lands in the message field, after anything already typed, for you to check
and send. While recording, a timer and a level meter stand in for the text field;
**Cancel** (or `Esc`) drops the recording. A recording is capped at 5 minutes.

Any OpenAI-compatible STT server works — only `POST {base}/audio/transcriptions` is required.
The recording is uploaded in the container the browser produced (WebM/Opus in Chromium and
Firefox, MP4/AAC in Safari); Cloudling does not decode or convert it.

| Variable | What it does |
|---|---|
| `CLOUDLING_STT_BASE_URL` | STT base URL including `/v1`, e.g. `http://host:9876/v1`. Empty — voice input is off and the microphone is hidden. |
| `CLOUDLING_STT_API_KEY` | Bearer key, if the server needs one. |
| `CLOUDLING_STT_MODEL` | `model` field (required by OpenAI itself, e.g. `whisper-1`); omitted when empty. |
| `CLOUDLING_STT_EXTRA` | Extra form fields, as `key=value` pairs separated by commas, e.g. `language=ru`. If the server answers 400/422, the request is repeated without these fields. |

**The microphone needs a secure context.** Browsers hand it out only on `https://` pages and
on `localhost`. The desktop/tray app (which opens `localhost`) is not affected. A server
install opened from another device over plain `http://` is: the button stays visible but
explains the reason instead of recording. Put the UI behind an HTTPS reverse proxy to use it;
if the proxy buffers responses, turn that off for this site so streamed answers and speech
stay live (in Caddy: `flush_interval -1` inside `reverse_proxy`).

## Voice dialog

With both speech servers configured (and a secure context, see above), the round button of an
empty message field is the Cloudling cloud: it starts a spoken conversation. The microphone
stays open and the loop runs by itself — you speak, a pause of about a second (or the middle
button) ends the utterance, it is recognised and sent as an ordinary message, and the answer is
spoken **while it is being written**; then it listens again. The middle button interrupts an
answer, and so does your voice (talk over it — what you are saying becomes the next
utterance). **End** leaves the dialog; an answer still being written finishes as text. What
was said and answered are ordinary messages of the chat.

The dialog opens on a screen of its own: the cloud in the middle (it moves with your voice
while listening and with the answer's voice while speaking), the current state, the last thing
you said, and — while an answer calls tools — the list of what the agent has done. **Show chat**
folds the screen into a small card over the ordinary chat, where you can read along and also
type (a typed message is answered aloud too); the card's arrows button unfolds it again.

- The end of an utterance is found from the loudness of the microphone alone, so any STT
  server works; one utterance goes through the same `POST /ui/transcribe` as dictation.
- The answer is spoken through `POST /ui/speak/live {id}` (the audio stream, as for **Speak**)
  fed by `POST /ui/speak/push {id, text, done}` — the answer text so far, the whole text every
  time. The server cleans it up, cuts it into sentences and starts speaking with the first one.
- Each spoken message carries a short note asking the model for a conversational answer (brief,
  no lists or markup, plain text rather than a tool to deliver it). The note is added to the outgoing copy only, not to the stored chat.
- The chat title is generated after the dialog ends, not after the first exchange: the title
  is a separate model request, and on a backend with a single prompt-cache slot it would make
  the next answer start several seconds later.

Three switches in **Settings → Voice** (stored with the UI data, all on by default):
**Model reasoning in a dialog** — off sends the standard `reasoning_effort: "none"` with the
dialog's requests (the model server must understand it; answers start sooner but are simpler —
though a backend that caches one prompt re-reads the whole prompt once when a chat switches
between reasoning on and off, i.e. on the first spoken message and the first typed one after);
**Interrupt by voice** — off leaves only the button (useful with loudspeakers, where the model
may hear itself); **Text while you speak** — the words appear on the dialog screen as you say
them: the unfinished recording is sent to the same `POST /ui/transcribe` again and again (a
recording cut short is still a valid one, so no streaming protocol is needed and any STT
server will do; it costs that server more work, so switch it off on a weak one).
`POST /v1/chat/completions` passes a client's `reasoning_effort` on to the
backend for any client, not only the built-in UI.

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
