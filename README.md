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
  <a href="./ROADMAP.md">Roadmap</a>
  ·
  <a href="./CONTRIBUTING.md">Contributing</a>
  ·
  <a href="./SECURITY.md">Security</a>
</p>

<p align="center"><b>Русский</b> · <a href="#english">English</a></p>

---

## Русский

**Claw Lab — агентная прослойка между твоей моделью и твоим чатом.** Подключаешь бэкенд (любой OpenAI-совместимый: Ollama, llama.cpp, vLLM, облако), указываешь куда отдавать — и в твоём чате появляется та же модель, но «с руками»: с инструментами, веб-поиском и нормальным агентным воркфлоу.

```
   твоя модель                    Claw Lab                      твой чат
 ┌─────────────────┐      ┌────────────────────────┐      ┌──────────────────┐
 │ Ollama          │      │ инструменты             │      │ Open WebUI       │
 │ llama.cpp       │  ──▶ │ веб-поиск               │  ──▶ │ или любой         │
 │ vLLM / облако   │      │ агентный воркфлоу       │      │ OpenAI-клиент    │
 └─────────────────┘      │ (отдаёт как OpenAI API) │      └──────────────────┘
                          └────────────────────────┘
```

### Зачем это

Локальная модель в Open WebUI умеет, по сути, только разговаривать. Claw Lab встаёт посередине и даёт ей руки — инструменты, поиск, многошаговый агентный цикл — **не меняя ни твой бэкенд, ни твой интерфейс**. Снаружи во фронте это выглядит как обычная модель в списке: выбрал — и общаешься, только она теперь умеет действовать, а не просто отвечать.

