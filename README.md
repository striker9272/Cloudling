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

### Как это работает

По задумке нужно всего две вещи:

1. **Куда ходить за моделью** — адрес и ключ твоего OpenAI-совместимого бэкенда (локального или внешнего).
2. **Куда отдавать результат** — на каком адресе поднять OpenAI-совместимый эндпоинт, который увидит твой чат.

На выходе Cloudling поднимает `/v1/chat/completions` со стримингом, который Open WebUI (или другой клиент) видит как одну модель. Всё остальное — инструменты, поиск, сессии — уже внутри.

> **Статус:** проект экспериментальный, для домашнего сервера. **Основная серверная платформа — Linux** (сервис ставится одной командой или интерактивным мастером — см. «Запуск как сервиса» ниже). Для **Windows** есть нативная десктоп-сборка: тот же `cloudling.exe` живёт значком в трее (двойной клик → фоновый serve+UI, без Docker и WSL), проверена на Windows 11 — см. [`docs/windows-install-release.md`](./docs/windows-install-release.md). Для **macOS** есть экспериментальная десктоп-сборка (значок в menu-bar, `.dmg`/`.app`, launchd-инсталлятор); требуется **Apple Silicon и macOS 11+**; собирается CI, но на живом железе пока не проверена, поэтому публикуется только как pre-release-артефакты — см. [`docs/macos.md`](./docs/macos.md). Качество агентного поведения зависит от способности модели к tool-calling — открытые модели умеют это по-разному; заметки по совместимости — [`docs/MODEL_COMPATIBILITY.md`](./docs/MODEL_COMPATIBILITY.md). Рассчитан на одного пользователя в доверенной (домашней) сети: чат-эндпоинт `/v1` не требует авторизации — не выставляй его в интернет без внешней прослойки.

### Что внутри

- **Инструменты и агентный цикл** — модель не просто отвечает, а выполняет многошаговые задачи через встроенные инструменты.
- **Встроенный веб-поиск** — ходит в настраиваемый JSON-бэкенд (например, self-hosted SearXNG) через `CLAWD_WEB_SEARCH_BASE_URL`; если он не задан — откат на скрейп DuckDuckGo/HTML (менее надёжный).
- **MCP-серверы** — внешние программы-инструменты подключаются парой строк конфига (`mcpServers` в `settings.json` или Настройки → Инструменты во встроенном UI) и появляются у модели как `mcp__<сервер>__<инструмент>`; соединения живут в тёплом пуле, конфиг применяется без рестарта. Подробности — [`docs/web-ui.md`](./docs/web-ui.md).
- **Управление контекстом** — встроенный UI определяет окно модели (llama.cpp/vLLM/Ollama), показывает счётчик «занято / окно (%)», а при заполнении сам сжимает историю модельной сводкой — длинный чат не упирается в переполнение; для внешних клиентов есть серверная страховка авто-компакта.
- **Аккуратные tool-call'ы в Open WebUI** — вызовы инструментов показываются как сворачиваемые детали, а не как сырой текст в ответе.
- **Сессии под чат** — эфемерные: историю держит фронт и присылает её целиком в каждом запросе (`messages[]`), а cloudling пересобирает сессию на каждый запрос. Истории не утекают между чатами.
- **Стабильное имя модели** — фронт видит постоянный id (например `cloudling`), а реальная модель провайдера остаётся внутренней и заменяемой.
- **Изоляция** — живой сервис работает в нейтральной директории и не тянет в обычные чаты `CLAUDE.md`, git-статус и настройки проекта.
- **Встроенный веб-интерфейс (необязательно)** — с флагом `--ui` тот же бинарник отдаёт на том же порту страницу чата: стрим, сворачиваемые tool-call'ы, markdown, вложения-картинки, интерактивные вопросы модели (инструмент AskUserQuestion рисует в чате кликабельные варианты, выбор возвращается модели), серверное хранилище диалогов/пресетов/настроек. По умолчанию headless — UI не мешает API. Подробности — [`docs/web-ui.md`](./docs/web-ui.md).
- **Нативное десктоп-приложение для Windows (необязательно)** — тот же `cloudling.exe` умеет жить значком в трее: двойной клик → фоновый serve+UI без окна консоли; меню «открыть в браузере / автозапуск / удалить»; без Docker и WSL. В терминале `cloudling` остаётся обычным CLI/REPL. Подробности — [`docs/windows-install-release.md`](./docs/windows-install-release.md).
- **Десктоп-приложение для Linux (необязательно)** — пакет `.deb`: двойной клик → графический установщик (App Center / gdebi, без терминала) → «Cloudling» появляется в меню приложений → запуск кликом: фоновый serve+UI и значок в трее (открыть в браузере / автозапуск при входе / удалить). Бинарник статический (musl) — запускается на любом дистрибутиве, без подгонки под glibc. Удаление — через центр приложений или `apt remove`; пользовательские данные сносит `cloudling uninstall` (или пункт «Удалить» в меню). (Значок в трее показывают KDE и GNOME с расширением AppIndicator, которое в Ubuntu стоит из коробки.)
- **Десктоп-приложение для macOS (экспериментально)** — тот же `cloudling` живёт значком в menu-bar через `.dmg`/`.app` (перетащить в Applications → значок в menu-bar: открыть в браузере / автозапуск при входе / удалить), плюс launchd-инсталлятор для headless-сервера. Требуется **Apple Silicon и macOS 11.0+** (Intel / старее — только сборка из исходников). Собрано CI на Apple Silicon, но **на живом железе пока не проверено** — бинарник и `.dmg` публикуются только как pre-release-артефакты. Подробности — [`docs/macos.md`](./docs/macos.md).

