# Claw Lab

<p align="center">
  <a href="https://github.com/striker9272/claw-lab">striker9272/claw-lab</a>
  ·
  <a href="https://github.com/ultraworkers/claw-code">Claw Code (original)</a>
  ·
  <a href="./USAGE.md">Usage</a>
  ·
  <a href="./rust/README.md">Rust workspace</a>
  ·
  <a href="./SECURITY.md">Security</a>
</p>

<p align="center"><b>Русский</b> · <a href="#english">English</a></p>

---

## Русский

**Claw Lab — агентная прослойка между твоей моделью и твоим чатом.** Подключаешь бэкенд (любой OpenAI-совместимый: Ollama, llama.cpp, vLLM, облако), указываешь куда отдавать — и в твоём чате появляется та же модель, но «с руками»: с инструментами, веб-поиском и нормальным агентным воркфлоу.

```text
  твоя модель            Claw Lab                       твой чат
  Ollama · llama.cpp ─▶  инструменты · веб-поиск    ─▶  Open WebUI ·
  vLLM · облако          агентный воркфлоу               любой OpenAI-клиент
                         (наружу — как OpenAI API)
```

### Зачем это

Локальная модель в Open WebUI умеет, по сути, только разговаривать. Claw Lab встаёт посередине и даёт ей руки — инструменты, поиск, многошаговый агентный цикл — **не меняя ни твой бэкенд, ни твой интерфейс**. Снаружи во фронте это выглядит как обычная модель в списке: выбрал — и общаешься, только она теперь умеет действовать, а не просто отвечать.

