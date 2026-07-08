<p align="center">
  <img src="assets/cloudling-wordmark.svg" alt="Cloudling" width="440">
</p>

<p align="center">
  <a href="https://github.com/striker9272/cloudling">striker9272/cloudling</a>
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

**Cloudling — агентная прослойка между твоей моделью и твоим чатом.** Подключаешь бэкенд (любой OpenAI-совместимый: Ollama, llama.cpp, vLLM, облако), указываешь куда отдавать — и в твоём чате появляется та же модель, но «с руками»: с инструментами, веб-поиском и нормальным агентным воркфлоу.

```text
  твоя модель            Cloudling                       твой чат
  Ollama · llama.cpp ─▶  инструменты · веб-поиск    ─▶  Open WebUI ·
  vLLM · облако          агентный воркфлоу               любой OpenAI-клиент
                         (наружу — как OpenAI API)
                             │
                             ▼
                         встроенный веб-UI
                         (свой чат в браузере, флаг --ui)
```

### Зачем это

Локальная модель в Open WebUI умеет, по сути, только разговаривать. Cloudling встаёт посередине и даёт ей руки — инструменты, поиск, многошаговый агентный цикл — **не меняя ни твой бэкенд, ни твой интерфейс**. Снаружи во фронте это выглядит как обычная модель в списке: выбрал — и общаешься, только она теперь умеет действовать, а не просто отвечать.