### Быстрый старт

Два пути: взять **готовый бинарник** (быстро, Rust не нужен) или **собрать из исходников**.

**Готовый бинарник (без Rust).** Проще всего — установщик сам скачает нужный ассет из релиза:

```bash
./install.sh --prebuilt              # нужен gh или curl
# конкретная версия: ./install.sh --prebuilt-tag vX.Y.Z
```

Или вручную: со страницы Releases скачай `cloudling-linux-x64`, сделай исполняемым и проверь запуск:

```bash
chmod +x cloudling-linux-x64
./cloudling-linux-x64 --version
```

Бинарник статический (musl) — запускается на любом дистрибутиве, без подгонки под версию glibc. Для Windows — ассет `cloudling-windows-x64.exe` (см. [`docs/windows-install-release.md`](./docs/windows-install-release.md)); десктоп без терминала на Linux — `.deb` ниже. Дальше настрой сервис (раздел «Запуск как сервиса»).

**Сборка из исходников.** Установщик `install.sh` сам определит ОС, проверит Rust-тулчейн и системные зависимости (компилятор, OpenSSL, pkg-config), а если каких-то системных пакетов не хватает — покажет команду и предложит доустановить (`y/n`):

```bash
git clone https://github.com/striker9272/cloudling
cd cloudling
./install.sh --release
```

Бинарник появится в `rust/target/release/cloudling` (`.exe` на Windows); установщик сам проверит `cloudling --version`. Дальше настрой сервис — раздел «Запуск как сервиса» ниже (бэкенд и ключ задаются там, в одном месте). CLI-команды (`cloudling doctor`, `cloudling prompt`), провайдеры, сессии и заметки по Windows/PowerShell — в [`USAGE.md`](./USAGE.md) и [`docs/`](./docs).

> Ручная сборка (`cd rust && cargo build --release -p cloudling-cli`) тоже работает, но **не проверяет зависимости** — используй её, только если окружение уже настроено.

> **Десктоп без терминала (Linux).** Скачай `cloudling_*_amd64.deb` из релиза и открой двойным кликом — установится через графический центр приложений (или, если предпочитаешь терминал, `sudo apt install ./cloudling_*_amd64.deb`). После установки запусти «Cloudling» из меню приложений: поднимется фоновый serve+UI, появится значок в трее (открыть / автозапуск / удалить), браузер откроется сам. Бэкенд задаётся в браузере при первом запуске.