От оригинального [Claw Code](#благодарности) (это агент для кодинга в терминале) Claw Lab отличается фокусом: здесь главное — не CLI, а вот эта прослойка «модель → агент → чат» для самостоятельного хостинга на домашнем сервере.

### Как это работает

По задумке нужно всего две вещи:

1. **Куда ходить за моделью** — адрес и ключ твоего OpenAI-совместимого бэкенда (локального или внешнего).
2. **Куда отдавать результат** — на каком адресе поднять OpenAI-совместимый эндпоинт, который увидит твой чат.

На выходе Claw Lab поднимает `/v1/chat/completions` со стримингом, который Open WebUI (или другой клиент) видит как одну модель. Всё остальное — инструменты, поиск, сессии — уже внутри.

> **Статус:** проект экспериментальный, для домашнего сервера. Сейчас сервис настраивается установщиком (несколько флагов, см. ниже); запуск «одной строкой — только бэкенд и вывод» — в планах.

### Что внутри

- **Инструменты и агентный цикл** — модель не просто отвечает, а выполняет многошаговые задачи через встроенные инструменты.
- **Встроенный веб-поиск** — разбирает JSON-результаты со сниппетами, с откатом на DuckDuckGo/HTML.
- **Аккуратные tool-call'ы в Open WebUI** — вызовы инструментов показываются как сворачиваемые детали, а не как сырой текст в ответе.
- **Сессии под чат** — по умолчанию эфемерные (историю держит фронт через `messages[]`); персистентность включается заголовком `X-Claw-Session-Key`.
- **Стабильное имя модели** — фронт видит постоянный id (например `clab-agent`), а реальная модель провайдера остаётся внутренней и заменяемой.
- **Изоляция** — живой сервис работает в нейтральной директории и не тянет в обычные чаты `CLAUDE.md`, git-статус и настройки проекта.

### Быстрый старт

Собери из исходников (репозиторий — только build-from-source):

```bash
git clone https://github.com/striker9272/claw-lab
cd claw-lab/rust
cargo build --workspace

export ANTHROPIC_API_KEY="sk-ant-..."   # или OpenAI-совместимый ключ (локальный или внешний)

./target/debug/clab doctor              # проверка авторизации, моделей, инструментов
./target/debug/clab prompt "say hello"
```

`clab doctor` — первая проверка работоспособности. Бинарник появится в `rust/target/debug/clab` (или в `release/` при `--release`; `.exe` на Windows). PATH, заметки по Windows/PowerShell, сессии, провайдеры и полный CLI — см. [`USAGE.md`](./USAGE.md) и [`docs/`](./docs).

> **Авторизация:** `clab` требует API-ключ (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …) — вход по подписке Claude не поддерживается.

### Запуск как сервиса

Основной сценарий. Один раз установи сервис переносимым установщиком:

```bash
cd rust
scripts/install-openai-service.sh \
  --service clab-openai.service \
  --runtime-bin /opt/clab/bin/clab \
  --env-file /etc/clab/openai.env \
  --workdir /var/lib/clab/work \
  --bind 127.0.0.1:4097 \
  --base-url http://127.0.0.1:8000/v1 \
  --served-model-id clab-agent \
  --backend-model clab-external-api \
  --permission-mode read-only \
  --enable --restart
```

Здесь `--base-url`/`--backend-model` — это твой бэкенд (откуда брать модель), а `--bind`/`--served-model-id` — что увидит фронт. Установщик создаёт env-файл, wrapper и systemd-юнит и держит сервис в нейтральной директории. Направь Open WebUI на адрес из `--bind` и выбери served-модель.

Два id модели играют разные роли:

```text
--served-model-id   id, видимый Open WebUI, /health и /v1/models
--backend-model     внутренний id модели OpenAI-совместимого провайдера
```

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
- **`ROADMAP.md`** / **`PHILOSOPHY.md`** — направление и замысел дизайна
- **`docs/`** — Windows, локальные OpenAI-совместимые провайдеры, файловый контекст, контейнеры
- **`src/` + `tests/`** — вспомогательный референс/аудит-воркспейс; не основная среда выполнения

### Благодарности

Claw Lab — форк проекта **[Claw Code](https://github.com/ultraworkers/claw-code)** от UltraWorkers, используется по лицензии MIT. Оригинальный проект — источник ядра агента; Claw Lab не претендует на авторство этой исходной работы и сохраняет копирайт и лицензию оригинала в [`LICENSE`](./LICENSE).

---

## English

**Claw Lab is an agentic layer between your model and your chat.** Connect a backend (any OpenAI-compatible one: Ollama, llama.cpp, vLLM, cloud), tell it where to serve — and the same model shows up in your chat, but *with hands*: tools, web search, and a real agentic workflow.

```
   your model                     Claw Lab                      your chat
 ┌─────────────────┐      ┌────────────────────────┐      ┌──────────────────┐
 │ Ollama          │      │ tools                   │      │ Open WebUI       │
 │ llama.cpp       │  ──▶ │ web search              │  ──▶ │ or any           │
 │ vLLM / cloud    │      │ agentic workflow        │      │ OpenAI client    │
 └─────────────────┘      │ (served as OpenAI API)  │      └──────────────────┘
                          └────────────────────────┘
```

### Why

A local model in Open WebUI can basically only talk. Claw Lab sits in the middle and gives it hands — tools, search, a multi-step agent loop — **without changing your backend or your UI**. To the frontend it looks like a normal model in the list: pick it and chat, except now it can *act*, not just answer.

It differs from the original [Claw Code](#credits) (a terminal coding agent) in focus: the point here isn't the CLI, it's this "model → agent → chat" layer for self-hosting on a home server.

### How it works

By design you only need two things:

1. **Where to reach the model** — the address and key of your OpenAI-compatible backend (local or remote).
2. **Where to serve** — the address to expose an OpenAI-compatible endpoint your chat can see.

Claw Lab then serves `/v1/chat/completions` with streaming, which Open WebUI (or any client) sees as a single model. Everything else — tools, search, sessions — happens inside.

> **Status:** experimental, built for a home server. Today the service is configured via an installer (a few flags, below); a one-command "just backend + output" launch is on the roadmap.

### What's inside

- **Tools and an agent loop** — the model runs multi-step tasks via built-in tools instead of only replying.
- **Built-in web search** — parses JSON results with snippets, with a DuckDuckGo/HTML fallback.
- **Clean tool calls in Open WebUI** — tool calls render as collapsible details, not raw text.
- **Chat-friendly sessions** — ephemeral by default (the frontend owns history via `messages[]`); enable persistence with `X-Claw-Session-Key`.
- **Stable model name** — the frontend sees a constant id (e.g. `clab-agent`) while the real provider model stays internal and swappable.
- **Isolation** — the live service runs in a neutral workdir and won't pull `CLAUDE.md`, git status, or project settings into ordinary chats.

### Quick start

Build from source (this repo is build-from-source only):

```bash
git clone https://github.com/striker9272/claw-lab
cd claw-lab/rust
cargo build --workspace

export ANTHROPIC_API_KEY="sk-ant-..."   # or an OpenAI-compatible key (local or remote)

./target/debug/clab doctor              # verify auth, models, tools
./target/debug/clab prompt "say hello"
```

`clab doctor` is your first health check. The binary lands in `rust/target/debug/clab` (or `release/` with `--release`; `.exe` on Windows). For PATH, Windows/PowerShell notes, sessions, providers, and the full CLI, see [`USAGE.md`](./USAGE.md) and [`docs/`](./docs).

> **Auth:** `clab` needs an API key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …) — a Claude subscription login is not a supported auth path.

### Run it as a service

The main use case. Install the service once with the portable installer:

```bash
cd rust
scripts/install-openai-service.sh \
  --service clab-openai.service \
  --runtime-bin /opt/clab/bin/clab \
  --env-file /etc/clab/openai.env \
  --workdir /var/lib/clab/work \
  --bind 127.0.0.1:4097 \
  --base-url http://127.0.0.1:8000/v1 \
  --served-model-id clab-agent \
  --backend-model clab-external-api \
  --permission-mode read-only \
  --enable --restart
```

Here `--base-url`/`--backend-model` is your backend (where the model comes from), and `--bind`/`--served-model-id` is what the frontend sees. The installer writes the env file, wrapper, and systemd unit, and keeps the service in a neutral workdir. Point Open WebUI at the bind address and select the served model.

The two model ids have separate roles:

```text
--served-model-id   id exposed to Open WebUI, /health, and /v1/models
--backend-model     internal OpenAI-compatible provider model id
```

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
- **`ROADMAP.md`** / **`PHILOSOPHY.md`** — direction and design intent
- **`docs/`** — Windows install, local OpenAI-compatible providers, file-context, containers
- **`src/` + `tests/`** — companion reference/audit workspace; not the primary runtime

### Credits

Claw Lab is a fork of **[Claw Code](https://github.com/ultraworkers/claw-code)** by UltraWorkers, used under the MIT License. The upstream project is the origin of the agent core; Claw Lab does not claim ownership of that original work and retains the upstream copyright and license in [`LICENSE`](./LICENSE).