От оригинального [Claw Code](https://github.com/ultraworkers/claw-code) (это агент для кодинга в терминале) Cloudling отличается фокусом: здесь главное — не CLI, а вот эта прослойка «модель → агент → чат» для самостоятельного хостинга на домашнем сервере.

> **Статус:** проект экспериментальный, для домашнего сервера. Основная платформа — **Linux**. Есть нативные десктоп-сборки под Windows (проверена на Win11) и macOS (экспериментальная). Рассчитан на **одного пользователя в доверенной сети**: чат-эндпоинт `/v1` **без авторизации** — не выставляй его в интернет без внешней прослойки. Качество агента зависит от способности модели к tool-calling — открытые модели умеют это по-разному ([`docs/MODEL_COMPATIBILITY.md`](./docs/MODEL_COMPATIBILITY.md)).

### Что внутри

- **Инструменты и агентный цикл** — модель не просто отвечает, а выполняет многошаговые задачи через встроенные инструменты.
- **MCP-серверы** — внешние программы-инструменты подключаются в интерфейсе (Настройки → Инструменты) или парой строк в `settings.json`; появляются у модели как `mcp__<сервер>__<инструмент>`, живут в тёплом пуле, применяются без рестарта. Каждый сервер можно включать/выключать переключателем — выключенный не грузит инструменты в контекст.
- **Встроенный веб-поиск** — ходит в настраиваемый JSON-бэкенд (например, self-hosted SearXNG); без него — откат на скрейп DuckDuckGo (менее надёжный).
- **Управление контекстом** — встроенный UI определяет окно модели, показывает счётчик «занято / окно (%)» и сам сжимает историю модельной сводкой перед переполнением; для внешних клиентов есть серверная страховка.
- **Аккуратные tool-call'ы в Open WebUI** — вызовы показываются как сворачиваемые детали, а не сырой текст.
- **Сессии под чат** — эфемерные: историю держит фронт и присылает целиком (`messages[]`), Cloudling пересобирает сессию на каждый запрос. Истории не утекают между чатами.
- **Стабильное имя модели** — фронт видит постоянный id (например `cloudling`), реальная модель провайдера остаётся внутренней и заменяемой.
- **Изоляция** — живой сервис работает в нейтральной директории и не тянет в обычные чаты `CLAUDE.md`, git-статус и настройки проекта.
- **Встроенный веб-интерфейс (опционально)** — с флагом `--ui` тот же бинарник отдаёт на том же порту страницу чата: стрим, tool-call'ы, markdown, вложения-картинки, интерактивные вопросы модели, серверное хранилище диалогов/пресетов/настроек. По умолчанию headless. Подробнее — [`docs/web-ui.md`](./docs/web-ui.md).

**Десктоп без терминала (опционально):**

- **Windows** — тот же `cloudling.exe` живёт значком в трее (двойной клик → фоновый serve+UI без консоли; меню открыть/автозапуск/удалить), без Docker и WSL; проверено на Win11. В терминале `cloudling` остаётся CLI/REPL. См. [`docs/windows-install-release.md`](./docs/windows-install-release.md).
- **Linux** — пакет `.deb`: двойной клик → графический установщик → «Cloudling» в меню приложений → запуск кликом (фоновый serve+UI + значок в трее). Бинарник статический (musl) — на любом дистрибутиве. См. «Обновление и удаление» ниже.
- **macOS (экспериментально)** — `.dmg`/`.app` (menu-bar-агент) + launchd-инсталлятор. Требуется **Apple Silicon и macOS 11+**. Собирается CI как **pre-release workflow-артефакт** (скачивается со страницы Actions для теста), но **в публичный Release пока не прикрепляется** — не проверено на живом железе и не подписано (Gatekeeper предупреждает). Поддерживаемый путь сейчас — **сборка из исходников**. См. [`docs/macos.md`](./docs/macos.md).

---

## Установка (Linux)

**Самый быстрый путь — одной командой, без клонирования.** Скачивает готовый бинарник (репозиторий публичный — авторизация не нужна) и сразу поднимает сервис. Выбери один из двух вариантов.

**Вариант 1 — со встроенным веб-UI.** Движок (модель и адрес) укажешь потом в браузере при первом запуске:

```bash
curl -fsSL https://raw.githubusercontent.com/striker9272/cloudling/main/install.sh \
  | bash -s -- --prebuilt --repo striker9272/cloudling -- \
      --ui --bind 0.0.0.0:4097 --enable --restart
```

**Вариант 2 — классический API (без UI).** Движок задаёшь флагами сразу (что писать в `--base-url`/`--backend-model` — см. таблицу в разделе «Сервис»):

```bash
curl -fsSL https://raw.githubusercontent.com/striker9272/cloudling/main/install.sh \
  | bash -s -- --prebuilt --repo striker9272/cloudling -- \
      --base-url http://127.0.0.1:8000/v1 --backend-model <модель> \
      --served-model-id cloudling --enable --restart
```

Ниже — то же по шагам и путь **из исходников** (для него нужен клон). Команды с `cd rust` выполняются **из корня склонированного репозитория**.

### Шаг 1 — склонировать репозиторий

```bash
git clone https://github.com/striker9272/cloudling
cd cloudling
```

### Шаг 2 — поставить бинарник

Выбери один путь.

**A. Готовый бинарник (быстро, Rust не нужен).** Установщик сам скачает нужный ассет из релиза (репозиторий публичный — авторизация не нужна, качается через `curl`):

```bash
./install.sh --prebuilt                 # последняя версия
./install.sh --prebuilt-tag vX.Y.Z      # или конкретная
```

Бинарник статический (musl) — запускается на любом дистрибутиве, без подгонки под glibc.

**B. Сборка из исходников.** Установщик проверит Rust-тулчейн и системные зависимости (компилятор, OpenSSL, pkg-config) и, если чего-то не хватает, предложит доустановить:

```bash
./install.sh --release
```

Бинарник появится в `rust/target/release/cloudling`; установщик сам проверит `cloudling --version`.

### Шаг 3 — поднять сервис

В конце обоих путей `install.sh` предложит поднять сервис — ответь `y`, и откроется мастер (раздел «Сервис» ниже; это путь «одной командой от нуля до работающего сервиса»). Мастер можно запустить и отдельно, позже — тоже ниже.

> **Нужен ли Windows/macOS-путь?** Для Windows скачай ассет `cloudling-windows-x64.exe` (см. [`docs/windows-install-release.md`](./docs/windows-install-release.md)); для десктопа без терминала на Linux — `.deb` (см. «Обновление и удаление»); macOS ставится из исходников (`./install.sh --release`).

---

## Сервис

Основной сценарий — Cloudling как systemd-сервис, отдающий OpenAI-эндпоинт.

**Что нужно заранее:**

- запущенный OpenAI-совместимый бэкенд с моделью (Ollama / llama.cpp / vLLM / облако), доступный по сети;
- Open WebUI (или любой OpenAI-клиент), который будет ходить в Cloudling.

**Мастер (интерактивно).** Запускается сам в конце `install.sh`, либо отдельно из корня репозитория:

```bash
cd rust
bash scripts/install-openai-service.sh
```

(при ручной сборке сначала положи бинарник: `sudo install -D -m 755 rust/target/release/cloudling /opt/cloudling/bin/cloudling`.)

**Мастер спрашивает:**

| Значение | Что это и где взять |
|---|---|
| **Backend URL** (`--base-url`) | Адрес твоего OpenAI-совместимого бэкенда. Ollama → `http://localhost:11434/v1`, llama.cpp → `http://localhost:8080/v1`, vLLM → `http://localhost:8000/v1`, облако → URL провайдера. |
| **Backend model** (`--backend-model`) | Имя модели у бэкенда: `ollama list`, имя загруженной модели в vLLM/llama.cpp, или id облачной модели (напр. `gpt-4o-mini`). |
| **API key** (`--api-key`) | Ключ к бэкенду. Локальным (Ollama/llama.cpp) обычно не нужен — оставь пустым; облаку/удалённому — ключ провайдера. |
| **Served model id** (`--served-model-id`) | Имя, которое **придумываешь сам** — оно появится в списке моделей Open WebUI (напр. `cloudling`). |
| **Permission mode** (`--permission-mode`) | Что агенту можно: `read-only` (по умолч.) — только чтение; `workspace-write` — правка/запуск в рабочей папке; `danger-full-access` — полный доступ ко всей ФС (опасно для сервиса, открытого в чат). |
| **Web search URL** (`--websearch-url`) | Необязательно. Адрес JSON-бэкенда поиска (SearXNG): `http://<host>:8888/search?format=json`. Пусто → встроенный фолбэк на DuckDuckGo (менее надёжный). |

**Или одной командой, без вопросов:**

```bash
cd rust
scripts/install-openai-service.sh \
  --base-url http://127.0.0.1:8000/v1 \
  --backend-model <модель-бэкенда> \
  --served-model-id cloudling \
  --enable --restart
```

Всё остальное подставляется по умолчанию и переопределяется флагами: сервис `cloudling.service`, пути `/opt/cloudling` (бинарник), `/etc/cloudling/openai.env` (настройки), `/var/lib/cloudling` (рабочие каталоги и UI-данные), bind `127.0.0.1:4097`, permission mode `read-only`.

> **Повторный запуск безопасен.** Мастер можно перезапускать на уже настроенном сервисе: текущие значения из env-файла (движок, bind, served-id, permission mode, ключ, UI-токен) сохраняются — переопределяй флагом только то, что меняешь.

### Подключить Open WebUI

Добавь OpenAI-соединение на `http://<host>:4097/v1` — обязательно со схемой `http://` и хвостом `/v1` (host — адрес из bind; ключ можно оставить пустым). Затем выбери модель `cloudling` (или свой `served-model-id`).

Permission mode позже меняется в `CLAW_PERMISSION_MODE` (`/etc/cloudling/openai.env`) + рестарт сервиса.

### Веб-поиск (необязательно, но рекомендуется)

Без веб-поиск-бэкенда поиск идёт скрейпом DuckDuckGo — работает, но ненадёжно. Для нормального поиска подними self-hosted [SearXNG](https://github.com/searxng/searxng), включи у него JSON (`search.formats: [html, json]` в `settings.yml`) и передай `--websearch-url http://<host>:8888/search?format=json` (или впиши `CLAWD_WEB_SEARCH_BASE_URL` в env-файл). `&q=<запрос>` Cloudling допишет сам.

### Встроенный веб-интерфейс (необязательно)

Кроме API, Cloudling умеет сам отдавать страницу чата. При установке мастер первым делом спрашивает — «с веб-интерфейсом или классический API». Если выбрать UI, мастер **не спрашивает про движок** (модель и адрес укажешь в браузере), сам сгенерит токен доступа и в конце покажет адрес страницы. Открываешь → экран первого запуска → указываешь движок → сохраняешь → ядро перезапускается.

Неинтерактивно весь UI-режим ставится одной командой (всё после `--` уходит в установщик сервиса):

```bash
./install.sh --release -- --ui --bind 0.0.0.0:4097 --enable --restart
```

Под капотом — флаг `cloudling openai-serve --ui` плюс переменные: `CLOUDLING_UI_TOKEN` (Bearer-токен для служебных `/ui/*`; вне loopback без него они отключены), `CLOUDLING_UI_DATA_DIR` (диалоги/пресеты; в сервисе по умолчанию `/var/lib/cloudling/ui`), `CLOUDLING_OPENAI_ENV_FILE` (чтобы UI мог сохранять «Основное» и перезапускать ядро). По умолчанию сервис headless. Полная инструкция и модель доступа — [`docs/web-ui.md`](./docs/web-ui.md).

---

## Обновление и удаление

**Пересобрать и заменить бинарник** у уже работающего сервиса — хелпер деплоя (поэтапные проверки, бэкап, атомарная установка, рестарт, печать команды отката). Из корня репозитория:

```bash
cd rust
scripts/deploy-openai-server.sh \
  --runtime-bin /opt/cloudling/bin/cloudling \
  --service cloudling.service \
  --health-url http://127.0.0.1:4097/health
```

**Снести сервис целиком** — парной командой из корня репозитория (убирает unit, wrapper, env, бинарник, рабочие каталоги, UI-данные и бэкапы; `--keep-data` оставит данные, `--dry-run` покажет план, `--yes` без вопросов):

```bash
./uninstall.sh
```

**Десктоп-`.deb` (Linux)** ставится/сносится через центр приложений или `sudo apt install ./cloudling_*_amd64.deb` / `sudo apt remove cloudling`; пользовательские данные сносит `cloudling uninstall`.

**Какой скрипт когда:**

- `install.sh` — точка входа: собрать/скачать бинарник + при желании поднять сервис.
- `rust/scripts/install-openai-service.sh` — мастер установки сервиса (интерактивный без флагов, неинтерактивный по флагам).
- `rust/scripts/deploy-openai-server.sh` — пересобрать и заменить бинарник у работающего сервиса.
- `uninstall.sh` — снести всё.

> Ручная сборка (`cd rust && cargo build --release -p cloudling-cli`) тоже работает, но **не проверяет зависимости** — используй, только если окружение уже настроено.

---

### Структура репозитория

- **`rust/`** — Rust-воркспейс и бинарник `cloudling` (CLI + сервер); каноническая реализация.
- **`USAGE.md`** — CLI-команды (`cloudling doctor`, `cloudling prompt`), провайдеры, сессии, заметки по Windows/PowerShell.
- **`docs/`** — Windows, macOS, локальные OpenAI-совместимые провайдеры, файловый контекст, контейнеры, встроенный веб-UI.

### Благодарности

Cloudling — форк проекта **[Claw Code](https://github.com/ultraworkers/claw-code)** от UltraWorkers, используется по лицензии MIT. Оригинальный проект — источник ядра агента; Cloudling не претендует на авторство этой исходной работы и сохраняет копирайт и лицензию оригинала в [`LICENSE`](./LICENSE).

---

## English

**Cloudling is an agentic layer between your model and your chat.** Connect a backend (any OpenAI-compatible one: Ollama, llama.cpp, vLLM, cloud), tell it where to serve — and the same model shows up in your chat, but *with hands*: tools, web search, and a real agentic workflow.

```text
  your model            Cloudling                    your chat
  Ollama · llama.cpp ─▶  tools · web search      ─▶  Open WebUI ·
  vLLM · cloud           agentic workflow             any OpenAI client
                         (served as OpenAI API)
                             │
                             ▼
                         built-in web UI
                         (your own chat in the browser, --ui flag)
```

### Why

A local model in Open WebUI can basically only talk. Cloudling sits in the middle and gives it hands — tools, search, a multi-step agent loop — **without changing your backend or your UI**. To the frontend it looks like a normal model in the list: pick it and chat, except now it can *act*, not just answer.

It differs from the original [Claw Code](#credits) (a terminal coding agent) in focus: the point here isn't the CLI, it's this "model → agent → chat" layer for self-hosting on a home server.

> **Status:** experimental, built for a home server. Primary platform is **Linux**. Native desktop builds exist for Windows (tested on Win11) and macOS (experimental). Built for a **single user on a trusted network**: the `/v1` chat endpoint is **unauthenticated** — don't expose it to the internet without an external auth layer. Agentic quality depends on the model's tool-calling ability — open models vary ([`docs/MODEL_COMPATIBILITY.md`](./docs/MODEL_COMPATIBILITY.md)).

### What's inside

- **Tools and an agent loop** — the model runs multi-step tasks via built-in tools instead of only replying.
- **MCP servers** — external tool programs plug in from the UI (Settings → Tools) or a couple of lines in `settings.json`; they show up as `mcp__<server>__<tool>`, live in a warm pool, and apply without a restart. Each server has an on/off toggle — a disabled one loads no tools into context.
- **Built-in web search** — queries a configurable JSON backend (e.g. a self-hosted SearXNG); falls back to scraping DuckDuckGo when unset (less reliable).
- **Context management** — the built-in UI detects the model's context window, shows a "used / window (%)" gauge, and compacts long history into a model-written summary before it overflows; a server-side safety net covers external clients.
- **Clean tool calls in Open WebUI** — tool calls render as collapsible details, not raw text.
- **Chat-friendly sessions** — ephemeral: the frontend owns history and resends it in full (`messages[]`), and Cloudling rebuilds the session per request. No history leaks between chats.
- **Stable model name** — the frontend sees a constant id (e.g. `cloudling`) while the real provider model stays internal and swappable.
- **Isolation** — the live service runs in a neutral workdir and won't pull `CLAUDE.md`, git status, or project settings into ordinary chats.
- **Built-in web UI (optional)** — with `--ui` the same binary serves a chat page on the same port: streaming, tool calls, markdown, image attachments, interactive model questions, server-side storage of dialogs/presets/settings. Headless by default. See [`docs/web-ui.md`](./docs/web-ui.md).

**No-terminal desktop (optional):**

- **Windows** — the same `cloudling.exe` runs as a system-tray app (double-click → background serve+UI, no console; tray menu open/start-at-login/uninstall), no Docker or WSL; tested on Win11. In a terminal `cloudling` stays a CLI/REPL. See [`docs/windows-install-release.md`](./docs/windows-install-release.md).
- **Linux** — a `.deb` package: double-click → graphical installer → "Cloudling" in the apps menu → click to launch (background serve+UI + tray icon). The binary is static (musl) — runs on any distro. See "Updating and uninstalling" below.
- **macOS (experimental)** — a `.dmg`/`.app` (menu-bar agent) plus a launchd installer. Requires **Apple Silicon and macOS 11+**. Built by CI as a **pre-release workflow artifact** (downloadable from the Actions run for testing), but **not attached to the public release yet** — not verified on real hardware and unsigned (Gatekeeper warns). The supported path today is **build from source**. See [`docs/macos.md`](./docs/macos.md).

---

## Install (Linux)

**Fastest — one command, no clone.** Downloads the prebuilt binary (the repo is public — no auth) and sets up the service in one go. Pick one of the two.

**Option 1 — with the built-in web UI.** Point it at your engine (model and URL) later, in the browser on first run:

```bash
curl -fsSL https://raw.githubusercontent.com/striker9272/cloudling/main/install.sh \
  | bash -s -- --prebuilt --repo striker9272/cloudling -- \
      --ui --bind 0.0.0.0:4097 --enable --restart
```

**Option 2 — classic API (no UI).** Set the engine via flags right away (see the table under "Service" for what goes in `--base-url`/`--backend-model`):

```bash
curl -fsSL https://raw.githubusercontent.com/striker9272/cloudling/main/install.sh \
  | bash -s -- --prebuilt --repo striker9272/cloudling -- \
      --base-url http://127.0.0.1:8000/v1 --backend-model <model> \
      --served-model-id cloudling --enable --restart
```

Below is the same thing step by step, plus the **build-from-source** path (which needs a clone). Commands with `cd rust` run **from the root of the cloned repository**.

### Step 1 — clone the repo

```bash
git clone https://github.com/striker9272/cloudling
cd cloudling
```

### Step 2 — install the binary

Pick one path.

**A. Prebuilt binary (fast, no Rust).** The installer fetches the right release asset (the repo is public — no auth needed, it downloads via `curl`):

```bash
./install.sh --prebuilt                 # latest
./install.sh --prebuilt-tag vX.Y.Z      # or a specific version
```

The binary is statically linked (musl) — it runs on any distribution, no glibc matching.

**B. Build from source.** The installer checks the Rust toolchain and system dependencies (C compiler, OpenSSL, pkg-config) and offers to install anything missing:

```bash
./install.sh --release
```

The binary lands in `rust/target/release/cloudling`; the installer runs `cloudling --version` for you.

### Step 3 — set up the service

At the end of either path `install.sh` offers to set up the service — answer `y` and the wizard opens (see "Service" below; this is the "one command from nothing to a running service" path). You can also run the wizard separately later — also below.

> **Windows / macOS?** For Windows, grab the `cloudling-windows-x64.exe` asset (see [`docs/windows-install-release.md`](./docs/windows-install-release.md)); for a no-terminal Linux desktop, the `.deb` (see "Updating and uninstalling"); macOS is build-from-source (`./install.sh --release`).

---

## Service

The main use case — Cloudling as a systemd service exposing an OpenAI endpoint.

**Before you start, you need:**

- a running OpenAI-compatible backend with a model (Ollama / llama.cpp / vLLM / cloud), reachable over the network;
- Open WebUI (or any OpenAI client) to talk to Cloudling.

**Wizard (interactive).** Runs itself at the end of `install.sh`, or separately from the repo root:

```bash
cd rust
bash scripts/install-openai-service.sh
```

(for a manual build, place the binary first: `sudo install -D -m 755 rust/target/release/cloudling /opt/cloudling/bin/cloudling`.)

**The wizard asks for:**

| Value | What it is / where to get it |
|---|---|
| **Backend URL** (`--base-url`) | Your OpenAI-compatible backend's address. Ollama → `http://localhost:11434/v1`, llama.cpp → `http://localhost:8080/v1`, vLLM → `http://localhost:8000/v1`, cloud → the provider's URL. |
| **Backend model** (`--backend-model`) | The model id your backend knows it by: `ollama list`, the model you loaded in vLLM/llama.cpp, or a cloud model id (e.g. `gpt-4o-mini`). |
| **API key** (`--api-key`) | Your backend's key. Local backends (Ollama/llama.cpp) usually need none — leave blank; cloud/remote needs the provider's key. |
| **Served model id** (`--served-model-id`) | A name **you choose** — it shows up in Open WebUI's model list (e.g. `cloudling`). |
| **Permission mode** (`--permission-mode`) | What the agent may do: `read-only` (default) — read only; `workspace-write` — edit/run inside the work dir; `danger-full-access` — full filesystem access (risky for a chat-exposed service). |
| **Web search URL** (`--websearch-url`) | Optional. A JSON search backend (SearXNG) URL: `http://<host>:8888/search?format=json`. Empty → a built-in DuckDuckGo fallback (less reliable). |

**Or one non-interactive command:**

```bash
cd rust
scripts/install-openai-service.sh \
  --base-url http://127.0.0.1:8000/v1 \
  --backend-model <backend-model> \
  --served-model-id cloudling \
  --enable --restart
```

Everything else is defaulted and overridable via flags: service `cloudling.service`, paths `/opt/cloudling` (binary), `/etc/cloudling/openai.env` (settings), `/var/lib/cloudling` (work dirs and UI data), bind `127.0.0.1:4097`, permission mode `read-only`.

> **Re-running is safe.** You can re-run the wizard on an already-configured service: the current env-file values (engine, bind, served-id, permission mode, key, UI token) are preserved — pass a flag only for what you change.

### Connect Open WebUI

Add an OpenAI connection pointing at `http://<host>:4097/v1` — include the `http://` scheme and the `/v1` suffix (host is your bind address; the key can be left blank). Then pick the `cloudling` model (or your `served-model-id`).

Permission mode can later be changed in `CLAW_PERMISSION_MODE` (`/etc/cloudling/openai.env`) followed by a service restart.

### Web search (optional but recommended)

Without a search backend, search scrapes DuckDuckGo — it works but is unreliable. For real search, run a self-hosted [SearXNG](https://github.com/searxng/searxng), enable its JSON format (`search.formats: [html, json]` in `settings.yml`), and pass `--websearch-url http://<host>:8888/search?format=json` (or set `CLAWD_WEB_SEARCH_BASE_URL` in the env file). Cloudling appends `&q=<query>` itself.

### Built-in web UI (optional)

Besides the API, Cloudling can serve a chat page itself. During setup the wizard first asks — "built-in web UI or classic API". Pick the UI and it **skips the backend questions** (you set the model and URL in the browser), generates an access token, and prints the page address at the end. Open it, land on the first-run screen, point it at your engine, save — the core restarts.

To set up the whole UI mode non-interactively (everything after `--` is forwarded to the service installer):

```bash
./install.sh --release -- --ui --bind 0.0.0.0:4097 --enable --restart
```

Under the hood this is `cloudling openai-serve --ui` plus `CLOUDLING_UI_TOKEN` (Bearer token for the `/ui/*` data endpoints; off-loopback they are disabled without it), `CLOUDLING_UI_DATA_DIR` (dialog/preset storage; `/var/lib/cloudling/ui` in the service), and `CLOUDLING_OPENAI_ENV_FILE` (so the UI can save "General" settings and restart the core). The service is headless by default. Full guide and auth model — [`docs/web-ui.md`](./docs/web-ui.md).

---

## Updating and uninstalling

**Rebuild and swap the binary** on an already-running service — the deploy helper (staged checks, backup, atomic install, restart, prints a rollback command). From the repo root:

```bash
cd rust
scripts/deploy-openai-server.sh \
  --runtime-bin /opt/cloudling/bin/cloudling \
  --service cloudling.service \
  --health-url http://127.0.0.1:4097/health
```

**Remove the service** — the counterpart command, from the repo root (removes the unit, wrapper, env, binary, work dirs, UI data, and backups; `--keep-data` keeps the data, `--dry-run` shows the plan, `--yes` skips prompts):

```bash
./uninstall.sh
```

**Desktop `.deb` (Linux)** installs/removes via the App Center or `sudo apt install ./cloudling_*_amd64.deb` / `sudo apt remove cloudling`; `cloudling uninstall` removes user data.

**Which script when:**

- `install.sh` — entry point: build/download the binary + optionally set up the service.
- `rust/scripts/install-openai-service.sh` — the service install wizard (interactive with no flags, non-interactive with flags).
- `rust/scripts/deploy-openai-server.sh` — rebuild and swap the binary on a running service.
- `uninstall.sh` — remove everything.

> A manual build (`cd rust && cargo build --release -p cloudling-cli`) also works but **does not check dependencies** — use it only if your environment is already set up.

---

### Repository layout

- **`rust/`** — the Rust workspace and the `cloudling` CLI + server binary (the canonical implementation).
- **`USAGE.md`** — CLI commands (`cloudling doctor`, `cloudling prompt`), providers, sessions, Windows/PowerShell notes.
- **`docs/`** — Windows, macOS, local OpenAI-compatible providers, file-context, containers, the built-in web UI.

### Credits

Cloudling is a fork of **[Claw Code](https://github.com/ultraworkers/claw-code)** by UltraWorkers, used under the MIT License. The upstream project is the origin of the agent core; Cloudling does not claim ownership of that original work and retains the upstream copyright and license in [`LICENSE`](./LICENSE).