### Запуск как сервиса

Основной сценарий. Если ты ставил через `./install.sh --release`, он в конце сам предложит поднять сервис — ответь `y`, и установщик разложит бинарник и запустит мастер (путь «одной командой от нуля до сервиса»).

**Что нужно заранее:**

- запущенный OpenAI-совместимый бэкенд с моделью (Ollama / llama.cpp / vLLM / облако), доступный по сети;
- Open WebUI (или любой OpenAI-клиент), который будет ходить в cloudling.

Мастер можно запустить и отдельно — `install-openai-service.sh` без флагов на терминале сам переходит в интерактивный режим (бинарник кладёт `install.sh`; при ручной сборке сначала положи его: `sudo install -D -m 755 rust/target/release/cloudling /opt/cloudling/bin/cloudling`):

```bash
cd rust
bash scripts/install-openai-service.sh
```

Либо одной командой, без вопросов:

```bash
cd rust
scripts/install-openai-service.sh \
  --base-url http://127.0.0.1:8000/v1 \
  --backend-model <модель-бэкенда> \
  --served-model-id cloudling \
  --enable --restart
```

(если бэкенду нужен ключ — добавь `--api-key sk-...`). Всё остальное (сервис `cloudling.service`, пользователь, пути `/opt/cloudling`, `/etc/cloudling`, `/var/lib/cloudling`, bind `127.0.0.1:4097`, permission mode `read-only`) подставляется по умолчанию и переопределяется флагами.

> **Повторный запуск безопасен.** Установщик можно перезапускать на уже настроенном сервисе: текущие значения из env-файла (движок, bind, served-id, permission mode, ключ, UI-токен) сохраняются — переопределяй флагом только то, что нужно поменять.

Мастер спрашивает:

| Значение | Что это и где взять |
|---|---|
| **Backend URL** (`--base-url`) | Адрес твоего OpenAI-совместимого бэкенда. Ollama → `http://localhost:11434/v1`, llama.cpp → `http://localhost:8080/v1`, vLLM → `http://localhost:8000/v1`, облако → URL провайдера. |
| **Backend model** (`--backend-model`) | Имя модели, под которым её знает бэкенд. Из его списка моделей: `ollama list`, имя загруженной модели в vLLM/llama.cpp, или id облачной модели (напр. `gpt-4o-mini`). |
| **API key** (`--api-key`) | Ключ доступа к бэкенду. Локальным (Ollama/llama.cpp) обычно не нужен — оставь пустым; облаку/удалённому — ключ провайдера. |
| **Served model id** (`--served-model-id`) | Имя, которое **придумываешь сам** — оно появится в списке моделей Open WebUI (напр. `cloudling`). |
| **Permission mode** (`--permission-mode`) | Что агенту можно: `read-only` (по умолч.) — только чтение; `workspace-write` — правка/запуск в рабочей папке; `danger-full-access` — полный доступ ко всей ФС (опасно для сервиса, открытого в чат). |
| **Web search URL** (`--websearch-url`) | Необязательно. Адрес JSON-бэкенда поиска (SearXNG): `http://<host>:8888/search?format=json`. Если пусто — `cloudling` использует встроенный фолбэк на DuckDuckGo (менее надёжный). |