От оригинального [Claw Code](#благодарности) (это агент для кодинга в терминале) Claw Lab отличается фокусом: здесь главное — не CLI, а вот эта прослойка «модель → агент → чат» для самостоятельного хостинга на домашнем сервере.

### Как это работает

По задумке нужно всего две вещи:

1. **Куда ходить за моделью** — адрес и ключ твоего OpenAI-совместимого бэкенда (локального или внешнего).
2. **Куда отдавать результат** — на каком адресе поднять OpenAI-совместимый эндпоинт, который увидит твой чат.

На выходе Claw Lab поднимает `/v1/chat/completions` со стримингом, который Open WebUI (или другой клиент) видит как одну модель. Всё остальное — инструменты, поиск, сессии — уже внутри.

> **Статус:** проект экспериментальный, для домашнего сервера. **Проверенная платформа — Linux**; macOS и Windows/WSL — на будущее, «как есть» и без гарантий (бинарники под них собираются в CI, но регулярно не тестируются). Сервис ставится одной командой (бэкенд + вывод) или интерактивным мастером — см. раздел «Запуск как сервиса» ниже.

### Что внутри

- **Инструменты и агентный цикл** — модель не просто отвечает, а выполняет многошаговые задачи через встроенные инструменты.
- **Встроенный веб-поиск** — разбирает JSON-результаты со сниппетами, с откатом на DuckDuckGo/HTML.
- **Аккуратные tool-call'ы в Open WebUI** — вызовы инструментов показываются как сворачиваемые детали, а не как сырой текст в ответе.
- **Сессии под чат** — эфемерные: историю держит фронт и присылает её целиком в каждом запросе (`messages[]`), а clab пересобирает сессию на каждый запрос. Истории не утекают между чатами.
- **Стабильное имя модели** — фронт видит постоянный id (например `clab-agent`), а реальная модель провайдера остаётся внутренней и заменяемой.
- **Изоляция** — живой сервис работает в нейтральной директории и не тянет в обычные чаты `CLAUDE.md`, git-статус и настройки проекта.

### Быстрый старт

Репозиторий — только build-from-source. Установщик `install.sh` сам определит ОС, проверит Rust-тулчейн и системные зависимости (компилятор, OpenSSL, pkg-config), а если каких-то системных пакетов не хватает — покажет команду и предложит доустановить (`y/n`):

```bash
git clone https://github.com/striker9272/claw-lab
cd claw-lab
./install.sh --release
```

Бинарник появится в `rust/target/release/clab` (`.exe` на Windows); установщик сам проверит `clab --version`. Дальше настрой сервис — раздел «Запуск как сервиса» ниже (бэкенд и ключ задаются там, в одном месте). CLI-команды (`clab doctor`, `clab prompt`), провайдеры, сессии и заметки по Windows/PowerShell — в [`USAGE.md`](./USAGE.md) и [`docs/`](./docs).

> Ручная сборка (`cd rust && cargo build --release -p clab-cli`) тоже работает, но **не проверяет зависимости** — используй её, только если окружение уже настроено.

> Не хочешь ставить Rust? Скачай готовый бинарник из релиза: `./install.sh --prebuilt` (нужен `gh` или `curl`; для приватного репо — авторизованный `gh`). Конкретную версию — `--prebuilt-tag vX.Y.Z`.

### Запуск как сервиса

Основной сценарий. Если ты ставил через `./install.sh --release`, он в конце сам предложит поднять сервис — ответь `y`, и установщик разложит бинарник и запустит мастер (путь «одной командой от нуля до сервиса»).

**Что нужно заранее:**

- запущенный OpenAI-совместимый бэкенд с моделью (Ollama / llama.cpp / vLLM / облако), доступный по сети;
- Open WebUI (или любой OpenAI-клиент), который будет ходить в clab.

Мастер можно запустить и отдельно (бинарник кладёт `install.sh`; при ручной сборке сначала положи его: `sudo install -D -m 755 rust/target/release/clab /opt/clab/bin/clab`):

```bash
cd rust
bash scripts/clab-setup.sh
```

Либо одной командой, без вопросов:

```bash
cd rust
scripts/install-openai-service.sh \
  --base-url http://127.0.0.1:8000/v1 \
  --backend-model <модель-бэкенда> \
  --served-model-id clab-agent \
  --enable --restart
```

(если бэкенду нужен ключ — добавь `--api-key sk-...`). Всё остальное (имя сервиса, пользователь, пути `/opt/clab`, `/etc/clab`, `/var/lib/clab`, bind `127.0.0.1:4097`, permission mode `read-only`) подставляется по умолчанию и переопределяется флагами.

Мастер спрашивает:

| Значение | Что это и где взять |
|---|---|
| **Backend URL** (`--base-url`) | Адрес твоего OpenAI-совместимого бэкенда. Ollama → `http://localhost:11434/v1`, llama.cpp → `http://localhost:8080/v1`, vLLM → `http://localhost:8000/v1`, облако → URL провайдера. |
| **Backend model** (`--backend-model`) | Имя модели, под которым её знает бэкенд. Из его списка моделей: `ollama list`, имя загруженной модели в vLLM/llama.cpp, или id облачной модели (напр. `gpt-4o-mini`). |
| **API key** (`--api-key`) | Ключ доступа к бэкенду. Локальным (Ollama/llama.cpp) обычно не нужен — оставь пустым; облаку/удалённому — ключ провайдера. |
| **Served model id** (`--served-model-id`) | Имя, которое **придумываешь сам** — оно появится в списке моделей Open WebUI (напр. `clab-agent`). |
| **Permission mode** (`--permission-mode`) | Что агенту можно: `read-only` (по умолч.) — только чтение; `workspace-write` — правка/запуск в рабочей папке; `danger-full-access` — полный доступ ко всей ФС (опасно для сервиса, открытого в чат). |

**Подключение Open WebUI:** добавь OpenAI-соединение на `http://<host>:4097/v1` — обязательно со схемой `http://` и хвостом `/v1` (host — адрес из bind; ключ можно оставить пустым). Затем выбери модель `clab-agent` (или свой `served-model-id`). Permission mode потом меняется в `CLAW_PERMISSION_MODE` (`/etc/clab/openai.env`) + рестарт сервиса.

Когда нужно лишь пересобрать и заменить бинарник, используй хелпер деплоя — он делает поэтапные проверки, бэкап, атомарную установку, рестарт и печатает команду отката:

```bash
cd rust
scripts/deploy-openai-server.sh \
  --runtime-bin /path/to/clab \
  --service clab-openai.service \
  --health-url http://127.0.0.1:4097/health
```

### Структура репозитория

- **`rust/`** — Rust-воркспейс и бинарник `clab` (CLI + сервер); каноническая реализация
- **`USAGE.md`** — сборка, авторизация, CLI, сессии, провайдеры
- **`docs/`** — Windows, локальные OpenAI-совместимые провайдеры, файловый контекст, контейнеры
- **`src/` + `tests/`** — вспомогательный референс/аудит-воркспейс; не основная среда выполнения

### Благодарности

Claw Lab — форк проекта **[Claw Code](https://github.com/ultraworkers/claw-code)** от UltraWorkers, используется по лицензии MIT. Оригинальный проект — источник ядра агента; Claw Lab не претендует на авторство этой исходной работы и сохраняет копирайт и лицензию оригинала в [`LICENSE`](./LICENSE).

---

## English

**Claw Lab is an agentic layer between your model and your chat.** Connect a backend (any OpenAI-compatible one: Ollama, llama.cpp, vLLM, cloud), tell it where to serve — and the same model shows up in your chat, but *with hands*: tools, web search, and a real agentic workflow.

```text
  your model            Claw Lab                    your chat
  Ollama · llama.cpp ─▶  tools · web search      ─▶  Open WebUI ·
  vLLM · cloud           agentic workflow             any OpenAI client
                         (served as OpenAI API)
```

### Why

A local model in Open WebUI can basically only talk. Claw Lab sits in the middle and gives it hands — tools, search, a multi-step agent loop — **without changing your backend or your UI**. To the frontend it looks like a normal model in the list: pick it and chat, except now it can *act*, not just answer.

It differs from the original [Claw Code](#credits) (a terminal coding agent) in focus: the point here isn't the CLI, it's this "model → agent → chat" layer for self-hosting on a home server.

### How it works

By design you only need two things:

1. **Where to reach the model** — the address and key of your OpenAI-compatible backend (local or remote).
2. **Where to serve** — the address to expose an OpenAI-compatible endpoint your chat can see.

Claw Lab then serves `/v1/chat/completions` with streaming, which Open WebUI (or any client) sees as a single model. Everything else — tools, search, sessions — happens inside.

> **Status:** experimental, built for a home server. **Linux is the validated platform**; macOS and Windows/WSL are best-effort, future targets with no guarantees (CI builds binaries for them but they are not tested regularly). The service installs with a single command (backend + output) or an interactive wizard — see "Run it as a service" below.

### What's inside

- **Tools and an agent loop** — the model runs multi-step tasks via built-in tools instead of only replying.
- **Built-in web search** — parses JSON results with snippets, with a DuckDuckGo/HTML fallback.
- **Clean tool calls in Open WebUI** — tool calls render as collapsible details, not raw text.
- **Chat-friendly sessions** — ephemeral: the frontend owns history and resends it in full on every request (`messages[]`), and clab rebuilds the session per request. No history leaks between chats.
- **Stable model name** — the frontend sees a constant id (e.g. `clab-agent`) while the real provider model stays internal and swappable.
- **Isolation** — the live service runs in a neutral workdir and won't pull `CLAUDE.md`, git status, or project settings into ordinary chats.

### Quick start

This repo is build-from-source only. The `install.sh` installer detects your OS, checks the Rust toolchain and system dependencies (C compiler, OpenSSL, pkg-config), and — if system packages are missing — shows the command and offers to install them (`y/n`):

```bash
git clone https://github.com/striker9272/claw-lab
cd claw-lab
./install.sh --release
```

The binary lands in `rust/target/release/clab` (`.exe` on Windows); the installer also runs `clab --version` for you. Next, set up the service — see "Run it as a service" below (backend and key are configured there, in one place). CLI commands (`clab doctor`, `clab prompt`), providers, sessions, and Windows/PowerShell notes are in [`USAGE.md`](./USAGE.md) and [`docs/`](./docs).

> A manual build (`cd rust && cargo build --release -p clab-cli`) also works but **does not check dependencies** — use it only if your environment is already set up.

> Don't want to install Rust? Download a prebuilt release binary: `./install.sh --prebuilt` (needs `gh` or `curl`; for a private repo, an authenticated `gh`). Pin a version with `--prebuilt-tag vX.Y.Z`.

### Run it as a service

The main use case. If you installed via `./install.sh --release`, it offers to set up the service at the end — answer `y` and the installer places the binary and runs the wizard (one command from nothing to a running service).

**Before you start, you need:**

- a running OpenAI-compatible backend with a model (Ollama / llama.cpp / vLLM / cloud), reachable over the network;
- Open WebUI (or any OpenAI client) to talk to clab.

You can also run the wizard separately (`install.sh` places the binary; for a manual build, place it first: `sudo install -D -m 755 rust/target/release/clab /opt/clab/bin/clab`):

```bash
cd rust
bash scripts/clab-setup.sh
```

Or in one non-interactive command:

```bash
cd rust
scripts/install-openai-service.sh \
  --base-url http://127.0.0.1:8000/v1 \
  --backend-model <backend-model> \
  --served-model-id clab-agent \
  --enable --restart
```

(if your backend needs a key, add `--api-key sk-...`). Everything else (service name, user, paths `/opt/clab`, `/etc/clab`, `/var/lib/clab`, bind `127.0.0.1:4097`, permission mode `read-only`) is defaulted and overridable via flags.

The wizard asks for:

| Value | What it is / where to get it |
|---|---|
| **Backend URL** (`--base-url`) | Your OpenAI-compatible backend's address. Ollama → `http://localhost:11434/v1`, llama.cpp → `http://localhost:8080/v1`, vLLM → `http://localhost:8000/v1`, cloud → the provider's URL. |
| **Backend model** (`--backend-model`) | The model id your backend knows it by. From its model list: `ollama list`, the model you loaded in vLLM/llama.cpp, or a cloud model id (e.g. `gpt-4o-mini`). |
| **API key** (`--api-key`) | Your backend's access key. Local backends (Ollama/llama.cpp) usually need none — leave blank; cloud/remote needs the provider's key. |
| **Served model id** (`--served-model-id`) | A name **you choose** — it shows up in Open WebUI's model list (e.g. `clab-agent`). |
| **Permission mode** (`--permission-mode`) | What the agent may do: `read-only` (default) — read only; `workspace-write` — edit/run inside the work dir; `danger-full-access` — full filesystem access (risky for a chat-exposed service). |

**Connecting Open WebUI:** add an OpenAI connection pointing at `http://<host>:4097/v1` — include the `http://` scheme and the `/v1` suffix (host is your bind address; the key can be left blank). Then pick the `clab-agent` model (or your `served-model-id`). Permission mode can later be changed in `CLAW_PERMISSION_MODE` (`/etc/clab/openai.env`) followed by a service restart.

When you only need to rebuild and swap the binary, use the deploy helper — it stages checks, backs up, installs atomically, restarts, and prints a rollback command:

```bash
cd rust
scripts/deploy-openai-server.sh \
  --runtime-bin /path/to/clab \
  --service clab-openai.service \
  --health-url http://127.0.0.1:4097/health
```

### Repository layout

- **`rust/`** — the Rust workspace and the `clab` CLI + server binary (the canonical implementation)
- **`USAGE.md`** — build, auth, CLI, sessions, providers
- **`docs/`** — Windows install, local OpenAI-compatible providers, file-context, containers
- **`src/` + `tests/`** — companion reference/audit workspace; not the primary runtime

### Credits

Claw Lab is a fork of **[Claw Code](https://github.com/ultraworkers/claw-code)** by UltraWorkers, used under the MIT License. The upstream project is the origin of the agent core; Claw Lab does not claim ownership of that original work and retains the upstream copyright and license in [`LICENSE`](./LICENSE).