**Веб-поиск (необязательно, но рекомендуется).** Без `CLAWD_WEB_SEARCH_BASE_URL` поиск идёт через скрейп DuckDuckGo — работает, но ненадёжно. Для нормального поиска подними self-hosted [SearXNG](https://github.com/searxng/searxng), включи у него JSON-формат (`search.formats: [html, json]` в `settings.yml`) и передай `--websearch-url http://<host>:8888/search?format=json` (или впиши `CLAWD_WEB_SEARCH_BASE_URL` в env-файл). Допишет `&q=<запрос>` `cloudling` сам.

**Подключение Open WebUI:** добавь OpenAI-соединение на `http://<host>:4097/v1` — обязательно со схемой `http://` и хвостом `/v1` (host — адрес из bind; ключ можно оставить пустым). Затем выбери модель `cloudling` (или свой `served-model-id`). Permission mode потом меняется в `CLAW_PERMISSION_MODE` (`/etc/cloudling/openai.env`) + рестарт сервиса.

**Встроенный веб-интерфейс (необязательно).** Кроме API, `cloudling` умеет сам отдавать страницу чата. Самый простой путь: при установке мастер первым делом спрашивает — «с веб-интерфейсом или классический API». Если выбрать UI, мастер **не спрашивает про движок** (модель и адрес укажешь прямо в браузере), сам сгенерит токен доступа и в конце покажет адрес страницы. Открываешь его — попадаешь на экран первого запуска, указываешь движок, сохраняешь — ядро перезапускается, и всё готово. Неинтерактивно весь UI-режим ставится одной командой (всё после `--` уходит в установщик сервиса): `./install.sh --release -- --ui --bind 0.0.0.0:4097 --enable --restart`. Под капотом это флаг `cloudling openai-serve --ui` + переменные `CLOUDLING_UI_TOKEN` (Bearer-токен для служебных `/ui/*`; вне loopback без него они отключены), `CLOUDLING_UI_DATA_DIR` (диалоги/пресеты; дефолт `$HOME/.claw/ui`), `CLOUDLING_OPENAI_ENV_FILE` (чтобы UI мог сохранять «Основное» и перезапускать ядро). По умолчанию сервис headless (только API). Полная инструкция и модель доступа — [`docs/web-ui.md`](./docs/web-ui.md).

Когда нужно лишь пересобрать и заменить бинарник, используй хелпер деплоя — он делает поэтапные проверки, бэкап, атомарную установку, рестарт и печатает команду отката:

```bash
cd rust
scripts/deploy-openai-server.sh \
  --runtime-bin /opt/cloudling/bin/cloudling \
  --service cloudling.service \
  --health-url http://127.0.0.1:4097/health
```

Снести сервис целиком — парной командой `uninstall.sh` (убирает unit, wrapper, env, бинарник, а также рабочие каталоги, UI-данные (диалоги/пресеты) и бэкапы; `--keep-data` оставит данные, `--dry-run` покажет план, `--yes` без вопросов):

```bash
./uninstall.sh
```

**Какой скрипт когда:** `install.sh` — точка входа (собрать бинарник + при желании поднять сервис); `rust/scripts/install-openai-service.sh` — движок установки сервиса (интерактивный без флагов, неинтерактивный по флагам); `rust/scripts/deploy-openai-server.sh` — пересобрать и заменить бинарник у уже работающего сервиса; `uninstall.sh` — снести всё.

### Структура репозитория

- **`rust/`** — Rust-воркспейс и бинарник `cloudling` (CLI + сервер); каноническая реализация
- **`USAGE.md`** — сборка, авторизация, CLI, сессии, провайдеры
- **`docs/`** — Windows, macOS, локальные OpenAI-совместимые провайдеры, файловый контекст, контейнеры, встроенный веб-UI

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

### How it works

By design you only need two things:

1. **Where to reach the model** — the address and key of your OpenAI-compatible backend (local or remote).
2. **Where to serve** — the address to expose an OpenAI-compatible endpoint your chat can see.

Cloudling then serves `/v1/chat/completions` with streaming, which Open WebUI (or any client) sees as a single model. Everything else — tools, search, sessions — happens inside.

> **Status:** experimental, built for a home server. **Linux is the primary server platform** (the service installs with a single command or an interactive wizard — see "Run it as a service" below). **Windows** has a native desktop build: the same `cloudling.exe` lives as a system-tray app (double-click → background serve+UI, no Docker or WSL), tested on Windows 11 — see [`docs/windows-install-release.md`](./docs/windows-install-release.md). **macOS** has an experimental desktop build (menu-bar app, `.dmg`/`.app`, launchd installer); it requires **Apple Silicon and macOS 11+**, is CI-built but not yet verified on real hardware, and ships as pre-release artifacts only — see [`docs/macos.md`](./docs/macos.md). Agentic quality depends on the model's tool-calling ability — open models vary; compatibility notes live in [`docs/MODEL_COMPATIBILITY.md`](./docs/MODEL_COMPATIBILITY.md). Built for a single user on a trusted (home) network: the `/v1` chat endpoint is unauthenticated — don't expose it to the internet without an external auth layer.

### What's inside

- **Tools and an agent loop** — the model runs multi-step tasks via built-in tools instead of only replying.
- **Built-in web search** — queries a configurable JSON backend (e.g. a self-hosted SearXNG) via `CLAWD_WEB_SEARCH_BASE_URL`; falls back to scraping DuckDuckGo/HTML when unset (less reliable).
- **MCP servers** — external tool programs plug in with a couple of config lines (`mcpServers` in `settings.json`, or Settings → Tools in the built-in UI) and show up to the model as `mcp__<server>__<tool>`; connections are kept in a warm pool and config changes apply without a restart. See [`docs/web-ui.md`](./docs/web-ui.md).
- **Context management** — the built-in UI detects the model's context window (llama.cpp/vLLM/Ollama), shows a "used / window (%)" gauge, and compacts long history into a model-written summary before it overflows; a server-side auto-compaction safety net covers external clients.
- **Clean tool calls in Open WebUI** — tool calls render as collapsible details, not raw text.
- **Chat-friendly sessions** — ephemeral: the frontend owns history and resends it in full on every request (`messages[]`), and cloudling rebuilds the session per request. No history leaks between chats.
- **Stable model name** — the frontend sees a constant id (e.g. `cloudling`) while the real provider model stays internal and swappable.
- **Isolation** — the live service runs in a neutral workdir and won't pull `CLAUDE.md`, git status, or project settings into ordinary chats.
- **Built-in web UI (optional)** — with the `--ui` flag the same binary serves a chat page on the same port: streaming, collapsible tool calls, markdown, image attachments, interactive model questions (the AskUserQuestion tool renders clickable options in the chat and the choice flows back to the model), and server-side storage of dialogs/presets/settings. Headless by default — the UI never gets in the API's way. See [`docs/web-ui.md`](./docs/web-ui.md).
- **Native Windows desktop app (optional)** — the same `cloudling.exe` can run as a system-tray app: double-click → background serve+UI with no console window; tray menu to open it in the browser, toggle start-at-login, or uninstall; no Docker or WSL. In a terminal `cloudling` stays a normal CLI/REPL. See [`docs/windows-install-release.md`](./docs/windows-install-release.md).
- **Linux desktop app (optional)** — a `.deb` package: double-click → graphical installer (App Center / gdebi, no terminal) → "Cloudling" appears in the apps menu → click to launch: background serve+UI and a tray icon (open in browser / start at login / uninstall). The binary is statically linked (musl) — it runs on any distribution, with no glibc-version matching. Uninstall via the App Center or `apt remove`; `cloudling uninstall` (or the "Uninstall" menu item) removes user data. (The tray icon shows on KDE and on GNOME with the AppIndicator extension that Ubuntu ships by default.)
- **macOS desktop app (experimental)** — the same `cloudling` runs as a menu-bar app via a `.dmg`/`.app` bundle (drag to Applications → menu-bar icon: open in browser / start at login / uninstall), with a launchd installer for the headless server. Requires **Apple Silicon and macOS 11.0 (Big Sur) or later** — the prebuilt build is arm64-only and the bundle declares `LSMinimumSystemVersion 11.0` (Intel / older macOS is build-from-source only). Built on Apple Silicon by CI but **not yet verified on real hardware**, so the macOS binary/`.dmg` are published as pre-release artifacts only. See [`docs/macos.md`](./docs/macos.md).

### Quick start

Two paths: grab a **prebuilt binary** (fast, no Rust) or **build from source**.

**Prebuilt binary (no Rust).** Easiest — let the installer fetch the right release asset:

```bash
./install.sh --prebuilt              # needs gh or curl
# pin a version: ./install.sh --prebuilt-tag vX.Y.Z
```

Or manually: download `cloudling-linux-x64` from the Releases page, make it executable, and check it runs:

```bash
chmod +x cloudling-linux-x64
./cloudling-linux-x64 --version
```

The binary is statically linked (musl) — it runs on any distribution, with no glibc-version matching. For Windows, grab the `cloudling-windows-x64.exe` asset (see [`docs/windows-install-release.md`](./docs/windows-install-release.md)); for a no-terminal Linux desktop, the `.deb` below. Then set up the service ("Run it as a service").

**Build from source.** The `install.sh` installer detects your OS, checks the Rust toolchain and system dependencies (C compiler, OpenSSL, pkg-config), and — if system packages are missing — shows the command and offers to install them (`y/n`):

```bash
git clone https://github.com/striker9272/cloudling
cd cloudling
./install.sh --release
```

The binary lands in `rust/target/release/cloudling` (`.exe` on Windows); the installer also runs `cloudling --version` for you. Next, set up the service — see "Run it as a service" below (backend and key are configured there, in one place). CLI commands (`cloudling doctor`, `cloudling prompt`), providers, sessions, and Windows/PowerShell notes are in [`USAGE.md`](./USAGE.md) and [`docs/`](./docs).

> A manual build (`cd rust && cargo build --release -p cloudling-cli`) also works but **does not check dependencies** — use it only if your environment is already set up.

> **No-terminal desktop (Linux).** Download `cloudling_*_amd64.deb` from a release and open it with a double-click — it installs via the graphical App Center (or, if you prefer the terminal, `sudo apt install ./cloudling_*_amd64.deb`). Then launch "Cloudling" from the apps menu: it starts the background serve+UI, shows a tray icon (open / start at login / uninstall), and opens the browser for you. Configure the backend in the browser on first run.

### Run it as a service

The main use case. If you installed via `./install.sh --release`, it offers to set up the service at the end — answer `y` and the installer places the binary and runs the wizard (one command from nothing to a running service).

**Before you start, you need:**

- a running OpenAI-compatible backend with a model (Ollama / llama.cpp / vLLM / cloud), reachable over the network;
- Open WebUI (or any OpenAI client) to talk to cloudling.

You can also run the installer separately — `install-openai-service.sh` drops into its interactive wizard when run with no flags on a terminal (`install.sh` places the binary; for a manual build, place it first: `sudo install -D -m 755 rust/target/release/cloudling /opt/cloudling/bin/cloudling`):

```bash
cd rust
bash scripts/install-openai-service.sh
```

Or in one non-interactive command:

```bash
cd rust
scripts/install-openai-service.sh \
  --base-url http://127.0.0.1:8000/v1 \
  --backend-model <backend-model> \
  --served-model-id cloudling \
  --enable --restart
```

(if your backend needs a key, add `--api-key sk-...`). Everything else (service `cloudling.service`, user, paths `/opt/cloudling`, `/etc/cloudling`, `/var/lib/cloudling`, bind `127.0.0.1:4097`, permission mode `read-only`) is defaulted and overridable via flags.

> **Re-running is safe.** You can re-run the installer on an already-configured service: the current values from the env file (engine, bind, served-id, permission mode, key, UI token) are preserved — pass a flag only for what you want to change.

The wizard asks for:

| Value | What it is / where to get it |
|---|---|
| **Backend URL** (`--base-url`) | Your OpenAI-compatible backend's address. Ollama → `http://localhost:11434/v1`, llama.cpp → `http://localhost:8080/v1`, vLLM → `http://localhost:8000/v1`, cloud → the provider's URL. |
| **Backend model** (`--backend-model`) | The model id your backend knows it by. From its model list: `ollama list`, the model you loaded in vLLM/llama.cpp, or a cloud model id (e.g. `gpt-4o-mini`). |
| **API key** (`--api-key`) | Your backend's access key. Local backends (Ollama/llama.cpp) usually need none — leave blank; cloud/remote needs the provider's key. |
| **Served model id** (`--served-model-id`) | A name **you choose** — it shows up in Open WebUI's model list (e.g. `cloudling`). |
| **Permission mode** (`--permission-mode`) | What the agent may do: `read-only` (default) — read only; `workspace-write` — edit/run inside the work dir; `danger-full-access` — full filesystem access (risky for a chat-exposed service). |
| **Web search URL** (`--websearch-url`) | Optional. A JSON search backend (SearXNG) URL: `http://<host>:8888/search?format=json`. If empty, `cloudling` uses a built-in DuckDuckGo fallback (less reliable). |

**Web search (optional but recommended).** Without `CLAWD_WEB_SEARCH_BASE_URL`, search scrapes DuckDuckGo — it works but is unreliable. For real search, run a self-hosted [SearXNG](https://github.com/searxng/searxng), enable its JSON format (`search.formats: [html, json]` in `settings.yml`), and pass `--websearch-url http://<host>:8888/search?format=json` (or set `CLAWD_WEB_SEARCH_BASE_URL` in the env file). `cloudling` appends `&q=<query>` itself.

**Connecting Open WebUI:** add an OpenAI connection pointing at `http://<host>:4097/v1` — include the `http://` scheme and the `/v1` suffix (host is your bind address; the key can be left blank). Then pick the `cloudling` model (or your `served-model-id`). Permission mode can later be changed in `CLAW_PERMISSION_MODE` (`/etc/cloudling/openai.env`) followed by a service restart.

**Built-in web UI (optional).** Besides the API, `cloudling` can serve a chat page itself. The easiest path: during setup the wizard first asks — "built-in web UI or classic API". Pick the UI and it **skips the backend questions** (you set the model and URL in the browser), generates an access token, and prints the page address at the end. Open it, land on the first-run setup screen, point it at your engine, save — the core restarts and you're ready. To set up the whole UI mode non-interactively, everything after `--` is forwarded to the service installer: `./install.sh --release -- --ui --bind 0.0.0.0:4097 --enable --restart`. Under the hood this is `cloudling openai-serve --ui` plus `CLOUDLING_UI_TOKEN` (Bearer token for the `/ui/*` data endpoints; off-loopback they are disabled without it), `CLOUDLING_UI_DATA_DIR` (dialog/preset storage; default `$HOME/.claw/ui`), `CLOUDLING_OPENAI_ENV_FILE` (so the UI can save "General" settings and restart the core). The service is headless (API only) by default. Full guide and auth model — [`docs/web-ui.md`](./docs/web-ui.md).

When you only need to rebuild and swap the binary, use the deploy helper — it stages checks, backs up, installs atomically, restarts, and prints a rollback command:

```bash
cd rust
scripts/deploy-openai-server.sh \
  --runtime-bin /opt/cloudling/bin/cloudling \
  --service cloudling.service \
  --health-url http://127.0.0.1:4097/health
```

To remove the service, use the counterpart command `uninstall.sh` (removes the unit, wrapper, env, binary, plus the work/sandbox dirs, the UI data (dialogs/presets), and backups; `--keep-data` keeps the data, `--dry-run` shows the plan, `--yes` skips prompts):

```bash
./uninstall.sh
```

**Which script when:** `install.sh` — entry point (build the binary + optionally set up the service); `rust/scripts/install-openai-service.sh` — the service install engine (interactive with no flags, non-interactive with flags); `rust/scripts/deploy-openai-server.sh` — rebuild and swap the binary on an already-running service; `uninstall.sh` — remove everything.

### Repository layout

- **`rust/`** — the Rust workspace and the `cloudling` CLI + server binary (the canonical implementation)
- **`USAGE.md`** — build, auth, CLI, sessions, providers
- **`docs/`** — Windows install, macOS install, local OpenAI-compatible providers, file-context, containers, the built-in web UI

### Credits

Cloudling is a fork of **[Claw Code](https://github.com/ultraworkers/claw-code)** by UltraWorkers, used under the MIT License. The upstream project is the origin of the agent core; Cloudling does not claim ownership of that original work and retains the upstream copyright and license in [`LICENSE`](./LICENSE).
