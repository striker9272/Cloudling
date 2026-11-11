(function(){
  /* ---------- i18n (built-in UI is bilingual; strings live here, not hardcoded) ----------
     English ships as the default (index.html text + `en` below) so a first-time visitor sees
     English. A chosen language is saved to localStorage and survives reloads; switching just
     persists the choice and reloads, so every view re-renders cleanly in the new language.
     `t(key, vars)` looks up the active language, falls back to English, then to the raw key;
     `{name}`-style placeholders are filled from `vars`. Static index.html chrome is annotated
     with data-i18n* attributes and translated by applyStaticI18n() on load. */
  var I18N = {
    en: {
      'common.copy':'Copy','common.copied':'Copied','common.edit':'Edit','common.regen':'Regenerate',
      'common.retry':'Retry','common.save':'Save','common.cancel':'Cancel','common.delete':'Delete',
      'common.back':'Back','common.remove':'Remove','common.rename':'Rename','common.done':'Done','common.menu':'Actions',
      'nav.dialogs':'Chats','nav.settings':'Settings',
      'dialogs.title':'Chats','dialogs.new':'New chat','dialogs.search':'Search chats…',
      'dialogs.pinned':'Pinned','dialogs.earlier':'Earlier','dialogs.emptyTitle':'No chats yet',
      'dialogs.emptyHint':'Start one with the + button above','dialogs.noResultsTitle':'Nothing found',
      'dialogs.noResultsHint':'Try a different search','dialogs.untitled':'Untitled',
      'settings.title':'Settings','settings.general':'General',
      'settings.engineUrl':'Engine URL','settings.checkConn':'Check connection','settings.apiKey':'API key',
      'settings.model':'Model','settings.servedModel':'Served model name','settings.webSearchUrl':'Web search URL',
      'settings.applyImmediate':'Changes apply immediately — no restart needed.',
      'settings.systemPrompt':'System prompt','settings.chat':'Chat','settings.reasoning':'Model reasoning',
      'settings.reasoningNote':'A collapsible block with the reasoning model’s thinking. Applies from the next message; if the model has no such mode, the block simply won’t appear.',
      'settings.voice':'Voice','settings.ttsUrl':'Speech server URL','settings.ttsKey':'API key','settings.ttsModel':'Model','settings.ttsVoice':'Voice',
      'settings.ttsExtra':'Extra request fields',
      'settings.voiceOut':'Speech output','settings.voiceIn':'Speech input','settings.sttUrl':'Recognition server URL',
      'settings.voiceCall':'Voice dialog','settings.callReasoning':'Model reasoning in a dialog','settings.callBarge':'Interrupt by voice','settings.callLive':'Text while you speak',
      'settings.callNote':'The voice dialog starts from the cloud button at an empty message field (both servers above are needed). <b>Reasoning</b> off — answers start sooner, but are simpler; it is switched off with the standard <b>reasoning_effort: none</b>, which the model server must understand. <b>Interrupt by voice</b> — start talking and the answer stops; with loudspeakers the model may hear itself, then switch this off and use the button. <b>Text while you speak</b> — the phrase is recognised again and again as it grows and shown on the dialog screen; this loads the speech-recognition server more, so switch it off on a weak one.',
      'settings.voiceNote':'Any OpenAI-compatible servers: text-to-speech (<b>/audio/speech</b>) and speech-to-text (<b>/audio/transcriptions</b>). An empty URL turns that side off: no “Speak” under answers, no microphone at the message field. Extra fields: <b>key=value</b> pairs separated by commas, e.g. <b>stream=true, sample_rate=48000</b> or <b>language=ru</b>; if the server rejects them, the request is repeated without them. Browsers give the microphone only over HTTPS or on localhost.',
      'common.speak':'Speak','common.stopSpeak':'Stop speaking',
      'settings.tools':'Tools','settings.mcpServers':'MCP servers',
      'settings.mcpNote':'An MCP server is an external program that gives the model new tools (they appear in chat as <b>mcp__name__*</b>). The stdio transport is supported: the given command runs for the duration of each reply.',
      'settings.mcpAdd':'+ Add server','settings.applyNextMsg':'Applies from the next message — no restart needed.',
      'settings.security':'Security','settings.accessLevel':'Access level','settings.workFolder':'Working folder',
      'settings.workFolderPh':'path to the working folder','settings.pickFolder':'Pick a folder on the server',
      'settings.advanced':'Advanced','settings.trustedRoots':'Additional trusted folders',
      'settings.trustedRootsNote':'Folders outside the working one that the agent may also access (in “Working folder” mode). One path per line.',
      'settings.trustedRootsPh':'e.g. /home/user/shared','settings.toolRules':'Tool access rules',
      'settings.toolRulesNote':'Fine-tuning for advanced users: which tools to always allow or deny. One rule per line.',
      'settings.allow':'Allow','settings.deny':'Deny','settings.rulePh':'One rule per line',
      'settings.saving':'Saving…','settings.saveErrEngine':'Couldn’t save — enter a valid engine URL',
      'settings.serverNoReturn':'The server didn’t come back — check manually','settings.saveErr':'Couldn’t save: {msg}',
      'settings.savedNextMsg':'Saved — applies from the next message',
      'access.read':'Read-only','access.workspace':'Working folder','access.full':'Full access',
      'access.readNote':'The agent reads files and searches the whole computer, but changes nothing and runs no commands.',
      'access.workspaceNote':'The agent reads, edits files and runs commands — only in the working folder (and its own temp scratch). Nothing else is touched.',
      'access.fullNote':'The agent reads, edits and runs anything anywhere on this machine. No restrictions.',
      'home.sub':'A local agent with tools and web search. Describe a task — cloudling answers and reaches for tools when needed.',
      'home.composerPh':'Ask or give a task…','dialog.composerPh':'Reply…',
      'composer.attach':'Attach a file','composer.send':'Send','composer.stop':'Stop',
      'composer.mic':'Dictate','composer.micCancel':'Cancel recording','composer.micDone':'Done',
      'composer.call':'Voice dialog','call.listening':'Listening','call.transcribing':'Transcribing…','call.thinking':'Thinking','call.speaking':'Speaking','call.muted':'Microphone off','call.mutedNote':'Cloudling can’t hear you','call.mute':'Turn the microphone off','call.unmute':'Turn the microphone on','call.showChat':'Show chat','call.expand':'Expand','call.feed':'What Cloudling is doing',
      'call.end':'End','call.endAria':'End the voice dialog','call.tapDone':'I’m done speaking','call.tapStop':'Interrupt','call.err':'Voice dialog: {msg}',
      'mic.speak':'Speak…','mic.busy':'Transcribing…','mic.empty':'Didn’t catch that — nothing was recognised',
      'mic.insecure':'The microphone works only over HTTPS or on localhost','mic.denied':'No access to the microphone — allow it in the browser',
      'mic.unsupported':'This browser cannot record audio','mic.err':'Speech recognition failed: {msg}',
      'composer.scrollDown':'Down','composer.scrollDownAria':'Scroll to bottom',
      'setup.hi':'Hi! This is cloudling',
      'setup.intro':'A local agent with tools and web search. To begin, connect an engine — the model cloudling will talk to.',
      'setup.step1':'Enter the engine URL','setup.step1sub':'— e.g. a local Ollama or llama-server.',
      'setup.step2':'Add a key','setup.step2sub':'— if the engine requires one.',
      'setup.step3':'Check the connection','setup.step3sub':'— and you’re ready to chat.',
      'setup.openSettings':'Open settings','setup.hint':'These live under “General” (the gear on the right).',
      'preset.namePh':'Preset name','preset.promptPh':'Describe how cloudling should behave in this preset…',
      'preset.none':'No preset','preset.new':'+ New preset','preset.unnamed':'Unnamed',
      'preset.applyTitle':'Apply this preset — off means no system prompt is sent',
      'confirm.delTitle':'Delete chat?','confirm.delBody':'“{title}” will be deleted permanently.',
      'token.title':'Access token required',
      'token.text':'The server protects the interface’s service functions with a token. Enter the CLOUDLING_UI_TOKEN value from the service settings file — the browser will remember it.',
      'token.ph':'Token','token.enter':'Enter','token.disabledTitle':'Service functions disabled',
      'token.disabledText':'CLOUDLING_UI_TOKEN is not set on the server and the address is reachable beyond localhost — chats and settings are disabled. Set CLOUDLING_UI_TOKEN in the service settings file and restart it.',
      'token.wrong':'That token didn’t work. Use the CLOUDLING_UI_TOKEN value from the server settings.',
      'token.serverStatus':'The server responded {status}.','token.serverUnreachable':'The server is unreachable.',
      'browse.title':'Folder on this server','browse.pick':'Pick this folder','browse.empty':'No subfolders.',
      'chat.thinking':'cloudling is thinking…','chat.stopped':'Stopped',
      'reason.title':'Reasoning','reason.live':'Reasoning…',
      'tool.done':'done','tool.failed':'failed','tool.noOutput':'(no output)','tool.genericName':'Tool','tool.stopped':'stopped',
      'tasks.title':'Tasks','tasks.done':'Done',
      'ctx.gaugeTitle':'Context: {n} of {total} tokens in the model window','ctx.plainCount':'{n} tok.',
      'ctx.plainTitle':'Context tokens in the last request to the model',
      'compact.header':'[Summary of the earlier conversation · folded {n}, ≈{est} tok.]',
      'compact.banner':'Context compacted · freed ≈{est} tok.','compact.markFallback':'Context folded',
      'compact.reactiveBanner':'Context exceeded the model window — older turns folded · freed ≈{est} tok.',
      'err.noResponseHead':'Couldn’t get a response',
      'err.unreachableHead':'Backend is unreachable','err.authHead':'Backend authentication failed',
      'err.rateHead':'Provider rate limit',
      'err.noEngine':'The engine didn’t respond. Check that the backend is running and the URL is correct.',
      'err.emptyHead':'The model returned no answer',
      'err.emptyBody':'The turn finished with no answer text. Try regenerating.',
      'err.emptyBodyReason':'The turn finished with no answer text (reasoning only). Try regenerating.',
      'err.truncated':'The answer was cut off by the context limit — regenerate to get the full one.',
      'err.saveDialog':'Couldn’t save the chat','err.deleteDialog':'Couldn’t delete the chat',
      'conn.ok':'Connected','conn.fail':'Couldn’t connect',
      'att.tooBig':'File “{name}” is over 10 MB — skipped','att.readFail':'Couldn’t read “{name}”',
      'att.imageName':'image','att.pasteName':'pasted','att.fileFallback':'file','att.attachment':'Attachment','att.noName':'no name',
      'att.imageAbove':'[image “{name}” attached above]','att.fileInline':'File “{name}”:',
      'att.fileNotSent':'[attached file {name}, {size} — contents not sent]',
      'size.b':'B','size.kb':'KB','size.mb':'MB',
      'menu.pin':'Pin','menu.unpin':'Unpin','edit.saveSend':'Save & send',
      'mcp.name':'Server name','mcp.namePh':'e.g. filesystem','mcp.delServer':'Delete server',
      'mcp.newServer':'New server','mcp.enabledTitle':'Enabled — off means the server is not launched and its tools are not loaded into context',
      'mcp.command':'Command','mcp.args':'Arguments — one per line','mcp.framing':'Framing',
      'mcp.framingNewline':'standard MCP (newline)','mcp.framingLegacy':'legacy (content-length)',
      'mcp.timeout':'Call timeout, ms','mcp.empty':'No servers configured.',
      'mcp.errNameCmd':'Every server needs both a name and a command.',
      'mcp.errNameChars':'Server name — letters, digits, hyphen, underscore only: “{name}”',
      'mcp.errNameUniq':'Server names must be unique: “{name}”',
      'ask.questionFallback':'Question','ask.ownPh':'Your own answer…','ask.answer':'Answer','ask.orOwn':'or write your own',
      'title.msg':'Message: {u}','title.answer':'Answer: {a}','code.langFallback':'code'
    },
    ru: {
      'common.copy':'Копировать','common.copied':'Скопировано','common.edit':'Редактировать','common.regen':'Перегенерировать',
      'common.retry':'Повторить','common.save':'Сохранить','common.cancel':'Отмена','common.delete':'Удалить',
      'common.back':'Назад','common.remove':'Убрать','common.rename':'Переименовать','common.done':'Готово','common.menu':'Действия',
      'nav.dialogs':'Диалоги','nav.settings':'Настройки',
      'dialogs.title':'Диалоги','dialogs.new':'Новый чат','dialogs.search':'Поиск диалогов…',
      'dialogs.pinned':'Закреплённые','dialogs.earlier':'Ранее','dialogs.emptyTitle':'Пока нет диалогов',
      'dialogs.emptyHint':'Начни новый — кнопкой + сверху','dialogs.noResultsTitle':'Ничего не найдено',
      'dialogs.noResultsHint':'Попробуй другой запрос','dialogs.untitled':'Без названия',
      'settings.title':'Настройки','settings.general':'Основное',
      'settings.engineUrl':'Адрес движка','settings.checkConn':'Проверить подключение','settings.apiKey':'Ключ API',
      'settings.model':'Модель','settings.servedModel':'Имя модели','settings.webSearchUrl':'Адрес веб-поиска',
      'settings.applyImmediate':'Изменения применяются сразу — перезапуск не нужен.',
      'settings.systemPrompt':'Системный промпт','settings.chat':'Чат','settings.reasoning':'Размышления модели',
      'settings.reasoningNote':'Сворачиваемый блок с рассуждениями reasoning-модели. Применяется со следующего сообщения; если у модели нет этого режима — блока просто не будет.',
      'settings.voice':'Голос','settings.ttsUrl':'Адрес сервера речи','settings.ttsKey':'Ключ API','settings.ttsModel':'Модель','settings.ttsVoice':'Голос',
      'settings.ttsExtra':'Доп. поля запроса',
      'settings.voiceOut':'Озвучка','settings.voiceIn':'Распознавание речи','settings.sttUrl':'Адрес сервера распознавания',
      'settings.voiceCall':'Голосовой диалог','settings.callReasoning':'Размышления модели в диалоге','settings.callBarge':'Перебивание голосом','settings.callLive':'Текст, пока вы говорите',
      'settings.callNote':'Голосовой диалог запускается кнопкой-облаком при пустом поле ввода (нужны оба сервера выше). <b>Размышления</b> выключены — ответ начинается быстрее, но он проще; выключаются стандартным <b>reasoning_effort: none</b>, сервер модели должен его понимать. <b>Перебивание голосом</b> — заговорили, и ответ обрывается; с колонками модель может услышать саму себя, тогда выключите и перебивайте кнопкой. <b>Текст, пока вы говорите</b> — фраза распознаётся снова и снова по мере роста и показывается на экране диалога; сервер распознавания при этом нагружается сильнее, на слабом — выключите.',
      'settings.voiceNote':'Любые OpenAI-совместимые серверы: синтеза речи (<b>/audio/speech</b>) и распознавания (<b>/audio/transcriptions</b>). Пустой адрес выключает свою половину: нет «Озвучить» под ответами, нет микрофона у поля ввода. Доп. поля: пары <b>ключ=значение</b> через запятую, напр. <b>stream=true, sample_rate=48000</b> или <b>language=ru</b>; если сервер их не принимает, запрос повторяется без них. Браузеры дают микрофон только по HTTPS или на localhost.',
      'common.speak':'Озвучить','common.stopSpeak':'Остановить озвучку',
      'settings.tools':'Инструменты','settings.mcpServers':'Серверы MCP',
      'settings.mcpNote':'MCP-сервер — внешняя программа, которая добавляет модели новые инструменты (в чате они видны как <b>mcp__имя__*</b>). Поддерживается транспорт stdio: указанная команда запускается на время каждого ответа.',
      'settings.mcpAdd':'+ Добавить сервер','settings.applyNextMsg':'Применяется со следующего сообщения — перезапуск не нужен.',
      'settings.security':'Безопасность','settings.accessLevel':'Уровень доступа','settings.workFolder':'Рабочая папка',
      'settings.workFolderPh':'путь к рабочей папке','settings.pickFolder':'Выбрать папку на сервере',
      'settings.advanced':'Расширенные','settings.trustedRoots':'Дополнительные доверенные папки',
      'settings.trustedRootsNote':'Папки вне рабочей, к которым агенту тоже разрешён доступ (в режиме «Рабочая папка»). По одному пути на строку.',
      'settings.trustedRootsPh':'например, /home/user/shared','settings.toolRules':'Правила доступа к инструментам',
      'settings.toolRulesNote':'Тонкая настройка для опытных: какие инструменты всегда разрешать или запрещать. По одному правилу на строку.',
      'settings.allow':'Разрешить','settings.deny':'Запретить','settings.rulePh':'По одному правилу на строку',
      'settings.saving':'Сохранение…','settings.saveErrEngine':'Не удалось сохранить — укажи корректный адрес движка',
      'settings.serverNoReturn':'Сервер не вернулся — проверь вручную','settings.saveErr':'Не удалось сохранить: {msg}',
      'settings.savedNextMsg':'Сохранено — применится со следующего сообщения',
      'access.read':'Только чтение','access.workspace':'Рабочая папка','access.full':'Полный доступ',
      'access.readNote':'Агент читает файлы и ищет по всему компьютеру, но ничего не меняет и не выполняет команды.',
      'access.workspaceNote':'Агент читает, меняет файлы и выполняет команды — только в рабочей папке (и своём временном черновике). Остального не касается.',
      'access.fullNote':'Агент читает, меняет и выполняет всё и везде на этой машине. Без ограничений.',
      'home.sub':'Локальный агент с инструментами и веб-поиском. Опиши задачу — cloudling ответит и при необходимости сам сходит в инструменты.',
      'home.composerPh':'Спроси или дай задачу…','dialog.composerPh':'Ответить…',
      'composer.attach':'Прикрепить файл','composer.send':'Отправить','composer.stop':'Остановить',
      'composer.mic':'Диктовать','composer.micCancel':'Отменить запись','composer.micDone':'Готово',
      'composer.call':'Голосовой диалог','call.listening':'Слушаю','call.transcribing':'Распознаю…','call.thinking':'Думаю','call.speaking':'Говорю','call.muted':'Микрофон выключен','call.mutedNote':'Cloudling вас не слышит','call.mute':'Выключить микрофон','call.unmute':'Включить микрофон','call.showChat':'Показать чат','call.expand':'Развернуть','call.feed':'Что делает Cloudling',
      'call.end':'Завершить','call.endAria':'Завершить голосовой диалог','call.tapDone':'Я всё сказал','call.tapStop':'Перебить','call.err':'Голосовой диалог: {msg}',
      'mic.speak':'Говорите…','mic.busy':'Распознаю…','mic.empty':'Не расслышал — ничего не распознано',
      'mic.insecure':'Микрофон доступен только по HTTPS или на localhost','mic.denied':'Нет доступа к микрофону — разрешите его в браузере',
      'mic.unsupported':'Этот браузер не умеет записывать звук','mic.err':'Не удалось распознать: {msg}',
      'composer.scrollDown':'Вниз','composer.scrollDownAria':'Прокрутить вниз',
      'setup.hi':'Привет! Это cloudling',
      'setup.intro':'Локальный агент с инструментами и веб-поиском. Чтобы начать, подключи движок — модель, к которой cloudling будет обращаться.',
      'setup.step1':'Укажи адрес движка','setup.step1sub':'— например, локальный Ollama или llama-server.',
      'setup.step2':'Добавь ключ','setup.step2sub':'— если движок его требует.',
      'setup.step3':'Проверь подключение','setup.step3sub':'— и можно общаться.',
      'setup.openSettings':'Открыть настройки','setup.hint':'Эти настройки — в разделе «Основное» (шестерёнка справа).',
      'preset.namePh':'Имя пресета','preset.promptPh':'Опиши, как cloudling должен себя вести в этом пресете…',
      'preset.none':'Без пресета','preset.new':'+ Новый пресет','preset.unnamed':'Без имени',
      'preset.applyTitle':'Применить этот пресет — «выкл» значит система идёт без системного промпта',
      'confirm.delTitle':'Удалить диалог?','confirm.delBody':'«{title}» будет удалён без возможности восстановления.',
      'token.title':'Нужен токен доступа',
      'token.text':'Сервер защищает служебные функции интерфейса токеном. Введи значение CLOUDLING_UI_TOKEN из файла настроек сервиса — браузер запомнит его.',
      'token.ph':'Токен','token.enter':'Войти','token.disabledTitle':'Служебные функции отключены',
      'token.disabledText':'На сервере не задан CLOUDLING_UI_TOKEN, а адрес доступен не только с localhost — диалоги и настройки отключены. Задай CLOUDLING_UI_TOKEN в файле настроек сервиса и перезапусти его.',
      'token.wrong':'Токен не подошёл. Нужно значение CLOUDLING_UI_TOKEN из настроек сервера.',
      'token.serverStatus':'Сервер ответил {status}.','token.serverUnreachable':'Сервер недоступен.',
      'browse.title':'Папка на этом сервере','browse.pick':'Выбрать эту папку','browse.empty':'Вложенных папок нет.',
      'chat.thinking':'cloudling думает…','chat.stopped':'Остановлено',
      'reason.title':'Размышление','reason.live':'Размышление…',
      'tool.done':'выполнено','tool.failed':'ошибка','tool.noOutput':'(нет вывода)','tool.genericName':'Инструмент','tool.stopped':'остановлено',
      'tasks.title':'Задачи','tasks.done':'Готово',
      'ctx.gaugeTitle':'Контекст: {n} из {total} токенов окна модели','ctx.plainCount':'{n} ток.',
      'ctx.plainTitle':'Токенов контекста в последнем запросе к модели',
      'compact.header':'[Сводка предыдущей части диалога · свёрнуто {n}, ≈{est} ток.]',
      'compact.banner':'Контекст сжат · освобождено ≈{est} ток.','compact.markFallback':'Контекст свёрнут',
      'compact.reactiveBanner':'Контекст переполнил окно модели — старые ходы свёрнуты · освобождено ≈{est} ток.',
      'err.noResponseHead':'Не удалось получить ответ',
      'err.unreachableHead':'Бэкенд недоступен','err.authHead':'Бэкенд отверг авторизацию',
      'err.rateHead':'Провайдер ограничил запросы (rate limit)',
      'err.noEngine':'Движок не ответил. Проверь, что бэкенд запущен и адрес указан верно.',
      'err.emptyHead':'Модель не вернула ответ',
      'err.emptyBody':'Ход завершился без текста ответа. Попробуйте перегенерировать.',
      'err.emptyBodyReason':'Ход завершился без текста ответа (только рассуждение). Попробуйте перегенерировать.',
      'err.truncated':'Ответ оборван по лимиту контекста — перегенерируйте, чтобы получить полный.',
      'err.saveDialog':'Не удалось сохранить диалог','err.deleteDialog':'Не удалось удалить диалог',
      'conn.ok':'Подключено','conn.fail':'Не удалось подключиться',
      'att.tooBig':'Файл «{name}» больше 10 МБ — пропущен','att.readFail':'Не удалось прочитать «{name}»',
      'att.imageName':'изображение','att.pasteName':'вставка','att.fileFallback':'файл','att.attachment':'Вложение','att.noName':'без имени',
      'att.imageAbove':'[изображение «{name}» приложено выше]','att.fileInline':'Файл «{name}»:',
      'att.fileNotSent':'[вложен файл {name}, {size} — содержимое не передаётся]',
      'size.b':'Б','size.kb':'КБ','size.mb':'МБ',
      'menu.pin':'Закрепить','menu.unpin':'Открепить','edit.saveSend':'Сохранить и отправить',
      'mcp.name':'Имя сервера','mcp.namePh':'например, filesystem','mcp.delServer':'Удалить сервер',
      'mcp.newServer':'Новый сервер','mcp.enabledTitle':'Включён — «выкл» значит сервер не запускается и его инструменты не грузятся в контекст',
      'mcp.command':'Команда','mcp.args':'Аргументы — по одному на строку','mcp.framing':'Фрейминг',
      'mcp.framingNewline':'стандартный MCP (newline)','mcp.framingLegacy':'legacy (content-length)',
      'mcp.timeout':'Таймаут вызова, мс','mcp.empty':'Серверы не настроены.',
      'mcp.errNameCmd':'У каждого сервера должны быть и имя, и команда.',
      'mcp.errNameChars':'Имя сервера — только латиница, цифры, дефис, подчёркивание: «{name}»',
      'mcp.errNameUniq':'Имена серверов должны быть уникальны: «{name}»',
      'ask.questionFallback':'Вопрос','ask.ownPh':'Свой ответ…','ask.answer':'Ответить','ask.orOwn':'или впишите свой',
      'title.msg':'Сообщение: {u}','title.answer':'Ответ: {a}','code.langFallback':'код'
    }
  };
  function resolveLang(){ var l=null; try{ l=localStorage.getItem('cloudling_lang'); }catch(e){}
    return (l==='ru'||l==='en') ? l : 'en'; } /* first run → English (broad audience) */
  var LANG=resolveLang();
  var LOCALE=(LANG==='ru')?'ru-RU':'en-US';
  function t(key, vars){
    var s=(I18N[LANG] && I18N[LANG][key]);
    if(s==null) s=(I18N.en[key]!=null ? I18N.en[key] : key);
    if(vars) s=s.replace(/\{(\w+)\}/g, function(m,k){ return (vars[k]!=null) ? vars[k] : m; });
    return s;
  }
  /* translate the static index.html chrome: text nodes (data-i18n), innerHTML (data-i18n-html),
     and placeholder/title/aria-label attributes. Runs once on load; a language switch reloads. */
  function applyStaticI18n(){
    document.querySelectorAll('[data-i18n]').forEach(function(el){ el.textContent=t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-html]').forEach(function(el){ el.innerHTML=t(el.getAttribute('data-i18n-html')); });
    document.querySelectorAll('[data-i18n-ph]').forEach(function(el){ el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
    document.querySelectorAll('[data-i18n-title]').forEach(function(el){ el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function(el){ el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    document.documentElement.lang=LANG;
  }
  /* language selector (settings): reflect the active choice, and on change persist + reload so
     the whole UI re-renders in the new language (state is reloaded from the server anyway). */
  function initLangPicker(){
    var seg=document.getElementById('langPick'); if(!seg) return;
    seg.querySelectorAll('button').forEach(function(btn){
      var l=(btn.getAttribute('data-lang')==='ru')?'ru':'en';
      btn.classList.toggle('on', l===LANG);
      btn.addEventListener('click', function(){
        if(l===LANG) return;
        try{ localStorage.setItem('cloudling_lang', l); }catch(e){}
        location.reload();
      });
    });
  }
  applyStaticI18n(); /* translate static chrome before the splash fades (no flash for a saved ru) */
  initLangPicker();

  /* ---------- icons / loaders ---------- */
  var IC={
    copy:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    regen:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
    up:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11"/><path d="M7 10l4-7a2 2 0 0 1 2 2v4h5.4a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 17.1 21H7"/></svg>',
    down:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V3"/><path d="M17 14l-4 7a2 2 0 0 1-2-2v-4H5.6a2 2 0 0 1-2-2.3l1.3-7A2 2 0 0 1 6.9 3H17"/></svg>',
    edit:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    pin:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 6 3 3v1H7v-1l3-3z"/><path d="M12 17v4"/></svg>',
    trash:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M7 7l1 13h8l1-13"/><path d="M9 7V4h6v3"/></svg>',
    check:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    send:'<svg width="22" height="22" viewBox="0 0 24 24" style="overflow:visible"><path fill="#16161a" stroke="#16161a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M12 6.4 L19.2 15.2 L12 13.9 L4.8 15.2 Z"/><path fill="none" stroke="#16161a" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" d="M10 19.6 H14"/></svg>',
    speak:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
    stopSpeak:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    /* the voice-dialog button: the same living cloud as the splash and «thinking» (drops fused by
       the `goo` filter), at rest — gathered and barely breathing (motion in app.css, `.callcloud`) */
    callCloud:'<svg class="callcloud" viewBox="0 0 40 28" width="30" height="21" aria-hidden="true"><g filter="url(#goo)"><circle cx="20" cy="14" r="6"/><circle class="x1" cx="20" cy="14" r="5"/><circle class="x2" cx="20" cy="14" r="5"/><circle class="x3" cx="20" cy="14" r="5"/></g></svg>',
    callDone:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    callMic:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>',
    callMicOff:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/><path d="M4 3l16 18"/></svg>',
    warn:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 4l-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z"/></svg>',
    doc:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>'
  };
  function cloud(w){ var h=Math.round(w*0.7); return '<svg class="cloud" viewBox="0 0 40 28" width="'+w+'" height="'+h+'"><g filter="url(#goo)"><circle cx="20" cy="14" r="6"/><circle class="x1" cx="20" cy="14" r="5"/><circle class="x2" cx="20" cy="14" r="5"/><circle class="x3" cx="20" cy="14" r="4"/></g></svg>'; }
  var RIP='<span class="rip"><span></span><span></span></span>';
  var SKELETON='<div class="sk"><div class="b bub" style="animation-delay:0s"></div><div class="b line l1" style="animation-delay:.2s"></div><div class="b line l2" style="animation-delay:.5s"></div><div class="b code" style="animation-delay:.8s"></div><div class="b line l3" style="animation-delay:1.1s"></div></div>';

  /* ---------- splash ---------- */
  setTimeout(function(){ document.getElementById('splash').classList.add('hide'); }, 1500);

  /* ---------- sidebars ---------- */
  var b=document.body, tabL=document.getElementById('tabL'), tabR=document.getElementById('tabR');
  function closeDrawers(){b.classList.remove('open-left','open-right'); tabL.textContent='☰'; tabR.textContent='⚙';}
  tabL.onclick=function(){ if(b.classList.contains('open-left')){closeDrawers();} else {b.classList.remove('open-right'); b.classList.add('open-left'); tabL.textContent='×'; tabR.textContent='⚙';} };
  tabR.onclick=function(){ if(b.classList.contains('open-right')){closeDrawers();} else {b.classList.remove('open-left'); b.classList.add('open-right'); tabR.textContent='×'; tabL.textContent='☰';} };
  document.getElementById('scrim').onclick=closeDrawers;

  /* ---------- markdown ---------- */
  var EMOJI={smile:'😊',fire:'🔥',rocket:'🚀',check:'✅',bulb:'💡',warning:'⚠️',tada:'🎉',thumbsup:'👍',eyes:'👀',sparkles:'✨'};
  function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  /* ---- lightweight LaTeX → Unicode (no math engine) ----
     The built-in chat has no KaTeX, so models that emit inline LaTeX (`$\leftrightarrow$`)
     used to show raw. We map common commands to Unicode and strip the `$` delimiters.
     Only spans that look like math (contain a backslash, ^ or _) are touched, so plain
     `$5` / `$PATH` are left alone. Complex formulas degrade gracefully to text. */
  var MATHMAP={'\\leftrightarrow':'↔','\\Leftrightarrow':'⇔','\\rightarrow':'→','\\Rightarrow':'⇒','\\to':'→','\\mapsto':'↦','\\leftarrow':'←','\\Leftarrow':'⇐','\\uparrow':'↑','\\downarrow':'↓',
    '\\times':'×','\\cdot':'·','\\div':'÷','\\pm':'±','\\mp':'∓','\\ast':'∗','\\star':'⋆','\\circ':'∘','\\bullet':'•',
    '\\leq':'≤','\\le':'≤','\\geq':'≥','\\ge':'≥','\\neq':'≠','\\ne':'≠','\\approx':'≈','\\equiv':'≡','\\sim':'∼','\\simeq':'≃','\\cong':'≅','\\propto':'∝','\\ll':'≪','\\gg':'≫',
    '\\infty':'∞','\\partial':'∂','\\nabla':'∇','\\sum':'∑','\\prod':'∏','\\int':'∫','\\sqrt':'√','\\angle':'∠','\\perp':'⊥','\\parallel':'∥','\\degree':'°',
    '\\forall':'∀','\\exists':'∃','\\nexists':'∄','\\in':'∈','\\notin':'∉','\\subset':'⊂','\\subseteq':'⊆','\\supset':'⊃','\\supseteq':'⊇','\\cup':'∪','\\cap':'∩','\\emptyset':'∅','\\setminus':'∖',
    '\\land':'∧','\\lor':'∨','\\lnot':'¬','\\neg':'¬','\\oplus':'⊕','\\otimes':'⊗','\\ldots':'…','\\dots':'…','\\cdots':'⋯','\\langle':'⟨','\\rangle':'⟩',
    '\\alpha':'α','\\beta':'β','\\gamma':'γ','\\delta':'δ','\\epsilon':'ε','\\varepsilon':'ε','\\zeta':'ζ','\\eta':'η','\\theta':'θ','\\vartheta':'ϑ','\\iota':'ι','\\kappa':'κ','\\lambda':'λ','\\mu':'μ','\\nu':'ν','\\xi':'ξ','\\pi':'π','\\rho':'ρ','\\sigma':'σ','\\tau':'τ','\\upsilon':'υ','\\phi':'φ','\\varphi':'φ','\\chi':'χ','\\psi':'ψ','\\omega':'ω',
    '\\Gamma':'Γ','\\Delta':'Δ','\\Theta':'Θ','\\Lambda':'Λ','\\Xi':'Ξ','\\Pi':'Π','\\Sigma':'Σ','\\Phi':'Φ','\\Psi':'Ψ','\\Omega':'Ω'};
  var SUP={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','n':'ⁿ','i':'ⁱ'};
  var SUB={'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','n':'ₙ'};
  function renderMath(x){
    x=x.replace(/\\(left|right|big|bigg|Big|Bigg|displaystyle|textstyle|mathrm|mathbf|mathit|mathcal|operatorname|text|mbox)\b\s*/g,'');
    x=x.replace(/\\[a-zA-Z]+/g,function(c){ return (c in MATHMAP)?MATHMAP[c]:c.slice(1); });
    x=x.replace(/\\[,;!: ]/g,' ').replace(/[{}]/g,'');
    x=x.replace(/\^([0-9ni]+)/g,function(_,p){return p.replace(/./g,function(d){return SUP[d]||d;});});
    x=x.replace(/_([0-9n]+)/g,function(_,p){return p.replace(/./g,function(d){return SUB[d]||d;});});
    x=x.replace(/[\^_]/g,'');
    return x.replace(/\s+/g,' ').trim();
  }
  function mathToUnicode(t){
    if(t.indexOf('\\')<0 && t.indexOf('$')<0) return t; /* fast path: nothing math-like */
    t=t.replace(/\\\(([\s\S]+?)\\\)/g,function(_,x){return renderMath(x);});
    t=t.replace(/\\\[([\s\S]+?)\\\]/g,function(_,x){return renderMath(x);});
    t=t.replace(/\$\$([\s\S]+?)\$\$/g,function(m,x){return /[\\^_]/.test(x)?renderMath(x):m;});
    t=t.replace(/\$([^$\n]+?)\$/g,function(m,x){return /[\\^_]/.test(x)?renderMath(x):m;});
    return t;
  }
  function inline(t){ t=esc(t);
    /* protect inline code so math/format rules don't touch its contents */
    var codes=[]; t=t.replace(/`([^`]+)`/g,function(_,c){ codes.push(c); return '\uE000'+(codes.length-1)+'\uE000'; });
    t=t.replace(/:([a-z_]+):/g,function(m,n){return EMOJI[n]||m;});
    t=mathToUnicode(t);
    t=t.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    t=t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g,'$1<em>$2</em>');
    t=t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,function(_,label,url){
      /* only allow safe schemes; neutralize javascript:/data:/vbscript: etc. */
      var ok=/^(https?:|mailto:|\/|#)/i.test(url.trim());
      /* esc() already neutralized &<>, but not quotes — escape them so a crafted URL
         (e.g. https://x" onmouseover="…) can't break out of the href attribute */
      var href=url.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      return ok ? '<a href="'+href+'" target="_blank" rel="noopener">'+label+'</a>'
                : '<a>'+label+'</a>';
    });
    t=t.replace(/\uE000(\d+)\uE000/g,function(_,i){ return '<code>'+codes[+i]+'</code>'; });
    return t;
  }
  function codeBlock(lang,code){ return '<div class="code"><div class="chead"><span class="lang">'+(lang||t('code.langFallback'))+'</span><button class="copy" type="button">'+IC.copy+'<span>'+t('common.copy')+'</span></button></div><pre>'+esc(code)+'</pre></div>'; }
  function md(src){
    var fences=[]; src=src.replace(/```(\w*)\n([\s\S]*?)```/g,function(_,l,c){fences.push([l,c.replace(/\n$/,'')]);return ' F'+(fences.length-1)+' ';});
    var L=src.split('\n'), out=[], i=0;
    while(i<L.length){ var ln=L[i]; var fm=ln.trim().match(/^F(\d+)$/);
      if(fm){out.push(codeBlock(fences[+fm[1]][0],fences[+fm[1]][1]));i++;continue;}
      if(/^#{1,3}\s/.test(ln)){var lv=ln.match(/^#+/)[0].length;out.push('<h'+lv+'>'+inline(ln.replace(/^#+\s/,''))+'</h'+lv+'>');i++;continue;}
      if(/^(---|\*\*\*)\s*$/.test(ln)){out.push('<hr>');i++;continue;}
      if(/^>\s?/.test(ln)){var q=[];while(i<L.length&&/^>\s?/.test(L[i])){q.push(inline(L[i].replace(/^>\s?/,'')));i++;}out.push('<blockquote>'+q.join('<br>')+'</blockquote>');continue;}
      if(/\|/.test(ln)&&i+1<L.length&&/^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(L[i+1])){var cs=function(r){return r.split('|').filter(function(c){return c.trim()!=='';});};var hd=cs(ln).map(function(c){return '<th>'+inline(c.trim())+'</th>';}).join('');i+=2;var rw='';while(i<L.length&&/\|/.test(L[i])&&L[i].trim()){rw+='<tr>'+cs(L[i]).map(function(c){return '<td>'+inline(c.trim())+'</td>';}).join('')+'</tr>';i++;}out.push('<table><thead><tr>'+hd+'</tr></thead><tbody>'+rw+'</tbody></table>');continue;}
      if(/^\s*[-*]\s/.test(ln)){var u=[];while(i<L.length&&/^\s*[-*]\s/.test(L[i])){u.push('<li>'+inline(L[i].replace(/^\s*[-*]\s/,''))+'</li>');i++;}out.push('<ul>'+u.join('')+'</ul>');continue;}
      if(/^\s*\d+\.\s/.test(ln)){var o=[];while(i<L.length&&/^\s*\d+\.\s/.test(L[i])){o.push('<li>'+inline(L[i].replace(/^\s*\d+\.\s/,''))+'</li>');i++;}out.push('<ol>'+o.join('')+'</ol>');continue;}
      if(ln.trim()===''){i++;continue;}
      var p=[];while(i<L.length&&L[i].trim()!==''&&!/^(#{1,3}\s|>|\s*[-*]\s|\s*\d+\.\s|---|\*\*\*| F)/.test(L[i])){p.push(inline(L[i]));i++;}
      out.push('<p>'+p.join(' ')+'</p>');
    }
    return out.join('');
  }

  /* ---------- copy ---------- */
  function flashCopied(btn){ if(!btn) return; var o=btn.innerHTML; btn.innerHTML=IC.check+(btn.querySelector('span')?'<span>'+t('common.copied')+'</span>':''); setTimeout(function(){btn.innerHTML=o;},1100); }
  function fallback(t){var ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(ta);}
  function copyText(t,btn){
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){flashCopied(btn);},function(){fallback(t);flashCopied(btn);});} else {fallback(t);flashCopied(btn);} }
  /* Rich copy: put BOTH text/html (formatted paste into Word/mail/Notion) and text/plain
     (markdown source for plain editors) on the clipboard. navigator.clipboard.write needs a
     secure context (https/localhost) — unavailable on the LAN http bind — so we drive it via a
     `copy`-event override + execCommand, which works on plain http. A throwaway selection is
     required for the copy event to fire in all browsers. Falls back to plain text on failure. */
  function copyRich(html, plain, btn){
    var ok=false;
    function handler(e){ try{ e.clipboardData.setData('text/html', html); e.clipboardData.setData('text/plain', plain); e.preventDefault(); ok=true; }catch(_){} }
    var span=document.createElement('span'); span.textContent=plain||' ';
    span.style.position='fixed'; span.style.left='-9999px'; span.style.whiteSpace='pre';
    document.body.appendChild(span);
    var sel=window.getSelection(), saved=(sel&&sel.rangeCount)?sel.getRangeAt(0):null;
    var range=document.createRange(); range.selectNodeContents(span);
    if(sel){ sel.removeAllRanges(); sel.addRange(range); }
    document.addEventListener('copy', handler);
    try{ document.execCommand('copy'); }catch(_){}
    document.removeEventListener('copy', handler);
    if(sel){ sel.removeAllRanges(); if(saved) sel.addRange(saved); }
    document.body.removeChild(span);
    if(ok){ flashCopied(btn); } else { copyText(plain, btn); }
  }

  /* ---------- transient error toast ---------- */
  var toastTimer=null;
  function toast(msg){
    var el=document.getElementById('toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
    el.textContent=msg; el.classList.add('show');
    if(toastTimer) clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){ el.classList.remove('show'); }, 3200);
  }

  /* ---------- UI auth: /ui/* endpoints are token-gated (CLOUDLING_UI_TOKEN) ----------
     The stored token is attached as Authorization: Bearer to every /ui/* call.
     401 → ask for the token (saved to localStorage, then reload); 403 → the server
     has no token configured on a non-loopback bind: endpoints are off, explain why. */
  var uiToken=null; try{ uiToken=localStorage.getItem('cloudling_ui_token')||null; }catch(e){}
  var tokenGateShown=false;
  function showTokenGate(forbidden){
    if(tokenGateShown) return; tokenGateShown=true;
    var scrim=document.getElementById('tokenScrim'), input=document.getElementById('tokenInput'),
        ok=document.getElementById('tokenOk'), text=document.getElementById('tokenText'),
        title=document.getElementById('tokenTitle');
    if(forbidden){
      title.textContent=t('token.disabledTitle');
      text.textContent=t('token.disabledText');
      input.hidden=true; ok.hidden=true;
    }
    scrim.hidden=false;
    if(!forbidden){
      var err=document.getElementById('tokenErr');
      var fail=function(msg){ ok.disabled=false; err.textContent=msg; err.hidden=false; input.select(); };
      /* verify the token BEFORE saving/reloading: a wrong value must show an error,
         not silently reload into the same modal (endless loop) */
      var submit=function(){ var v=(input.value||'').trim(); if(!v) return;
        ok.disabled=true; err.hidden=true;
        fetch('/ui/dialogs',{headers:{'Authorization':'Bearer '+v}}).then(function(r){
          if(r.status===401){ fail(t('token.wrong')); return; }
          if(!r.ok){ fail(t('token.serverStatus',{status:r.status})); return; }
          var saved=false;
          try{ localStorage.setItem('cloudling_ui_token', v); saved=(localStorage.getItem('cloudling_ui_token')===v); }catch(e){}
          if(saved){ location.reload(); return; }
          /* localStorage blocked (private mode / site-data settings): work with the
             token in memory for this page; it will be asked again after a reload */
          uiToken=v; tokenGateShown=false; scrim.hidden=true;
          refreshSidebar(); loadSettings(); loadModelInfo(); loadDlgToks(); loadDlgErrs(); loadDlgPins(); loadPresets();
        }).catch(function(){ fail(t('token.serverUnreachable')); });
      };
      ok.addEventListener('click', submit);
      input.addEventListener('keydown', function(e){ if(e.key==='Enter') submit(); });
      input.focus();
    }
  }
  function uiFetch(url, opts){
    opts=opts||{}; var h=opts.headers||{};
    if(uiToken) h['Authorization']='Bearer '+uiToken;
    opts.headers=h;
    return fetch(url, opts).then(function(r){
      if(r.status===401) showTokenGate(false);
      else if(r.status===403) showTokenGate(true);
      return r;
    });
  }

  /* ---------- dialog storage (server-backed: GET/PUT/DELETE /ui/dialogs) ---------- */
  var activeId=null;
  function genId(){ return 'd-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8); }
  function dlgApi(method, path, body){
    return uiFetch('/ui/dialogs'+path, {
      method:method,
      headers: body ? {'Content-Type':'application/json'} : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  }
  function apiList(){ return dlgApi('GET','').then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; }); }
  function apiGet(id){ return dlgApi('GET','/'+encodeURIComponent(id)).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }); }
  /* surface save/delete failures (token gate already handles 401/403) instead of swallowing them */
  function apiSave(id,title,messages){ return dlgApi('PUT','/'+encodeURIComponent(id),{title:title,messages:messages}).then(function(r){ if(r&&!r.ok&&r.status!==401&&r.status!==403) toast(t('err.saveDialog')); return r; },function(){ toast(t('err.saveDialog')); }); }
  function apiDelete(id){ return dlgApi('DELETE','/'+encodeURIComponent(id)).then(function(r){ if(r&&!r.ok&&r.status!==401&&r.status!==403) toast(t('err.deleteDialog')); return r; },function(){ toast(t('err.deleteDialog')); }); }

  var viewHome=document.getElementById('view-home');
  var viewDlg=document.getElementById('view-dialog');
  var thread=document.getElementById('thread');
  var dtitle=document.getElementById('dlg-title');
  var leftDrawer=document.querySelector('.drawer.left');

  /* thread scroll: own area + autoscroll-if-at-bottom + scroll-down button */
  var stick=true, scrollDown=document.getElementById('scrollDown');
  function atBottom(){ return thread.scrollHeight - thread.scrollTop - thread.clientHeight < 60; }
  function toBottom(){ thread.scrollTop = thread.scrollHeight; }
  function updateScrollBtn(){ scrollDown.classList.toggle('show', !atBottom()); }
  function maybeScroll(){ if(stick) toBottom(); updateScrollBtn(); }
  thread.addEventListener('scroll', function(){ stick=atBottom(); updateScrollBtn(); });
  scrollDown.addEventListener('click', function(){ stick=true; toBottom(); updateScrollBtn(); });
  var activeItem=null, generating=false, genTimers=[], skelToken=0;
  var configured = location.search.indexOf('firstrun')===-1;

  function actBtn(act,label){return '<button class="act" data-act="'+act+'" title="'+label+'" aria-label="'+label+'">'+IC[act]+'</button>';}
  /* user turn: `msg` is a string (text-only) or a convo entry {content:text, atts:[…]} */
  function userTurn(msg){ var el=document.createElement('div'); el.className='turn u';
    var text=(typeof msg==='string')?msg:((msg&&msg.content)||'');
    var atts=(msg&&typeof msg==='object'&&msg.atts)?msg.atts:[];
    var inner=(text?esc(text):'')+(atts.length?'<div class="att-row">'+atts.map(attChipHTML).join('')+'</div>':'');
    el.innerHTML='<div class="bubble">'+inner+'</div><div class="row-acts">'+actBtn('copy',t('common.copy'))+actBtn('edit',t('common.edit'))+'</div>'; return el; }
  /* stored assistant message → turn (content may carry inline tool-call <details>) */
  function assistantTurnEl(content){
    var el=document.createElement('div'); el.className='turn a';
    paintTurn(el, content||'', false);
    el.insertAdjacentHTML('beforeend','<div class="row-acts">'+actBtn('copy',t('common.copy'))+actBtn('speak',t('common.speak'))+actBtn('regen',t('common.regen'))+'</div>');
    return el;
  }
  /* context-token counter: prompt_tokens from the final usage chunk = size of the context
     the model received last turn. Cleared on dialog switch (no usage for stored history). */
  var dlgToks={}; /* last context-token count per dialog id, so the counter survives chat switches */
  /* persisted server-side as one ui_kv JSON map, so the counter also survives page reloads */
  var dlgToksTimer=null;
  function loadDlgToks(){ pFetchJSON('/ui/kv/dlg_toks').then(function(d){
    if(!d||!d.value) return;
    try{ var m=JSON.parse(d.value); if(m&&typeof m==='object'){ Object.keys(m).forEach(function(k){ if(!(k in dlgToks)) dlgToks[k]=m[k]; }); if(activeId) setCtxToks(dlgToks[activeId]); } }catch(e){}
  }); }
  function saveDlgToks(){ clearTimeout(dlgToksTimer); dlgToksTimer=setTimeout(function(){
    uiFetch('/ui/kv/dlg_toks',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:JSON.stringify(dlgToks)})}).catch(function(){});
  }, 800); }
  /* Last unrecovered error message per dialog id, persisted as one ui_kv JSON map so the
     error box survives a page reload. Deliberately kept OUT of `convo`: it must never be
     resent to the backend, so continuing the dialog after the backend recovers can't be
     polluted by a fake assistant turn carrying the error text. */
  var dlgErrs={}, dlgErrsTimer=null;
  function loadDlgErrs(){ pFetchJSON('/ui/kv/dlg_errs').then(function(d){
    if(!d||!d.value) return;
    try{ var m=JSON.parse(d.value); if(m&&typeof m==='object'){ Object.keys(m).forEach(function(k){ if(!(k in dlgErrs)) dlgErrs[k]=m[k]; }); } }catch(e){}
  }); }
  function saveDlgErrs(){ clearTimeout(dlgErrsTimer); dlgErrsTimer=setTimeout(function(){
    uiFetch('/ui/kv/dlg_errs',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:JSON.stringify(dlgErrs)})}).catch(function(){});
  }, 800); }
  function setDlgErr(msg){ if(!activeId) return; dlgErrs[activeId]=String(msg||''); saveDlgErrs(); }
  function clearDlgErr(){ if(activeId && (activeId in dlgErrs)){ delete dlgErrs[activeId]; saveDlgErrs(); } }
  /* Pinned dialog ids, persisted as a ui_kv JSON array so pins survive reloads. On unpin a
     dialog falls back into the main list, which updateDialogList keeps sorted by date. */
  var dlgPins={}, dlgPinsTimer=null;
  function loadDlgPins(){ return pFetchJSON('/ui/kv/dlg_pins').then(function(d){
    if(d && d.value){ try{ var a=JSON.parse(d.value); if(Array.isArray(a)){ a.forEach(function(id){ dlgPins[id]=1; }); } }catch(e){} }
    refreshSidebar();
  }); }
  function savePins(){ clearTimeout(dlgPinsTimer); dlgPinsTimer=setTimeout(function(){
    uiFetch('/ui/kv/dlg_pins',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:JSON.stringify(Object.keys(dlgPins))})}).catch(function(){});
  }, 600); }
  /* Model context window (total tokens), auto-detected from the backend by the server
     (/ui/model-info). null when the backend doesn't expose it → the counter degrades to a
     plain token figure with no gauge. */
  var ctxWindow=null;
  /* fetched no-store: the window is a live backend probe, so a cached null (e.g. backend not
     yet reachable on first load over VPN) must not stick — that was the "only Ctrl+F5 fixes it"
     bug. Safe to call again on events (settings save, opening a chat) to refresh dynamically. */
  function loadModelInfo(){ pFetchJSON('/ui/model-info',{cache:'no-store'}).then(function(d){
    if(d && typeof d.context_window==='number' && d.context_window>0){ ctxWindow=d.context_window; if(activeId) setCtxToks(dlgToks[activeId]); }
  }).catch(function(){}); }
  /* small version tag on the home screen — source is /health (ungated), so it works before any
     token is entered; version/git_sha come from the binary (CARGO_PKG_VERSION/GIT_SHA), not hardcoded */
  function loadVersion(){ fetch('/health',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(d){
    var el=document.getElementById('homeVer'); if(!el||!d||!d.version) return;
    el.textContent='v'+d.version; el.title=d.git_sha?('cloudling v'+d.version+' · '+d.git_sha):('cloudling v'+d.version);
  }).catch(function(){}); }
  function setCtxToks(n){
    var el=document.getElementById('ctxToks'); if(!el) return;
    el.classList.remove('warn','crit');
    if(typeof n!=='number'){ el.textContent=''; return; }
    var nf=n.toLocaleString(LOCALE);
    if(ctxWindow){
      var pct=Math.min(100, Math.round(n/ctxWindow*100));
      el.textContent=nf+' / '+ctxWindow.toLocaleString(LOCALE)+' ('+pct+'%)';
      el.title=t('ctx.gaugeTitle',{n:nf, total:ctxWindow.toLocaleString(LOCALE)});
      if(pct>=90){ el.classList.add('crit'); } else if(pct>=75){ el.classList.add('warn'); }
    } else {
      el.textContent=t('ctx.plainCount',{n:nf});
      el.title=t('ctx.plainTitle');
    }
  }
  /* ---- client-side context compaction (persistent, UI-owned) ----
     When the live context reaches COMPACT_AT of the detected window, fold the older turns into
     a model-written summary (/ui/summarize), keep the recent tail verbatim, and persist the
     shorter history in the dialog. Survives across turns — unlike the per-request server-side
     auto-compaction. Needs a known window (else stays silent). */
  var COMPACT_AT=0.80, COMPACT_KEEP=6, compacting=false;
  var COMPACT_RE=/^\[(Сводка предыдущей части диалога|Summary of the earlier conversation)[^\]]*\]\n?/;
  function maybeAutoCompact(pt){
    if(!ctxWindow || typeof pt!=='number') return;
    if(pt < Math.round(ctxWindow*COMPACT_AT)) return;
    compactNow(false);
  }
  /* Fold the older turns now, unconditionally (no window/threshold gate). `reactive` marks
     a server-initiated rescue: the backend rejected the context as too large, the server
     compacted-and-retried this turn, and signalled us to shorten the STORED history too —
     otherwise every following turn would overflow and be rescued again (serve is stateless). */
  function compactNow(reactive){
    if(compacting) return;
    if(convo.length <= COMPACT_KEEP+2) return;
    var older=convo.slice(0, convo.length-COMPACT_KEEP);
    var tail=convo.slice(convo.length-COMPACT_KEEP);
    if(older.length===1 && COMPACT_RE.test(older[0].content||'')) return; /* already just a summary */
    var id=activeId;
    var text=older.map(function(m){ var c=(typeof m.content==='string')?m.content:''; return (m.role==='user'?'User: ':'Assistant: ')+c; }).join('\n\n');
    compacting=true;
    uiFetch('/ui/summarize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(d){
        compacting=false;
        var summary=((d&&d.summary)||'').trim();
        if(!summary || id!==activeId) return;
        var est=Math.round((text.length - summary.length)/4); if(est<0) est=0;
        var header=t('compact.header',{n:older.length, est:est.toLocaleString(LOCALE)});
        convo=[{role:'assistant', content:header+'\n'+summary}].concat(tail);
        renderConvo(convo); saveActive();
        showCompactBanner(t(reactive?'compact.reactiveBanner':'compact.banner',{est:est.toLocaleString(LOCALE)}));
      })
      .catch(function(){ compacting=false; });
  }
  /* transient slide-up notice: rises from behind the composer, then retracts back behind it */
  var compactBannerTimer=null;
  function showCompactBanner(text){
    var el=document.getElementById('compactToast'); if(!el) return;
    el.textContent=text;
    el.classList.remove('show'); void el.offsetWidth; /* force the hidden start state before animating in */
    el.classList.add('show');
    if(compactBannerTimer) clearTimeout(compactBannerTimer);
    compactBannerTimer=setTimeout(function(){ el.classList.remove('show'); }, 2800);
  }
  function compactMark(content){
    var d=document.createElement('div'); d.className='compact-mark';
    var m=String(content||'').match(COMPACT_RE);
    var head=m ? m[0].replace(/^\[|\]\n?$/g,'') : t('compact.markFallback');
    var body=String(content||'').replace(COMPACT_RE,'');
    var ic='<svg class="cm-ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/></svg>';
    d.innerHTML='<details><summary>'+ic+'<span>'+esc(head)+'</span></summary><div class="cm-body">'+esc(body)+'</div></details>';
    return d;
  }
  function renderConvo(messages){ stopSpeech(); thread.innerHTML=''; setCtxToks(dlgToks[activeId]); convo=(messages||[]).map(function(m){ return m.atts ? {role:m.role, content:m.content, atts:m.atts} : {role:m.role, content:m.content}; });
    convo.forEach(function(m){
      if(m.role==='assistant' && COMPACT_RE.test(m.content||'')){ thread.appendChild(compactMark(m.content)); return; }
      thread.appendChild(m.role==='user' ? userTurn(m) : assistantTurnEl(m.content));
    });
    var em=dlgErrs[activeId]; /* unrecovered error from a previous session → re-show the box (lives outside convo) */
    if(em!==undefined){ var et=document.createElement('div'); et.className='turn a noconv'; et.innerHTML=errboxHTML(em); attachRetry(et, dlgSend()); thread.appendChild(et); }
    refreshTaskbar(); }

  function fmtDate(ms){ if(!ms) return ''; var d=new Date(ms), now=new Date();
    if(d.toDateString()===now.toDateString()) return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    return ('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2); }
  function sidebarItem(d){ var it=document.createElement('div'); it.className='item'; it.dataset.id=d.id; it.dataset.updated=d.updated_ms||0;
    if(dlgPins[d.id]) it.classList.add('pinned');
    it.innerHTML='<span class="t">'+esc(d.title||t('dialogs.untitled'))+'</span><span class="date">'+fmtDate(d.updated_ms)+'</span><button class="kebab" aria-label="'+escAttr(t('common.menu'))+'">⋯</button>'; return it; }
  function refreshSidebar(){ return apiList().then(function(list){
    leftDrawer.querySelectorAll('.item').forEach(function(n){ n.remove(); });
    var anchor=document.getElementById('emptyNone');
    list.forEach(function(d){ var it=sidebarItem(d); if(d.id===activeId){ it.classList.add('active'); activeItem=it; } leftDrawer.insertBefore(it, anchor); });
    updateDialogList(); return list; }); }

  /* auto-title: after the first exchange, ask the model for a short title (like OWUI).
     Separate non-stream call; falls back silently to the truncated first message. */
  function stripBlocks(t){ return (t||'').replace(/<details type="(tool_calls|reasoning)"[\s\S]*?<\/details>/g,' ').replace(/\s+/g,' ').trim(); }
  function genTitle(){
    if(!activeId) return;
    var id=activeId;
    var firstUser=((convo[0]&&convo[0].content)||'').slice(0,400);
    var firstAsst=stripBlocks((convo[1]&&convo[1].content)||'').slice(0,400);
    if(!firstUser) return;
    var text=t('title.msg',{u:firstUser})+(firstAsst?('\n'+t('title.answer',{a:firstAsst})):'');
    uiFetch('/ui/title',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(d){
        var t=(d&&d.title)||'';
        t=stripBlocks(t).split('\n')[0].replace(/^["'«»\s]+|["'«».\s]+$/g,'').trim();
        if(t.length>60) t=t.slice(0,60);
        if(t && id===activeId){ dtitle.textContent=t; apiSave(id, t, convo); refreshSidebar(); }
      }).catch(function(){});
  }

  /* fade a full view out while it's laid on top (out of flow), then hide it */
  function dissolveOut(view){
    view.style.position='absolute'; view.style.inset='0'; view.style.zIndex='1'; view.style.pointerEvents='none';
    var a=view.animate([{opacity:1},{opacity:0}],{duration:200, easing:'ease-in'});
    a.onfinish=function(){ view.hidden=true; view.style.position=''; view.style.inset=''; view.style.zIndex=''; view.style.pointerEvents=''; };
  }
  function openDialog(id, el){
    var wasDialog=(viewDlg.hidden===false), wasHome=(viewHome.hidden===false);
    activeId=id; document.getElementById('view-setup').hidden=true; document.getElementById('view-preset').hidden=true;
    if(ctxWindow===null) loadModelInfo(); /* window still unknown (slow/late backend) — re-probe, no manual reload needed */
    /* take home out of flow FIRST (dissolve), THEN show the dialog — otherwise the dialog is
       briefly pushed below the fold and jumps up when home leaves the flow */
    if(wasHome && viewHome.animate){ dissolveOut(viewHome); } else { viewHome.hidden=true; }
    viewDlg.hidden=false;
    leftDrawer.querySelectorAll('.item').forEach(function(it){ it.classList.toggle('active', it===el); });
    activeItem=el;
    if(!wasDialog){ thread.style.opacity='0'; } /* coming from home: don't flash the old/empty thread */
    var tok=++skelToken;
    /* fetch first, then swap content while hidden (no skeleton flash, scroll snap invisible),
       then fade in — keeps the transition smooth */
    apiGet(id).then(function(d){ if(tok!==skelToken) return;
      function apply(){
        dtitle.textContent=(d && d.title) || '';
        thread.style.opacity='0';
        renderConvo(d ? d.messages : []); stick=true; toBottom(); updateScrollBtn();
        if(thread.animate){ var fa=thread.animate([{opacity:0},{opacity:1}],{duration:200, easing:'ease-out'}); fa.onfinish=function(){ thread.style.opacity=''; }; }
        else { thread.style.opacity=''; }
      }
      if(wasDialog && thread.animate && thread.children.length){
        var fo=thread.animate([{opacity:1},{opacity:0}],{duration:120, easing:'ease-in'}); fo.onfinish=apply;
      } else { apply(); }
    });
  }
  function newDialog(){
    var wasDialog=(viewDlg.hidden===false);
    document.getElementById('view-setup').hidden=true; viewHome.hidden=false; activeId=null; activeItem=null; convo=[]; setCtxToks(); refreshTaskbar();
    leftDrawer.querySelectorAll('.item').forEach(function(it){ it.classList.remove('active'); });
    /* dialog → new chat: dissolve the dialog to reveal home, fade the hero in */
    if(wasDialog && viewDlg.animate){
      dissolveOut(viewDlg);
      var hero=viewHome.querySelector('.hero'); if(hero && hero.animate){ hero.animate([{opacity:0, transform:'translateY(-8px)'},{opacity:1, transform:'none'}],{duration:260, easing:'ease-out'}); }
    } else { viewDlg.hidden=true; }
  }
  /* persist the active dialog (full transcript) */
  function saveActive(){ if(!activeId) return; var title=(dtitle.textContent||'').trim() || ((convo[0]&&convo[0].content)||'').slice(0,42) || t('dialogs.untitled'); apiSave(activeId, title, convo); }
  document.getElementById('newDlg').onclick=function(){ newDialog(); closeDrawers(); };

  function showSetup(){ viewHome.hidden=true; viewDlg.hidden=true; document.getElementById('view-setup').hidden=false; }
  document.getElementById('openSetup').addEventListener('click', function(){
    b.classList.remove('open-left'); b.classList.add('open-right'); tabR.textContent='×'; tabL.textContent='☰';
    var det=document.querySelector('.drawer.right details.acc'); if(det) det.open=true;
    setTimeout(function(){ var f=document.querySelector('.drawer.right .fieldrow input'); if(f) f.focus(); }, 200);
  });

  /* ---------- sidebar generating indicator ---------- */
  function setItemGenerating(it,on){ if(!it) return;
    var ind=it.querySelector('.genind');
    if(on){ it.classList.add('gen'); if(!ind){ ind=document.createElement('span'); ind.className='genind'; ind.innerHTML=cloud(22); it.insertBefore(ind, it.querySelector('.kebab')); } }
    else{ it.classList.remove('gen'); if(ind) ind.remove(); }
  }

  /* ---------- send → generation lifecycle ---------- */
  /* The round button of a composer when nothing is being generated: «Send» — dimmed while the
     field is empty — or, with an empty field and both speech servers configured, the cloud that
     starts a voice dialog. Without speech-to-text, and while a dialog is already on, the empty
     field keeps the dimmed arrow. */
  function paintSend(btn){
    if(btn.classList.contains('stop')) return;
    var ent=btn.closest('.entry'), ta=ent.querySelector('textarea'), atts=ent.querySelector('.attachments');
    var empty=!(ta.value||'').trim() && !(atts && atts.children.length);
    var asCall=empty && !call && callAvailable();
    btn.classList.toggle('call', asCall); btn.classList.toggle('off', empty && !asCall);
    btn.innerHTML=asCall?IC.callCloud:IC.send;
    var l=t(asCall?'composer.call':'composer.send'); btn.title=l; btn.setAttribute('aria-label', l);
  }
  function setSend(btn, stop){ if(stop){ btn.classList.add('stop'); btn.classList.remove('off','call'); btn.innerHTML='<span class="sq"></span>'; btn.title=t('composer.stop'); } else { btn.classList.remove('stop'); paintSend(btn); } }
  function clearTimers(){ genTimers.forEach(function(t){clearTimeout(t);clearInterval(t);}); genTimers=[]; }

  /* Whoever wants to follow an answer while it is being written (the voice dialog speaks it):
     text(acc) on every piece of content, done() once when the generation is over — however it
     ends (complete, error, stopped). */
  var genHook=null;
  function genHookDone(){ var h=genHook; genHook=null; if(h){ try{ h.done(); }catch(_){} } }
  function finishGen(btn){ generating=false; setSend(btn,false); setItemGenerating(activeItem,false); if(pendingLiveCancel){ pendingLiveCancel(); pendingLiveCancel=null; } genHookDone(); }

  /* Error-box headline is localized by the server's machine `kind` (error.kind in the SSE
     error chunk — see classify_engine_error in chat.rs); the raw message stays as the detail. */
  var ERR_HEADS={backend_unreachable:'err.unreachableHead', provider_auth:'err.authHead', rate_limited:'err.rateHead'};
  function errboxHTML(msg, kind){ var detail = msg ? esc(String(msg)) : t('err.noEngine'); return '<div class="errbox"><div class="ehead">'+IC.warn+t(ERR_HEADS[kind]||'err.noResponseHead')+'</div><div class="emsg">'+detail+'</div><button class="retry" type="button">'+IC.regen+t('common.retry')+'</button></div>'; }

  /* ---------- real chat ----------
     The page is the client: it holds the dialog history and re-sends it every turn
     (cloudling is stateless). `convo` is that history; one thread `.turn` maps 1:1 to one
     convo entry, so we can rewind both together on regenerate / edit. */
  var convo = [], currentAbort = null, liveAcc = '', pendingLiveCancel = null;
  /* Invariant: every convo entry maps 1:1, in DOM order, onto a `.turn` OR a `.compact-mark`
     (the folded-history summary is a real `convo` entry but rendered as a compact-mark, not a
     turn). Both are counted for index math; error boxes are marked `.noconv` (no history entry)
     and excluded — so regenerate/edit slice `convo` at the right spot even after a failed turn
     or a context compaction. Missing the compact-mark here drifts every later index by one. */
  function realTurns(){ return Array.prototype.filter.call(thread.querySelectorAll('.turn, .compact-mark'), function(t){ return !t.classList.contains('noconv'); }); }
  function turnIndex(turn){ return realTurns().indexOf(turn); }
  /* remove `turn` (if inclusive) and every turn after it — incl. stray error boxes */
  function removeTurnsFrom(turn, inclusive){
    var all=Array.prototype.slice.call(thread.querySelectorAll('.turn'));
    var from=all.indexOf(turn); if(from<0) return;
    all.slice(inclusive?from:from+1).forEach(function(n){ n.remove(); });
  }

  function attachRetry(turn, btn){ var r=turn.querySelector('.retry'); if(!r) return;
    r.addEventListener('click', function(){ if(generating) return;
      generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
      turn.remove(); generate(btn);
    });
  }

  /* ---- tool-call blocks in the stream (task #8) ----
     cloudling streams tool results inline in the content as one chunk shaped like:
       <details type="tool_calls" ... name="X">…<summary>Tool Executed|Tool Failed</summary>OUTPUT</details>
     We peel those out and render each as its own collapsible block, markdown-rendering the
     surrounding text. (ToolUse has no separate stream event, so there is no "running" state —
     the block appears already executed.) */
  var TOOL_RE=/<details type="tool_calls"[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/details>/g;
  /* Generic block matcher: tool-call results AND reasoning blocks. m[1]=kind, m[2]=opening-tag
     attrs (tool name lives here), m[3]=inner. */
  var BLOCK_RE=/<details type="(tool_calls|reasoning|ask)"([^>]*)>([\s\S]*?)<\/details>/g;
  function decodeEntities(s){ return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&'); }
  function blockEl(kind, attrs, inner, live){
    if(kind==='reasoning') return buildReasonEl(inner);
    if(kind==='ask') return buildAskEl(attrs, !!live);
    var name=(attrs.match(/\bname="([^"]*)"/)||[])[1]||'';
    /* TodoWrite is shown in the task bar under the header, not as an inline plate */
    if(name==='TodoWrite') return null;
    var args=(attrs.match(/\barguments="([^"]*)"/)||[])[1]||'';
    return buildToolEl(name, inner, args);
  }
  /* Interactive AskUserQuestion widget. The server emits ONE closed `<details type="ask"
     id=… questions=…>` block per tool call — `questions` is a JSON array of {question,
     options}, so several related questions render as a single form with one submit (the
     Claude-style batch). The turn BLOCKS until the answers are POSTed to /ui/answer.
     A single question keeps the historical UX: clicking an option answers immediately.
     Old saved dialogs still carry the legacy `question=`/`options=`/`answer=` attributes —
     both shapes are parsed. `live` (the actively streaming turn) renders the interactive
     form; re-renders (finalize / reloaded dialogs) pass live=false → a static view;
     `askAnswered` keeps the chosen values across the in-session re-render. */
  var askAnswered={}; /* qid -> array of answers (in-memory; baked into saved markup on finalize) */
  function attrVal(attrs, key){ var m=attrs.match(new RegExp('\\b'+key+'="([^"]*)"')); return m?decodeEntities(m[1]):''; }
  function escAttr(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  /* Persist chosen answers into the ask-block markup so a reload keeps the selection
     highlighted (the in-memory map is wiped on refresh; the saved dialog content survives). */
  function bakeAskAnswers(text){
    return text.replace(/<details type="ask"([^>]*)>/g, function(m, a){
      if(/\banswers?=/.test(a)) return m;
      var idm=a.match(/\bid="([^"]+)"/); if(!idm) return m;
      var qid=decodeEntities(idm[1]);
      if(!Object.prototype.hasOwnProperty.call(askAnswered, qid)) return m;
      return '<details type="ask"'+a+' answers="'+escAttr(JSON.stringify(askAnswered[qid]))+'">';
    });
  }
  var ASKCHECK='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  function buildAskEl(attrs, live){
    var qid=attrVal(attrs,'id');
    /* question batch: preferred `questions` attr, else the legacy single-question attrs */
    var qs=[]; try{ qs=JSON.parse(attrVal(attrs,'questions'))||[]; }catch(e){}
    if(!qs.length){
      var lq=attrVal(attrs,'question');
      var lo=[]; try{ lo=JSON.parse(attrVal(attrs,'options'))||[]; }catch(e){}
      qs=[{question:lq, options:lo}];
    }
    qs=qs.map(function(q){ return {question:(q&&q.question)||'', options:(q&&q.options)||[]}; });
    var single = qs.length===1;
    /* already answered? `answers` attr (JSON array), legacy `answer` attr, or in-memory */
    var baked=null;
    var fa=attrVal(attrs,'answers'); if(fa){ try{ baked=JSON.parse(fa); }catch(e){} }
    if(!baked){ var one=attrVal(attrs,'answer'); if(one!=='') baked=[one]; }
    if(!baked && Object.prototype.hasOwnProperty.call(askAnswered,qid)) baked=askAnswered[qid];
    var box=document.createElement('div'); box.className='askw';
    /* collapsed (answered) view: one “✓ answer” row per question; the multi form keeps the
       question text as a muted label so the pairs stay readable. */
    function answerRow(qtext, val){
      var a=document.createElement('div'); a.className='askans';
      var c=document.createElement('span'); c.className='askck'; c.innerHTML=ASKCHECK;
      a.appendChild(c);
      if(!single){ var qt=document.createElement('span'); qt.className='askqt'; qt.textContent=qtext; a.appendChild(qt); }
      var v=document.createElement('span'); v.textContent=val;
      a.appendChild(v); return a;
    }
    function answeredView(vals){
      box.classList.add('answered');
      while(box.firstChild) box.removeChild(box.firstChild);
      if(single){
        var q=document.createElement('div'); q.className='askq'; q.textContent=qs[0].question||t('ask.questionFallback'); box.appendChild(q);
      }
      qs.forEach(function(item,i){ box.appendChild(answerRow(item.question, vals[i]!=null?vals[i]:'')); });
    }
    if(baked){ answeredView(baked); return box; }
    function submit(vals){
      if(Object.prototype.hasOwnProperty.call(askAnswered, qid)) return;
      askAnswered[qid]=vals;
      uiFetch('/ui/answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:qid,answers:vals})}).catch(function(){});
      answeredView(vals);
    }
    /* interactive form: per question — option rows + a free-text field. Single question:
       clicking an option submits immediately (historical UX). Multi: clicks select (filled
       radio), typing clears the selection, one Answer button submits when every question
       has a value. */
    var sel=qs.map(function(){ return null; });
    var inputs=[];
    var goAll=null;
    function value(i){ var tv=inputs[i]?inputs[i].value.trim():''; return tv||sel[i]; }
    function refreshGo(){ if(goAll) goAll.disabled=!qs.every(function(_,i){ return !!value(i); }); }
    qs.forEach(function(item, i){
      var group=document.createElement('div'); group.className='askgroup';
      var q=document.createElement('div'); q.className='askq'; q.textContent=item.question||t('ask.questionFallback'); group.appendChild(q);
      var rows=[];
      item.options.forEach(function(o){
        var r=document.createElement('button'); r.type='button'; r.className='askrow'; r.setAttribute('data-v', o);
        var dot=document.createElement('span'); dot.className='askradio';
        var lab=document.createElement('span'); lab.textContent=o;
        r.appendChild(dot); r.appendChild(lab);
        if(live){
          r.addEventListener('click', function(){
            if(single){ submit([o]); return; }
            sel[i]=o; if(inputs[i]) inputs[i].value='';
            rows.forEach(function(x){ x.classList.remove('sel'); }); r.classList.add('sel');
            refreshGo();
          });
        } else { r.disabled=true; }
        rows.push(r); group.appendChild(r);
      });
      if(item.options.length){
        var or=document.createElement('div'); or.className='askor';
        var l1=document.createElement('span'); l1.className='askln';
        var l2=document.createElement('span'); l2.className='askln';
        var orSpan=document.createElement('span'); orSpan.textContent=t('ask.orOwn');
        or.appendChild(l1); or.appendChild(orSpan); or.appendChild(l2); group.appendChild(or);
      }
      var inp=document.createElement('input'); inp.type='text'; inp.className='askinp'; inp.placeholder=t('ask.ownPh');
      inputs[i]=inp;
      if(single){
        /* historical single-question layout: text field + its own Answer button */
        var go=document.createElement('button'); go.type='button'; go.className='askgo'; go.textContent=t('ask.answer');
        function submitOther(){ var v=inp.value.trim(); if(v) submit([v]); }
        go.addEventListener('click', submitOther);
        inp.addEventListener('keydown', function(e){ if(e.key==='Enter') submitOther(); });
        if(!live){ inp.disabled=true; go.disabled=true; }
        var row=document.createElement('div'); row.className='askother';
        row.appendChild(inp); row.appendChild(go); group.appendChild(row);
      } else {
        inp.addEventListener('input', function(){
          if(inp.value.trim()){ sel[i]=null; rows.forEach(function(x){ x.classList.remove('sel'); }); }
          refreshGo();
        });
        if(!live) inp.disabled=true;
        var row2=document.createElement('div'); row2.className='askother';
        row2.appendChild(inp); group.appendChild(row2);
      }
      box.appendChild(group);
    });
    if(!single){
      var foot=document.createElement('div'); foot.className='asksubmit';
      goAll=document.createElement('button'); goAll.type='button'; goAll.className='askgo'; goAll.textContent=t('ask.answer');
      goAll.disabled=true;
      goAll.addEventListener('click', function(){ if(!goAll.disabled) submit(qs.map(function(_,i){ return value(i); })); });
      if(!live) goAll.disabled=true;
      foot.appendChild(goAll); box.appendChild(foot);
    }
    return box;
  }
  /* The tool invocation lives in the block's arguments="…" attr (HTML-escaped JSON). Show it
     above the output so it is clear *what* the agent ran: the command string for shell tools,
     else a compact view of the input params. Empty ("{}") arguments render nothing. */
  function toolCommandText(rawArgs){
    if(!rawArgs) return '';
    var obj; try{ obj=JSON.parse(decodeEntities(rawArgs)); }catch(e){ return ''; }
    if(!obj || typeof obj!=='object') return '';
    if(typeof obj.command==='string' && obj.command.trim()) return obj.command.replace(/\r\n?/g,'\n');
    return Object.keys(obj).length ? JSON.stringify(obj) : '';
  }
  function buildToolEl(name, inner, args){
    var fail=/<summary>\s*Tool Failed/i.test(inner);
    var out=inner.replace(/<summary>[\s\S]*?<\/summary>/i,'').replace(/^\s+|\s+$/g,'');
    var d=document.createElement('details'); d.className='tool'+(fail?' fail':'');
    var sum=document.createElement('summary'); sum.className='head';
    sum.innerHTML=(fail?IC.warn:'')+'<span class="tag">'+esc(decodeEntities(name))+'</span> · '+(fail?t('tool.failed'):t('tool.done'));
    var pre=document.createElement('pre'); pre.className='toolout';
    var raw=decodeEntities(out), text;
    try{
      var parsed=JSON.parse(raw);
      /* The server JSON-encodes the tool-output string (serde_json::to_string), so the
         first parse only unwraps that layer and yields the original output string. When
         that output is itself JSON (shell tools return {stdout,stderr,…} as a string),
         parse once more to reach the object. Plain-text output stays a string (the inner
         parse throws and we keep it). */
      if(typeof parsed==='string'){
        try{ var inner=JSON.parse(parsed); if(inner && typeof inner==='object') parsed=inner; }catch(_){}
      }
      if(parsed && typeof parsed==='object' && ('stdout' in parsed || 'stderr' in parsed)){
        /* Shell / PowerShell-style result: show the actual output, not raw JSON.
           Normalize CRLF (and lone CR) so Windows output is not a "\r\n" wall,
           and trim surrounding blank lines. */
        var parts=[];
        if(parsed.stdout) parts.push(String(parsed.stdout));
        if(parsed.stderr) parts.push(String(parsed.stderr));
        text=parts.join('\n').replace(/\r\n?/g,'\n').replace(/^\n+|\n+$/g,'');
        if(!text) text=t('tool.noOutput');
      } else {
        text=(typeof parsed==='string')?parsed:JSON.stringify(parsed,null,2);
      }
    }
    catch(e){ text=raw; }
    pre.textContent=text;
    d.appendChild(sum);
    var cmd=toolCommandText(args);
    if(cmd){ var cel=document.createElement('pre'); cel.className='toolcmd'; cel.textContent=cmd; d.appendChild(cel); }
    d.appendChild(pre);
    return d;
  }
  /* reasoning block: the model's thinking, collapsed by default */
  function buildReasonEl(inner){
    var out=inner.replace(/<summary>[\s\S]*?<\/summary>/i,'').replace(/^\s+|\s+$/g,'');
    var d=document.createElement('details'); d.className='tool reason';
    var sum=document.createElement('summary'); sum.className='head';
    sum.innerHTML='<span class="tag">'+t('reason.title')+'</span>';
    var pre=document.createElement('pre'); pre.className='toolout'; pre.textContent=decodeEntities(out);
    d.appendChild(sum); d.appendChild(pre); return d;
  }
  /* rebuild the assistant turn body from the raw accumulated content; caret only while streaming */
  function paintTurn(turn, raw, streaming){
    turn.innerHTML='';
    var pos=0, m, segs=[]; BLOCK_RE.lastIndex=0;
    while((m=BLOCK_RE.exec(raw))!==null){
      if(m.index>pos) segs.push({t:'text', v:raw.slice(pos, m.index)});
      segs.push({t:'block', kind:m[1], attrs:m[2], inner:m[3]});
      pos=BLOCK_RE.lastIndex;
    }
    if(pos<raw.length) segs.push({t:'text', v:raw.slice(pos)});
    segs.forEach(function(s, i){
      if(s.t==='block'){ var bel=blockEl(s.kind, s.attrs, s.inner); if(bel) turn.appendChild(bel); return; }
      if(!s.v.replace(/\s/g,'')) return; /* skip whitespace-only gaps between blocks */
      var box=document.createElement('div'); box.className='md';
      var isLast=(i===segs.length-1);
      if(streaming && isLast){ box.textContent=s.v; } else { box.innerHTML=md(s.v); }
      turn.appendChild(box);
    });
    if(streaming){ var c=document.createElement('span'); c.className='caret'; turn.appendChild(c); }
  }

  /* ---- task bar (TodoWrite) ----
     The model's TodoWrite calls stream as tool_calls blocks but are not drawn inline
     (blockEl returns null for them). Instead the LATEST list feeds a collapsible bar under
     the dialog header. Persistence is free: the blocks live in the saved transcript, so on
     dialog open we just scan `convo` for the last TodoWrite. */
  var taskbar=document.getElementById('taskbar'), taskbarOpen=false;
  var TODO_RE=/<details type="tool_calls"[^>]*\bname="TodoWrite"[^>]*>([\s\S]*?)<\/details>/g;
  var TB_IC={
    done:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12l2.4 2.4 4.6-5"/></svg>',
    active:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/></svg>',
    pending:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>'
  };
  /* a TodoWrite block body is the tool output JSON-encoded as a string, HTML-escaped;
     decode once → JSON string, parse twice → {oldTodos, newTodos, ...} */
  function todosFromBlock(inner){ try{
    var body=inner.replace(/<summary>[\s\S]*?<\/summary>/i,'').replace(/^\s+|\s+$/g,'');
    var s=JSON.parse(decodeEntities(body));
    var obj=(typeof s==='string')?JSON.parse(s):s;
    if(obj && Array.isArray(obj.newTodos)) return obj.newTodos;
  }catch(e){} return null; }
  function latestTodos(raw){ if(!raw) return null; var m, last=null; TODO_RE.lastIndex=0;
    while((m=TODO_RE.exec(raw))!==null){ var t=todosFromBlock(m[1]); if(t!==null) last=t; } return last; }
  /* current list = the streaming turn if it has one, else the last across stored history */
  function currentTodos(){
    var t=latestTodos(liveAcc); if(t!==null) return t;
    for(var i=convo.length-1;i>=0;i--){ if(convo[i].role==='assistant'){ var h=latestTodos(convo[i].content||''); if(h!==null) return h; } }
    return null;
  }
  function todoCls(s){ return s==='completed'?'done':(s==='in_progress'?'active':'pending'); }
  function renderTaskbar(todos){
    if(!todos || !todos.length){ taskbar.hidden=true; taskbar.innerHTML=''; taskbar.classList.remove('open'); return; }
    var total=todos.length, done=0, active=null;
    todos.forEach(function(t){ if(t.status==='completed') done++; else if(t.status==='in_progress' && !active) active=t; });
    var pct=Math.round(done/total*100), allDone=(done===total);
    var nowTxt=active ? (active.activeForm||active.content||'') : (allDone?t('tasks.done'):'');
    var head='<button class="tb-head" type="button" aria-expanded="'+(taskbarOpen?'true':'false')+'">'+
      '<span class="tb-ic">'+TB_IC.active+'</span><span class="tb-title">'+t('tasks.title')+'</span>'+
      '<span class="tb-count">'+done+'/'+total+'</span>'+
      '<span class="tb-prog"><i style="width:'+pct+'%"></i></span>'+
      (nowTxt?'<span class="tb-now">'+esc(nowTxt)+'</span>':'')+
      '<span class="tb-chev">▾</span></button>';
    var items=todos.map(function(t){ var c=todoCls(t.status);
      return '<div class="tb-item '+c+'"><span class="tb-mk">'+TB_IC[c]+'</span><span class="tb-tx">'+esc(t.content||'')+'</span></div>'; }).join('');
    taskbar.innerHTML=head+'<div class="tb-list"'+(taskbarOpen?'':' hidden')+'>'+items+'</div>';
    taskbar.classList.toggle('open', taskbarOpen);
    taskbar.hidden=false;
  }
  function refreshTaskbar(){ renderTaskbar(currentTodos()); }
  taskbar.addEventListener('click', function(e){ if(!e.target.closest('.tb-head')) return;
    taskbarOpen=!taskbarOpen; var list=taskbar.querySelector('.tb-list'); if(list) list.hidden=!taskbarOpen;
    var h=taskbar.querySelector('.tb-head'); if(h) h.setAttribute('aria-expanded', taskbarOpen?'true':'false');
    taskbar.classList.toggle('open', taskbarOpen);
  });

  /* Tasks #7–#8: stream the answer and render inline tool-call blocks. */
  function generate(btn){
    stopSpeech(); /* a new answer supersedes whatever is being read aloud */
    /* a fresh attempt (retry or a new message) supersedes any stored error for this dialog,
       and any stale error boxes left in the thread are dropped so they don't pile up */
    clearDlgErr();
    thread.querySelectorAll('.turn').forEach(function(t){ if(t.querySelector('.errbox')) t.remove(); });
    var turn=document.createElement('div'); turn.className='turn a';
    turn.innerHTML='<div class="thinking">'+cloud(38)+'<span>'+t('chat.thinking')+'</span></div>';
    thread.appendChild(turn); stick=true; maybeScroll();
    var ac=new AbortController(); currentAbort=ac;
    var acc='', committed=0, liveBox=null, caretEl=null, thinkingShown=true, errored=false, lastFinish=null, reasonLiveEl=null;
    var serverCompacted=false; /* server had to reactive-compact (context overflow) → fold our stored history after the turn */
    liveAcc=''; /* mirror of acc for stopGen (partial answer must reach convo on stop) */
    /* Coalesce the progressive markdown re-render to one per animation frame. md() reparses
       the whole uncommitted tail, so calling it on every token is O(n^2) on long answers;
       rAF batches it without changing the output (finalize() does the authoritative render). */
    var liveRaf=0;
    function renderLiveTail(){ liveRaf=0; if(!liveBox) return;
      var tail=acc.slice(committed);
      /* Reasoning streams open (<details type="reasoning" done="false"> … not yet closed):
         peel it out of the tail and show it as a COLLAPSED disclosure that fills quietly (an
         expanded growing block reflows the whole thread on every token). When the closing tag
         arrives, onContent's BLOCK_RE commits it as the normal collapsed block. */
      var ro=tail.search(/<details type="reasoning"/);
      if(ro>=0 && tail.indexOf('</details>', ro)<0){
        var before=tail.slice(0, ro);
        var rinner=tail.slice(ro).replace(/<details[^>]*>/,'').replace(/<summary>[\s\S]*?<\/summary>/i,'');
        liveBox.innerHTML=md(before);
        showReasonLive(rinner);
        maybeScroll();
        return;
      }
      clearReasonLive();
      liveBox.innerHTML=md(tail);
      (liveBox.lastElementChild || liveBox).appendChild(caretEl);
      maybeScroll();
    }
    function showReasonLive(text){
      if(!reasonLiveEl){
        /* Collapsed while streaming: a growing, expanded block reflows/jerks the whole thread
           on every token. The summary shows it's active; the user expands it if they want. */
        reasonLiveEl=document.createElement('details'); reasonLiveEl.className='tool reason';
        reasonLiveEl.innerHTML='<summary class="head"><span class="tag">'+t('reason.live')+'</span></summary>';
        var pre=document.createElement('pre'); pre.className='toolout'; reasonLiveEl.appendChild(pre);
        turn.insertBefore(reasonLiveEl, liveBox);
      }
      /* keep the (hidden) text current so opening mid-stream shows the latest reasoning */
      reasonLiveEl.querySelector('pre').textContent=decodeEntities(text.replace(/^\s+|\s+$/g,''));
    }
    function clearReasonLive(){ if(reasonLiveEl){ reasonLiveEl.remove(); reasonLiveEl=null; } }
    function scheduleLiveTail(){ if(liveRaf) return;
      liveRaf=(window.requestAnimationFrame||function(f){return setTimeout(f,16);})(renderLiveTail);
    }
    pendingLiveCancel=function(){ if(liveRaf){ (window.cancelAnimationFrame||clearTimeout)(liveRaf); liveRaf=0; } };
    /* Backend error mid-stream (engine down / token limit): cloudling sends a chunk with an
       `error` field. Show the error box with the reason instead of a blank turn. */
    function showError(msg, kind){
      errored=true; liveAcc='';
      setDlgErr(msg); /* persist so the box survives reload (stored outside convo) */
      turn.classList.add('noconv'); /* error box has no convo entry — exclude from index math */
      /* Preserve whatever the turn already rendered (tool calls + partial text): a mid-stream
         backend error (e.g. 429 between tool steps) must not wipe completed work. Re-render the
         accumulated content cleanly, then append the error box below it. If nothing was rendered
         yet (still "thinking"), just show the error box. */
      if(thinkingShown){ turn.innerHTML=errboxHTML(msg, kind); }
      else { paintTurn(turn, acc, false); turn.insertAdjacentHTML('beforeend', errboxHTML(msg, kind)); }
      attachRetry(turn, btn);
      finishGen(btn); maybeScroll();
    }
    /* Incremental render: completed tool blocks + the text before them are committed ONCE
       (permanent DOM); the trailing text node is re-rendered as markdown each token so
       formatting appears live (progressive, like OpenWebUI). liveBox stays the last child
       and is the anchor we insert committed blocks before, so the tool blocks never get
       rebuilt/re-collapsed mid-stream. */
    function onContent(piece){
      if(errored) return;
      acc+=piece; liveAcc=acc;
      if(genHook){ try{ genHook.text(acc); }catch(_){} }
      if(thinkingShown){ turn.innerHTML=''; thinkingShown=false;
        liveBox=document.createElement('div'); liveBox.className='md'; turn.appendChild(liveBox);
        caretEl=document.createElement('span'); caretEl.className='caret'; }
      var m, todoTouched=false; BLOCK_RE.lastIndex=0;
      while((m=BLOCK_RE.exec(acc))!==null){
        if(m.index < committed) continue;
        var pre=acc.slice(committed, m.index);
        if(pre.replace(/\s/g,'')){ var b=document.createElement('div'); b.className='md'; b.innerHTML=md(pre); turn.insertBefore(b, liveBox); }
        if(m[1]==='reasoning') clearReasonLive(); /* live block now closed → commit collapsed, drop the growing one */
        var cel=blockEl(m[1], m[2], m[3], true); /* live=true → AskUserQuestion widget is clickable */
        if(cel){ turn.insertBefore(cel, liveBox); } else { todoTouched=true; } /* null = suppressed TodoWrite → feed the bar */
        committed=m.index+m[0].length;
      }
      if(todoTouched) refreshTaskbar();
      scheduleLiveTail();  /* progressive markdown, coalesced to one render per frame */
    }
    function finalize(){
      if(errored) return; /* error box already shown — don't overwrite with an empty turn */
      /* "Answer" = content with reasoning/tool <details> blocks stripped. A turn that
         yields no answer text (reasoning-only, or the model returned nothing) must NOT be
         saved silently as a complete answer — that was the "тихий пустой ход". Show the
         reasoning (if any) + a recoverable notice, keep the turn out of convo (noconv) so
         history stays clean and a retry regenerates from the user message. */
      /* A turn that produced tool calls (or an Ask widget) did real work — it is NOT an empty
         turn even when the model added no trailing prose. Only a turn with no answer text AND
         no tool work is the "тихий пустой ход" that gets the recoverable notice. */
      var hasWork=/<details type="(tool_calls|ask)"/.test(acc);
      var ans=acc.replace(/<details[\s\S]*?<\/details>/g,'').trim();
      if(!ans && !hasWork){
        paintTurn(turn, acc, false); /* renders the reasoning block if present, else empty */
        turn.classList.add('noconv');
        turn.insertAdjacentHTML('beforeend',
          '<div class="errbox"><div class="ehead">'+IC.warn+t('err.emptyHead')+'</div>'+
          '<div class="emsg">'+(acc?t('err.emptyBodyReason'):t('err.emptyBody'))+'</div>'+
          '<button class="retry" type="button">'+IC.regen+t('common.regen')+'</button></div>');
        attachRetry(turn, btn);
        finishGen(btn); maybeScroll();
        return;
      }
      acc=bakeAskAnswers(acc); /* persist any chosen AskUserQuestion answers into the saved markup (survives reload) */
      paintTurn(turn, acc, false); /* one clean final render (markdown + tool blocks, no caret) */
      if(lastFinish==='length'){ /* backend hit its output/context limit — answer is cut off, not complete */
        turn.insertAdjacentHTML('beforeend','<div class="note trunc">'+IC.warn+t('err.truncated')+'</div>');
      }
      turn.insertAdjacentHTML('beforeend','<div class="row-acts">'+actBtn('copy',t('common.copy'))+actBtn('speak',t('common.speak'))+actBtn('regen',t('common.regen'))+'</div>');
      convo.push({role:'assistant', content:acc}); liveAcc='';
      saveActive(); refreshTaskbar();
      finishGen(btn); maybeScroll();
      if(convo.length===2){ /* first exchange complete → auto-title; in a voice dialog only after it ends: the
                               title is a separate model request that pushes the dialog's prompt out of the
                               backend's cache, and the next answer would start seconds later */
        if(call){ call.titleDue=activeId; } else { genTitle(); } }
      if(serverCompacted){ compactNow(true); } /* server rescued an overflowing context — shorten our stored history too */
      else { maybeAutoCompact(dlgToks[activeId]); } /* fold older turns if context crossed the window threshold */
    }
    fetch('/v1/chat/completions', {
      method:'POST', headers:{'Content-Type':'application/json','X-Cloudling-UI':'1'}, /* marker: enable interactive AskUserQuestion widget */
      body:JSON.stringify(call && !callPrefs.reasoning
        ? { model:'claw', stream:true, messages:outgoingMessages(), reasoning_effort:'none' } /* voice dialog, reasoning switched off */
        : { model:'claw', stream:true, messages:outgoingMessages() }),
      signal:ac.signal
    }).then(function(r){
      if(!r.ok || !r.body){ return r.text().then(function(t){ throw new Error('HTTP '+r.status+(t?': '+t:'')); }); }
      var reader=r.body.getReader(), dec=new TextDecoder(), buf='';
      function pump(){
        return reader.read().then(function(res){
          if(res.done){ finalize(); return; }
          buf+=dec.decode(res.value, {stream:true});
          var lines=buf.split('\n'); buf=lines.pop(); /* keep trailing partial line */
          lines.forEach(function(line){
            line=line.trim();
            if(line.indexOf('data:')!==0) return;
            var payload=line.slice(5).trim();
            if(payload==='' || payload==='[DONE]') return;
            try{ var chunk=JSON.parse(payload);
              if(chunk.error){ showError((chunk.error&&chunk.error.message)||chunk.error, chunk.error&&chunk.error.type); return; }
              var ch0=chunk.choices && chunk.choices[0];
              var delta=ch0 && ch0.delta;
              if(delta && delta.content){ onContent(delta.content); }
              if(ch0 && ch0.finish_reason){ lastFinish=ch0.finish_reason; } /* 'length' = backend truncated the answer */
              if(chunk.cloudling && chunk.cloudling.reactive_compaction){ serverCompacted=true; } /* server folded the overflowing context and retried */
              if(chunk.usage){ var pt=chunk.usage.prompt_tokens; if(activeId){ dlgToks[activeId]=pt; saveDlgToks(); } setCtxToks(pt); }
            }catch(e){ /* ignore keep-alives / partial chunks */ }
          });
          return pump();
        });
      }
      return pump();
    }).catch(function(err){
      if(err && err.name==='AbortError'){ return; } /* stop button owns the UI */
      if(errored){ finishGen(btn); maybeScroll(); return; } /* showError already painted the box — don't wipe it */
      liveAcc='';
      turn.classList.add('noconv'); /* error box has no convo entry — exclude from index math */
      /* Same as showError: keep any rendered tool calls / partial text, append the box below. */
      if(thinkingShown){ turn.innerHTML=errboxHTML(); }
      else { paintTurn(turn, acc, false); turn.insertAdjacentHTML('beforeend', errboxHTML()); }
      attachRetry(turn, btn);
      finishGen(btn); maybeScroll();
    }).then(function(){ if(currentAbort===ac) currentAbort=null; });
  }

  /* FLIP: morph the composer from its home (centered) rect down to the docked dialog rect.
     Manual transform via Web Animations — cross-browser (Firefox/Chrome/Safari/Edge). */
  function dockMorph(fromRect){
    var el=document.querySelector('#view-dialog .entry'); if(!el || !el.animate) return;
    var to=el.getBoundingClientRect();
    var dx=fromRect.left-to.left, dy=fromRect.top-to.top;
    var sx=to.width?fromRect.width/to.width:1, sy=to.height?fromRect.height/to.height:1;
    el.style.transformOrigin='0 0';
    var a=el.animate(
      [{transform:'translate('+dx+'px,'+dy+'px) scale('+sx+','+sy+')'},{transform:'none'}],
      {duration:300, easing:'cubic-bezier(.4,0,.2,1)'}
    );
    a.onfinish=function(){ el.style.transformOrigin=''; };
  }
  /* leaving home: dialog is already shown; lay home on top (out of flow) and fade its hero
     out while the docked composer takes over via the morph, then hide home. */
  function leaveHome(){
    var hero=viewHome.querySelector('.hero'), hcomp=viewHome.querySelector('.entry');
    if(!viewHome.animate || !hero){ viewHome.hidden=true; return; }
    if(hcomp) hcomp.style.visibility='hidden'; /* avoid a double composer during the morph */
    viewHome.style.position='absolute'; viewHome.style.inset='0'; viewHome.style.zIndex='1'; viewHome.style.pointerEvents='none';
    var a=hero.animate([{opacity:1, transform:'none'},{opacity:0, transform:'translateY(-12px)'}],{duration:220, easing:'ease-in'});
    a.onfinish=function(){
      viewHome.hidden=true;
      viewHome.style.position=''; viewHome.style.inset=''; viewHome.style.zIndex=''; viewHome.style.pointerEvents='';
      if(hcomp) hcomp.style.visibility='';
    };
  }

  /* `msg` is a string (text only) or {content:text, atts:[…]} when files are attached */
  function sendFlow(msg, btn){
    var isObj=(typeof msg==='object' && msg!==null);
    var dispText=isObj ? (msg.content||'') : msg;
    var entry=isObj ? {role:'user', content:(msg.content||''), atts:(msg.atts||[])} : {role:'user', content:msg};
    if(viewHome.hidden===false){ /* coming from home: start a real new dialog */
      var homeEntry=document.querySelector('#view-home .entry');
      var fromRect=homeEntry?homeEntry.getBoundingClientRect():null;
      activeId=genId();
      var title=(dispText||t('att.attachment')).slice(0,42);
      var it=sidebarItem({id:activeId, title:title, updated_ms:Date.now()}); it.classList.add('active');
      var firstItem=leftDrawer.querySelector('.item'); leftDrawer.insertBefore(it, firstItem || document.getElementById('emptyNone'));
      leftDrawer.querySelectorAll('.item').forEach(function(x){x.classList.toggle('active', x===it);});
      activeItem=it; dtitle.textContent=title; thread.innerHTML=''; convo=[]; setCtxToks(dlgToks[activeId]); refreshTaskbar();
      viewDlg.hidden=false; updateDialogList(); leaveHome();
      btn = dlgSend() || btn; /* we switched to the dialog view — drive stop/send on its (visible) button */
      if(fromRect) dockMorph(fromRect); /* slide the composer from center down into the dock */
      var dh=viewDlg.querySelector('.dhdr'); if(dh && dh.animate){ dh.animate([{opacity:0},{opacity:1}],{duration:260, easing:'ease-out'}); }
    }
    if(call){ entry.voice=call.noted?1:2; call.noted=true; } /* said in a voice dialog: see voiceNoted */
    convo.push(entry);
    saveActive(); /* persist now so the dialog exists even before the answer */
    generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
    var ut=userTurn(entry); thread.appendChild(ut); stick=true; toBottom();
    if(ut.animate){ ut.animate([{opacity:0, transform:'translateY(8px)'},{opacity:1, transform:'none'}],{duration:280, easing:'cubic-bezier(.4,0,.2,1)'}); }
    generate(btn);
  }

  function stopGen(btn){ genHookDone(); if(currentAbort){ currentAbort.abort(); currentAbort=null; } clearTimers(); generating=false; setSend(btn,false); setItemGenerating(activeItem,false);
    var th=thread.querySelector('.thinking'); if(th){ th.closest('.turn').remove(); liveAcc=''; return; }
    var turn=thread.querySelector('.turn.a:last-child'); if(!turn) return;
    /* the partial answer stays visible in the thread, so it must enter the history
       too — otherwise the turn↔convo mapping drifts and later regen/edit misalign */
    if(liveAcc.replace(/\s/g,'')){ convo.push({role:'assistant', content:liveAcc}); saveActive(); }
    liveAcc='';
    var c=turn.querySelector('.caret'); if(c) c.remove();
    /* stopped mid tool-call: freeze the running ripple into a neutral head */
    var rip=turn.querySelector('.tool .rip'); if(rip){ var head=turn.querySelector('.tool .head'); if(head){ var tag=head.querySelector('.tag'); var tname=tag?tag.textContent:t('tool.genericName'); head.innerHTML='<span class="tag">'+esc(tname)+'</span> · '+t('tool.stopped'); } }
    if(!turn.querySelector('.stopped')){ var s=document.createElement('div'); s.className='stopped'; s.innerHTML='⏹ '+t('chat.stopped'); turn.appendChild(s); }
    var mdbox=turn.querySelector('.md');
    var hasText=mdbox && mdbox.textContent.trim();
    /* regen on a stopped turn that produced answer text OR only reasoning (stopping a
       reasoning model mid-think leaves a reasoning block but no .md text — still regen-able) */
    if((hasText || turn.querySelector('.tool.reason, [type="reasoning"]')) && !turn.querySelector('.row-acts')){
      turn.insertAdjacentHTML('beforeend','<div class="row-acts">'+(hasText?actBtn('copy',t('common.copy'))+actBtn('speak',t('common.speak')):'')+actBtn('regen',t('common.regen'))+'</div>');
    }
    refreshTaskbar();
  }

  /* ---------- attachments ----------
     Accept any file. Classify into image / text / other:
       - image  → read as data URL, shown as a preview, sent as OpenAI {type:image_url}
       - text   → read as text, inlined into the message (the server extracts text parts)
       - other  → name+size chip only, sent as a "[file attached … — not inlined]" note
     The convo entry keeps the display text in `content` (string) and the attachments in
     `atts` (with the image data URL / file text), so persistence is free (saved in the
     transcript → survives F5) and outgoingMessages() assembles the OWUI content array. */
  var MAX_ATT=10*1024*1024; /* soft 10 MB/file cap (base64 images bloat the request/context) */
  /* dictation: speech needs little bitrate (keeps the upload small); one utterance is capped, a
     slip of the finger shorter than MIC_MIN_MS is not sent */
  var MIC_BITRATE=32000, MIC_MAX_MS=5*60*1000, MIC_MIN_MS=300, MIC_BARS=20;
  function micReady(){ return !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
  function recMime(){ var c=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'];
    for(var i=0;i<c.length;i++){ if(MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c[i])) return c[i]; } return ''; }
  function recClock(ms){ var sec=Math.floor(ms/1000); return Math.floor(sec/60)+':'+('0'+(sec%60)).slice(-2); }
  function levelBars(n){ var h=''; for(var i=0;i<n;i++){ h+='<i></i>'; } return h; }
  /* scrolling level bars: push a 0..1 level, the bars show the last `bars.length` of them */
  function paintLevel(bars, hist, lvl){
    hist.push(lvl); if(hist.length>bars.length) hist.shift();
    for(var k=0;k<bars.length;k++){ var h=hist[hist.length-bars.length+k];
      bars[k].style.height=(h===undefined?4:Math.round(4+h*18))+'px'; bars[k].style.opacity=(h===undefined?'':'1'); }
  }
  function rmsOf(an, buf){ an.getByteTimeDomainData(buf); var sum=0; for(var i=0;i<buf.length;i++){ var v=(buf[i]-128)/128; sum+=v*v; } return Math.sqrt(sum/buf.length); }
  /* the voice dialog needs both speech servers and a microphone the browser will hand out */
  function callAvailable(){ var b=document.body.classList; return b.contains('stt-on') && b.contains('tts-on') && micReady(); }
  var TEXT_EXT=/\.(txt|md|markdown|csv|tsv|json|jsonl|ya?ml|toml|ini|cfg|conf|log|xml|html?|css|js|jsx|mjs|cjs|ts|tsx|py|rs|go|java|c|h|cpp|hpp|cc|rb|php|sh|bash|zsh|sql|r|lua|pl|swift|kt|scala|dart|vue|svelte|tex|rst|env|gitignore|dockerfile|makefile|diff|patch)$/i;
  function humanSize(n){ if(n==null) return ''; if(n<1024) return n+' '+t('size.b'); if(n<1024*1024) return (n/1024).toFixed(n<10240?1:0)+' '+t('size.kb'); return (n/1048576).toFixed(1)+' '+t('size.mb'); }
  function fileKind(f){
    if(/^image\//.test(f.type||'')) return 'image';
    if(/^text\//.test(f.type||'') || /(json|xml|yaml|javascript|x-sh|x-python|csv|html)/.test(f.type||'') || TEXT_EXT.test(f.name||'')) return 'text';
    return 'file';
  }
  function readAsDataURL(f){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){res(r.result);}; r.onerror=rej; r.readAsDataURL(f); }); }
  function readAsText(f){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){res(r.result);}; r.onerror=rej; r.readAsText(f); }); }
  /* chip inner HTML shared by composer (removable) and bubble (static) */
  function attChipInner(att){
    if(att.kind==='image' && att.url) return '<img src="'+escAttr(att.url)+'" alt="'+escAttr(att.name||'')+'" />';
    return '<span class="ic">'+IC.doc+'</span><span class="nm">'+esc(att.name||t('att.fileFallback'))+'</span>'+(att.size!=null?'<span class="sz">'+humanSize(att.size)+'</span>':'');
  }
  function attChipHTML(att){ return '<div class="att-chip'+((att.kind==='image'&&att.url)?' img':'')+'">'+attChipInner(att)+'</div>'; }
  function attChipEl(att, onRemove){
    var c=document.createElement('div'); c.className='att-chip'+((att.kind==='image'&&att.url)?' img':'');
    c.innerHTML=attChipInner(att)+'<button class="rm" type="button" title="'+escAttr(t('common.remove'))+'" aria-label="'+escAttr(t('common.remove'))+'">✕</button>';
    if(onRemove) c.querySelector('.rm').addEventListener('click', onRemove);
    return c;
  }
  /* staged composer attachments → convo `atts` entries (image url / text content kept) */
  function stagedToAtts(pending){
    return pending.map(function(p){
      if(p.kind==='image' && p.url) return {kind:'image', name:p.name, size:p.size, url:p.url};
      if(p.kind==='text' && typeof p.text==='string') return {kind:'text', name:p.name, size:p.size, text:p.text};
      return {kind:'file', name:p.name, size:p.size};
    });
  }

  function wireComposer(scope){ var ta=scope.querySelector('textarea'); var btn=scope.querySelector('.send');
    var clip=scope.querySelector('.clip'); var atts=scope.querySelector('.attachments'); var input=scope.querySelector('.fileinput');
    var pending=[]; /* files staged for the next send (live data: image url / text content) */
    function refresh(){ paintSend(btn); }
    function renderPending(){ atts.innerHTML='';
      pending.forEach(function(att){ atts.appendChild(attChipEl(att, function(){ var i=pending.indexOf(att); if(i>=0) pending.splice(i,1); renderPending(); refresh(); })); });
    }
    function addFiles(files){ Array.prototype.slice.call(files||[]).forEach(function(f){
      if(f.size>MAX_ATT){ toast(t('att.tooBig',{name:(f.name||t('att.noName'))})); return; }
      /* Pasted screenshots often arrive without a name — give them one. */
      var name=f.name || ((f.type&&f.type.indexOf('image/')===0) ? (t('att.imageName')+'.'+(f.type.split('/')[1]||'png')) : t('att.pasteName'));
      var att={kind:fileKind(f), name:name, size:f.size};
      pending.push(att); renderPending(); refresh();
      if(att.kind==='image'){ readAsDataURL(f).then(function(u){ att.url=u; renderPending(); }).catch(function(){ var i=pending.indexOf(att); if(i>=0){ pending.splice(i,1); renderPending(); refresh(); } toast(t('att.readFail',{name:f.name})); }); }
      else if(att.kind==='text'){ readAsText(f).then(function(t){ att.text=t; }).catch(function(){ att.kind='file'; }); }
    }); }
    function trySend(){ if(btn.classList.contains('stop')) return; var v=(ta.value||'').trim(); if(!v && pending.length===0) return;
      var msg = pending.length ? {content:v, atts:stagedToAtts(pending)} : v;
      ta.value=''; pending=[]; renderPending(); refresh();
      if(call) callTyped(call); /* typed during a voice dialog: the answer is spoken all the same */
      sendFlow(msg, btn); }
    btn.addEventListener('click', function(){ if(btn.classList.contains('stop')){ if(call) callTap(); else stopGen(btn); return; } if(btn.classList.contains('call')){ startCall(); return; } trySend(); });
    ta.addEventListener('input', refresh);
    ta.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); trySend(); } });
    if(clip){ clip.addEventListener('click', function(){ if(input) input.click(); }); }
    if(input){ input.addEventListener('change', function(){ addFiles(input.files); input.value=''; }); }
    /* drag-and-drop onto the composer */
    scope.addEventListener('dragenter', function(e){ e.preventDefault(); scope.classList.add('dragover'); });
    scope.addEventListener('dragover', function(e){ e.preventDefault(); scope.classList.add('dragover'); });
    scope.addEventListener('dragleave', function(e){ if(!scope.contains(e.relatedTarget)) scope.classList.remove('dragover'); });
    scope.addEventListener('drop', function(e){ e.preventDefault(); scope.classList.remove('dragover'); if(e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
    /* paste files from the clipboard (e.g. screenshots / images via Ctrl+V).
       Only intercept when the clipboard actually carries files; plain-text paste
       is left to the textarea's default behaviour. */
    ta.addEventListener('paste', function(e){
      var cd=e.clipboardData; if(!cd) return;
      var files=[];
      if(cd.files && cd.files.length){ files=Array.prototype.slice.call(cd.files); }
      else if(cd.items){ Array.prototype.slice.call(cd.items).forEach(function(it){ if(it.kind==='file'){ var f=it.getAsFile(); if(f) files.push(f); } }); }
      if(files.length){ e.preventDefault(); addFiles(files); }
    });
    /* ---------- voice input: the microphone button ----------
       Record one utterance (MediaRecorder), with a timer and a level meter standing in for the
       text field, then POST the recording to /ui/transcribe and put the recognised text into
       the field (after anything already typed) for the user to check and send. «Cancel» (or
       Esc) drops the recording or the pending recognition. Browsers hand out the microphone only in a
       secure context (HTTPS or localhost): elsewhere the button stays but explains why. */
    var mic=scope.querySelector('.mic'), recTime=scope.querySelector('.rec-time'), recLevel=scope.querySelector('.rec-level'), recMsg=scope.querySelector('.rec-msg');
    var rec=null; /* the utterance in progress: {stream, recorder, chunks, ctx, raf, timer, started, cancelled, ctrl} */
    function recRelease(r){ /* let go of the microphone, the meter and the timer */
      if(r.timer){ clearInterval(r.timer); r.timer=null; }
      if(r.raf){ cancelAnimationFrame(r.raf); r.raf=null; }
      if(r.stream){ r.stream.getTracks().forEach(function(tr){ tr.stop(); }); r.stream=null; }
      if(r.ctx){ try{ r.ctx.close(); }catch(_){} r.ctx=null; }
    }
    function recEnd(r){ recRelease(r); if(rec===r){ rec=null; scope.classList.remove('recording','transcribing'); refresh(); } }
    function recMeter(r){ /* scrolling bars: one per ~70 ms, height = the loudest moment in it */
      var Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx || !recLevel) return;
      var bars=recLevel.children, an, buf;
      try{ r.ctx=new Ctx(); an=r.ctx.createAnalyser(); an.fftSize=512; r.ctx.createMediaStreamSource(r.stream).connect(an); buf=new Uint8Array(an.fftSize); }catch(_){ return; }
      var hist=[], last=0, peak=0;
      function draw(ts){
        if(rec!==r || !r.stream) return;
        r.raf=requestAnimationFrame(draw);
        peak=Math.max(peak, rmsOf(an, buf));
        if(ts-last<70) return;
        last=ts; paintLevel(bars, hist, Math.min(1, peak*4)); peak=0;
      }
      r.raf=requestAnimationFrame(draw);
    }
    function recStart(){
      if(rec) return;
      if(!window.isSecureContext){ toast(t('mic.insecure')); return; }
      if(!micReady()){ toast(t('mic.unsupported')); return; }
      var r={chunks:[], cancelled:false}; rec=r;
      navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}}).then(function(stream){
        if(rec!==r){ stream.getTracks().forEach(function(tr){ tr.stop(); }); return; }
        r.stream=stream;
        var mime=recMime(), opts={audioBitsPerSecond:MIC_BITRATE}; if(mime) opts.mimeType=mime;
        r.recorder=new MediaRecorder(stream, opts);
        r.recorder.ondataavailable=function(e){ if(e.data && e.data.size) r.chunks.push(e.data); };
        r.recorder.onstop=function(){ recFinish(r); };
        r.recorder.start();
        r.started=Date.now();
        if(recLevel){ Array.prototype.forEach.call(recLevel.children, function(b){ b.style.height=''; b.style.opacity=''; }); }
        if(recTime) recTime.textContent=recClock(0);
        if(recMsg) recMsg.textContent=t('mic.speak');
        scope.classList.add('recording');
        r.timer=setInterval(function(){ var ms=Date.now()-r.started; if(recTime) recTime.textContent=recClock(ms); if(ms>=MIC_MAX_MS) recStop(false); }, 250);
        recMeter(r);
      }).catch(function(err){
        recEnd(r);
        toast(t((err && (err.name==='NotAllowedError' || err.name==='SecurityError')) ? 'mic.denied' : 'mic.unsupported'));
      });
    }
    function recStop(cancel){
      var r=rec; if(!r) return;
      if(cancel) r.cancelled=true;
      if(r.ctrl){ if(cancel){ r.ctrl.abort(); recEnd(r); } return; } /* already transcribing */
      if(r.recorder && r.recorder.state!=='inactive'){ r.recorder.stop(); } /* → onstop → recFinish */
      else if(cancel){ recEnd(r); }
    }
    function recFinish(r){
      var took=Date.now()-(r.started||Date.now()), type=(r.recorder && r.recorder.mimeType)||'';
      recRelease(r);
      if(rec!==r) return;
      if(r.cancelled || !r.chunks.length || took<MIC_MIN_MS){ recEnd(r); return; }
      var blob=new Blob(r.chunks, {type:type}); r.chunks=[];
      scope.classList.remove('recording'); scope.classList.add('transcribing');
      if(recMsg) recMsg.textContent=t('mic.busy');
      r.ctrl=new AbortController();
      uiFetch('/ui/transcribe',{method:'POST', headers:{'Content-Type':blob.type||'application/octet-stream'}, body:blob, signal:r.ctrl.signal})
        .then(function(resp){ if(!resp.ok){ return resp.text().then(function(m){ throw new Error(m||('HTTP '+resp.status)); }); } return resp.json(); })
        .then(function(j){
          if(rec!==r) return;
          recEnd(r);
          var said=((j && j.text)||'').trim();
          if(!said){ toast(t('mic.empty')); return; }
          var typed=(ta.value||'').trim();
          ta.value=typed ? typed+' '+said : said;
          ta.dispatchEvent(new Event('input')); /* same path as typing: the Send button wakes up */
          ta.focus(); try{ ta.setSelectionRange(ta.value.length, ta.value.length); }catch(_){}
          ta.scrollTop=ta.scrollHeight;
        })
        .catch(function(err){
          if(rec!==r || (err && err.name==='AbortError')) return;
          recEnd(r); toast(t('mic.err',{msg:((err && err.message)||'')}));
        });
    }
    if(mic){
      if(recLevel) recLevel.innerHTML=levelBars(MIC_BARS);
      if(!micReady()) mic.classList.add('off');
      mic.addEventListener('click', recStart);
      scope.querySelector('.rec-cancel').addEventListener('click', function(){ recStop(true); });
      scope.querySelector('.rec-done').addEventListener('click', function(){ recStop(false); });
      document.addEventListener('keydown', function(e){ if(e.key==='Escape' && rec){ recStop(true); } });
    }
    refresh();
  }
  wireComposer(document.querySelector('#view-home .entry'));
  wireComposer(document.querySelector('#view-dialog .entry'));

  /* ---------- sidebar item click + kebab menu ---------- */
  var current=null;
  var menu=document.createElement('div'); menu.className='menu';
  menu.innerHTML='<button data-m="rename">'+IC.edit+t('common.rename')+'</button><button data-m="pin">'+IC.pin+'<span class="pin-label">'+t('menu.pin')+'</span></button><div class="sep"></div><button data-m="del" class="danger">'+IC.trash+t('common.delete')+'</button>';
  document.body.appendChild(menu);
  leftDrawer.addEventListener('click', function(e){
    var kb=e.target.closest('.kebab');
    if(kb){ e.stopPropagation(); current=kb.closest('.item');
      var r=kb.getBoundingClientRect(); menu.style.top=(r.bottom+6)+'px'; menu.style.left=Math.max(8, Math.min(r.right-176, window.innerWidth-184))+'px';
      menu.querySelector('.pin-label').textContent=current.classList.contains('pinned')?t('menu.unpin'):t('menu.pin'); menu.style.display='block'; return; }
    var it=e.target.closest('.item'); if(it && it.dataset.id){ openDialog(it.dataset.id, it); }
  });
  document.addEventListener('click', function(){ menu.style.display='none'; });
  menu.addEventListener('click', function(e){ var btn=e.target.closest('button'); if(!btn||!current) return; var m=btn.dataset.m;
    if(m==='rename'){ var item=current, t=current.querySelector('.t'); t.contentEditable='true'; t.classList.add('editing'); t.focus();
      t.addEventListener('blur', function(){ t.contentEditable='false'; t.classList.remove('editing'); var nv=(t.textContent||'').trim(), id=item.dataset.id;
        if(nv && id){ if(id===activeId){ dtitle.textContent=nv; apiSave(id,nv,convo); } else { apiGet(id).then(function(d){ apiSave(id, nv, d?d.messages:[]); }); } } },{once:true});
      t.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ev.preventDefault(); t.blur();} }); }
    else if(m==='pin'){ var pid=current.dataset.id; var willPin=!current.classList.contains('pinned'); current.classList.toggle('pinned', willPin); if(willPin){ dlgPins[pid]=1; } else { delete dlgPins[pid]; } savePins(); updateDialogList(); }
    else if(m==='del'){ askDelete(current); }
  });

  /* delete confirmation modal */
  var pendingDel=null, confirmScrim=document.getElementById('confirmScrim');
  function askDelete(item){ pendingDel=item; document.getElementById('confirmText').textContent=t('confirm.delBody',{title:item.querySelector('.t').textContent.trim()}); confirmScrim.hidden=false; }
  function closeConfirm(){ confirmScrim.hidden=true; pendingDel=null; }
  document.getElementById('confirmOk').addEventListener('click', function(){ if(pendingDel){ var wasActive=(pendingDel===activeItem); var id=pendingDel.dataset.id; if(id){ apiDelete(id); if(id in dlgToks){ delete dlgToks[id]; saveDlgToks(); } if(id in dlgErrs){ delete dlgErrs[id]; saveDlgErrs(); } if(id in dlgPins){ delete dlgPins[id]; savePins(); } } pendingDel.remove(); updateDialogList(); if(wasActive) newDialog(); } closeConfirm(); });
  document.getElementById('confirmCancel').addEventListener('click', closeConfirm);
  confirmScrim.addEventListener('click', function(e){ if(e.target===confirmScrim) closeConfirm(); });

  /* Esc closes the topmost overlay: confirm modal first, then an open drawer */
  document.addEventListener('keydown', function(e){ if(e.key!=='Escape') return;
    if(!confirmScrim.hidden){ closeConfirm(); return; }
    if(b.classList.contains('open-left')||b.classList.contains('open-right')){ closeDrawers(); }
  });

  /* ---------- thread interactions ---------- */
  function dlgSend(){ return document.querySelector('#view-dialog .send'); }
  /* regenerate: drop this answer (and anything after it) and re-run the turn */
  function regenTurn(turn){ if(generating) return;
    var idx=turnIndex(turn); if(idx<0) return;
    var btn=dlgSend(); if(!btn) return;
    /* drop this answer and everything after it, in both the thread and the history
       (convo index = position among real turns; DOM removal also sweeps error boxes) */
    removeTurnsFrom(turn, true);
    convo=convo.slice(0, idx); refreshTaskbar();
    generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
    generate(btn);
  }
  /* edit a user message: inline editor → on save, truncate after it and regenerate
     (mirrors how OWUI/real chat re-runs from an edited turn) */
  function editUserTurn(turn){ if(generating) return;
    var idx=turnIndex(turn); if(idx<0) return;
    var entry=convo[idx]; var bubble=turn.querySelector('.bubble'); if(!entry || !bubble) return;
    var orig=(typeof entry.content==='string')?entry.content:'';
    var rowacts=turn.querySelector('.row-acts');
    var ta=document.createElement('textarea'); ta.className='editbox'; ta.value=orig;
    var acts=document.createElement('div'); acts.className='editacts';
    acts.innerHTML='<button class="ecancel" type="button">'+t('common.cancel')+'</button><button class="esave" type="button">'+t('edit.saveSend')+'</button>';
    /* hide the bubble (it holds the attachment chips too) instead of replacing it,
       so Cancel restores text + attachments intact */
    bubble.style.display='none'; if(rowacts) rowacts.style.display='none';
    turn.appendChild(ta); turn.appendChild(acts);
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    function cancel(){ ta.remove(); acts.remove(); bubble.style.display=''; if(rowacts) rowacts.style.display=''; }
    function save(){ var nv=(ta.value||'').trim(); var keepAtts=entry.atts;
      if(!nv && (!keepAtts || !keepAtts.length)) nv=orig;
      var i=turnIndex(turn); if(i<0){ cancel(); return; }
      /* keep the edited user turn (text + its attachments), drop everything after, rerun */
      removeTurnsFrom(turn, true);
      convo=convo.slice(0, i); convo.push((keepAtts&&keepAtts.length) ? {role:'user', content:nv, atts:keepAtts} : {role:'user', content:nv}); refreshTaskbar();
      var fresh=userTurn(convo[i]); thread.appendChild(fresh);
      if(fresh.animate){ fresh.animate([{opacity:0, transform:'translateY(8px)'},{opacity:1, transform:'none'}],{duration:240, easing:'cubic-bezier(.4,0,.2,1)'}); }
      var btn=dlgSend(); if(!btn) return;
      generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
      stick=true; toBottom(); generate(btn);
    }
    acts.querySelector('.ecancel').onclick=cancel;
    acts.querySelector('.esave').onclick=save;
    ta.addEventListener('keydown', function(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); save(); } else if(e.key==='Escape'){ e.preventDefault(); cancel(); } });
  }
  thread.addEventListener('click', function(e){
    var cp=e.target.closest('.code .copy'); if(cp){ copyText(cp.closest('.code').querySelector('pre').textContent, cp); return; }
    var a=e.target.closest('.act'); if(!a) return; var act=a.dataset.act, turn=a.closest('.turn');
    if(act==='copy'){
      /* Assistant answers split into several .md blocks around tool plates. Copy rich (HTML) +
         markdown source: HTML from the rendered blocks (code-block chrome stripped so the inline
         "Копировать" button/lang label don't leak into the paste), plain = the raw markdown with
         tool/reasoning blocks removed. User turns have no .md → plain bubble text. */
      var mds=turn.querySelectorAll('.md');
      if(mds.length){
        var tmp=document.createElement('div');
        Array.prototype.forEach.call(mds,function(b){ var c=b.cloneNode(true);
          Array.prototype.forEach.call(c.querySelectorAll('.chead'),function(h){h.remove();}); tmp.appendChild(c); });
        var html=tmp.innerHTML;
        var idx=turnIndex(turn), raw=(idx>=0 && convo[idx] && typeof convo[idx].content==='string')?convo[idx].content:'';
        var plain = raw ? raw.replace(BLOCK_RE,'').replace(/\n{3,}/g,'\n\n').trim()
                        : Array.prototype.map.call(mds,function(b){return b.textContent;}).join('\n\n').replace(/\n{3,}/g,'\n\n').trim();
        copyRich(html, plain, a);
      } else {
        copyText((turn.querySelector('.bubble')||{textContent:''}).textContent, a);
      }
    }
    else if(act==='speak'){ speakTurn(turn, a); }
    else if(act==='regen'){ regenTurn(turn); }
    else if(act==='edit'){ editUserTurn(turn); }
  });

  /* ---------- voice output: «Озвучить» under an answer ----------
     POST /ui/speak streams raw 16-bit mono PCM (rate in the Content-Type) while the server
     cuts the message into pieces and the TTS backend synthesises them; each arriving chunk is
     scheduled right after the previous one, so playback starts on the first chunk. One message
     speaks at a time: another «Озвучить», a new question or switching the dialog stops it. */
  var speech=null; /* {ctrl, ctx, btn, turn} of the message being spoken */
  function setSpeakBtn(btn, on){
    btn.innerHTML=on?IC.stopSpeak:IC.speak; var l=t(on?'common.stopSpeak':'common.speak');
    btn.title=l; btn.setAttribute('aria-label', l); btn.classList.toggle('on', on);
  }
  function stopSpeech(){
    if(!speech) return; var s=speech; speech=null;
    try{ s.ctrl.abort(); }catch(_){} try{ s.ctx.close(); }catch(_){}
    setSpeakBtn(s.btn, false); s.turn.classList.remove('speaking');
  }
  function speakErr(turn, msg){
    var old=turn.querySelector('.note.speakerr'); if(old) old.remove();
    var acts=turn.querySelector('.row-acts'); if(!acts) return;
    acts.insertAdjacentHTML('afterend','<div class="note trunc speakerr">'+IC.warn+esc(String(msg||''))+'</div>');
  }
  /* Play a /ui/speak* answer: raw 16-bit mono PCM (rate in the Content-Type), each arriving
     chunk scheduled on `ctx` right after the previous one. Reading stops when alive() turns
     false. `out` is the node to play into (default: the speakers), `nodes` collects the
     scheduled sources so the caller can cut them off. Resolves with the ctx time at which the
     scheduled audio ends. */
  function playPcm(r, ctx, alive, out, nodes){
    var m=(r.headers.get('content-type')||'').match(/rate=(\d+)/), rate=m?parseInt(m[1],10):24000;
    var reader=r.body.getReader(), next=0, carry=null;
    function pump(){
      return reader.read().then(function(res){
        if(!alive()){ try{ reader.cancel(); }catch(_){} return next; } /* stopped meanwhile */
        if(res.done) return next;
        var bytes=res.value;
        if(carry){ var j=new Uint8Array(carry.length+bytes.length); j.set(carry); j.set(bytes, carry.length); bytes=j; carry=null; }
        if(bytes.length%2){ carry=bytes.slice(bytes.length-1); bytes=bytes.subarray(0, bytes.length-1); } /* 16-bit samples may straddle chunks */
        if(bytes.length){
          var i16=new Int16Array(bytes.slice().buffer), f32=new Float32Array(i16.length);
          for(var i=0;i<i16.length;i++) f32[i]=i16[i]/32768;
          var buf=ctx.createBuffer(1, f32.length, rate); buf.copyToChannel(f32, 0);
          var src=ctx.createBufferSource(); src.buffer=buf; src.connect(out||ctx.destination);
          var now=ctx.currentTime; if(next<now+0.05) next=now+0.05;
          src.start(next); next+=buf.duration;
          if(nodes) nodes.push(src);
        }
        return pump();
      });
    }
    return pump();
  }
  function speakTurn(turn, btn){
    if(speech && speech.btn===btn){ stopSpeech(); return; }
    stopSpeech();
    var idx=turnIndex(turn), raw=(idx>=0 && convo[idx] && typeof convo[idx].content==='string')?convo[idx].content:'';
    var Ctx=window.AudioContext||window.webkitAudioContext; if(!raw || !Ctx) return;
    var old=turn.querySelector('.note.speakerr'); if(old) old.remove();
    var s={ctrl:new AbortController(), ctx:new Ctx(), btn:btn, turn:turn}; /* created on the click: autoplay policy */
    speech=s; setSpeakBtn(btn, true); turn.classList.add('speaking');
    uiFetch('/ui/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:raw}),signal:s.ctrl.signal})
      .then(function(r){
        if(!r.ok || !r.body){ return r.text().then(function(m){ throw new Error(m||('HTTP '+r.status)); }); }
        return playPcm(r, s.ctx, function(){ return speech===s; }).then(function(end){
          /* all audio is scheduled — release the button when it has played out */
          if(speech===s) setTimeout(function(){ if(speech===s) stopSpeech(); }, Math.max(0, end-s.ctx.currentTime)*1000+150);
        });
      })
      .catch(function(err){
        if(err && err.name==='AbortError') return;
        if(speech===s){ stopSpeech(); speakErr(turn, (err&&err.message)||err); }
      });
  }

  /* ---------- settings «Основное»: load active values, save + self-restart ---------- */
  /* ---------- voice dialog ----------
     A spoken conversation in a loop: listen → (a pause, or a tap on the cloud) → recognise →
     send as an ordinary message → the answer is spoken while it is being written → listen
     again. The microphone stays open for the whole dialog; one utterance is recorded at a time
     and goes through the same /ui/transcribe as dictation. An utterance starts only with
     a voice (see callVoicedness) and ends with a pause — both found right here, in the browser, so
     any STT server will do. The answer goes to /ui/speak/live:
     the server cuts and speaks it sentence by sentence while the text is still arriving. What
     was said and answered are ordinary messages of the dialog. */
  var CALL_SILENCE_MS=1000,  /* this much quiet after speech ends the utterance */
      CALL_SPEECH_MS=150,    /* this much voice counts as the start of speech (a knock or a click is shorter) */
      CALL_RESTART_MS=3000,  /* while nobody speaks the recording is restarted, so an utterance never drags a long silence along */
      CALL_MIN_LEVEL=0.012,  /* loudness (RMS, 0..1) below which nothing is speech */
      CALL_OVER_NOISE=2.5,   /* speech must be this many times louder than the room */
      CALL_PUSH_MS=120,      /* how often the growing answer is passed on to the speaker */
      CALL_BARGE_MS=250,     /* this much voice over the answer interrupts it */
      CALL_BARGE_OVER=2,     /* ...and it must be this many times louder than a voice that starts an utterance */
      CALL_VOICE_HZ=[80,400], /* the pitch of a human voice */
      CALL_VOICE_RATE=8000,  /* the sound is thinned out to about this rate before the pitch is looked for */
      CALL_VOICED_MIN=0.5,   /* how regular (0..1) a sound must be to count as a voice */
      CALL_VOICE_LEVEL=0.004, /* loudness (RMS) below which even a voice is not listened to */
      CALL_VOICE_OVER=1.3,   /* a voice needs to be only this many times louder than the room: it is told by its pitch, not by its loudness */
      CALL_EARLY_MS=350,     /* this far into a pause the utterance is sent to be recognised, in case the pause is its end */
      CALL_LIVE_CHUNK_MS=300, /* the recorder hands its data over this often, so an unfinished utterance can be recognised */
      CALL_LIVE_MS=600,      /* pause between two recognitions of an unfinished utterance */
      CALL_LIVE_QUIET_MS=350, /* none once the speaker has been quiet this long: the final one is about to start */
      CALL_LIVE_MAX_MS=45000; /* ...and none for an utterance longer than this (each pass re-reads all of it) */
  var CALL_STYLE_NOTE='[Voice conversation: this message was dictated, and your reply text will be read aloud by a speech synthesizer. Just answer in plain text as usual - no tool is needed to deliver the reply. Answer the way people talk: short and to the point, usually one to three sentences, in the user\'s language. No lists, headings, tables, code or other markup; write numbers and units out in words. Give details only when asked.]';
  var CALL_STYLE_SHORT='[Voice conversation: dictated, the reply is read aloud. Answer briefly in plain spoken text - no markup, no tool to deliver it.]';
  /* dialog preferences (ui_kv, all default ON): let the model reason before answering; let the
     user's voice interrupt the answer; show the words while they are being said */
  var callPrefs={reasoning:true, barge:true, live:true};
  [['callReason','call_reasoning','reasoning'],['callBarge','call_barge','barge'],['callLive','call_live','live']].forEach(function(p){
    var sel=document.getElementById(p[0]); if(!sel) return;
    uiFetch('/ui/kv/'+p[1]).then(function(r){ return r.ok?r.json():null; }).then(function(d){
      if(d && d.value==='false'){ sel.checked=false; callPrefs[p[2]]=false; }
    }).catch(function(){});
    sel.addEventListener('change', function(){
      callPrefs[p[2]]=sel.checked;
      uiFetch('/ui/kv/'+p[1],{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:sel.checked?'true':'false'})}).catch(function(){});
    });
  });
  var call=null; /* {state, stream, ctx, an, outAn, rec, spk, ...} while a dialog is on */
  function callEach(sel, fn){ document.querySelectorAll(sel).forEach(fn); }
  function callStatus(c){ return t((c.muted && c.state==='listening') ? 'call.muted' : 'call.'+c.state); }
  function callSetState(c, state){
    c.state=state; document.body.setAttribute('data-call', state);
    callEach('.call-status', function(el){ el.textContent=callStatus(c); });
    var l=t((state==='thinking' || state==='speaking')?'call.tapStop':'call.tapDone'); /* what a tap on the cloud does now */
    callEach('.call-tap', function(b){ b.title=l; b.setAttribute('aria-label', l); });
    if(state==='listening'){
      callEach('.cs-feed', function(el){ el.classList.remove('on'); }); /* the answer is over: its actions fold away */
      if(c.muted) callHeardText(t('call.mutedNote'), false);
    }
  }
  /* The microphone button. While it is off nothing is recorded or recognised and a voice cannot
     interrupt the answer; an utterance cut short by it is dropped. The answer itself goes on. */
  function callPaintMute(c){
    var off=!!c.muted, l=t(off?'call.unmute':'call.mute');
    document.body.classList.toggle('call-muted', off);
    callEach('.call-mute', function(b){ b.innerHTML=off?IC.callMicOff:IC.callMic; b.title=l; b.setAttribute('aria-label', l); b.setAttribute('aria-pressed', off?'true':'false'); });
    callEach('.call-status', function(el){ el.textContent=callStatus(c); });
  }
  function callMute(){
    var c=call; if(!c || !c.stream) return;
    c.muted=!c.muted;
    c.stream.getAudioTracks().forEach(function(tr){ tr.enabled=!c.muted; });
    if(c.muted){
      callRecStop(c, false); c.speech=false; c.loudMs=0; c.quietMs=0; c.bargeMs=0;
      if(c.state==='listening') callHeardText(t('call.mutedNote'), false);
    } else if(c.state==='listening'){ callHeardText('', false); callRecStart(c); }
    else if(c.state==='speaking' && callPrefs.barge){ c.bargeMs=0; callRecStart(c); }
    callPaintMute(c);
  }
  /* Is it a voice? A voice has a pitch: its sound repeats itself 80–400 times a second, while a
     knock, a click, a rustle or a hiss does not. The measure is how well the last few hundredths
     of a second match themselves shifted by one such period (normalised autocorrelation, 0..1);
     only a peak inside the range counts, so a slow thump or a hum below it is not taken for one.
     A steady tone (a beep, a whistle) does pass — it is as regular as a voice. */
  function callVoicedness(buf, rate){
    var k=Math.max(1, Math.round(rate/CALL_VOICE_RATE)), n=Math.floor(buf.length/k), x=new Float32Array(n), i, j, s, mean=0;
    for(i=0;i<n;i++){ s=0; for(j=0;j<k;j++) s+=buf[i*k+j]; x[i]=s/k; mean+=x[i]; }
    mean/=n; for(i=0;i<n;i++) x[i]-=mean;
    var r=rate/k, lo=Math.max(2, Math.floor(r/CALL_VOICE_HZ[1])), hi=Math.min((n>>1)-1, Math.ceil(r/CALL_VOICE_HZ[0])), best=0, prev=0, cur=0, next;
    for(var lag=lo-1; lag<=hi+1; lag++){
      var ab=0, aa=0, bb=0;
      for(i=0;i+lag<n;i++){ ab+=x[i]*x[i+lag]; aa+=x[i]*x[i]; bb+=x[i+lag]*x[i+lag]; }
      next=(aa>0 && bb>0) ? ab/Math.sqrt(aa*bb) : 0;
      if(lag>lo && cur>=prev && cur>next && cur>best) best=cur; /* a peak inside the range, not its edge */
      prev=cur; cur=next;
    }
    return best;
  }
  function callIsVoice(c){ c.van.getFloatTimeDomainData(c.vbuf); return callVoicedness(c.vbuf, c.ctx.sampleRate)>=CALL_VOICED_MIN; }
  function callRecStart(c){
    if(c.rec) callRecStop(c, false);
    if(c.muted) return; /* the microphone is off */
    var chunks=[], mime=recMime(), opts={audioBitsPerSecond:MIC_BITRATE}; if(mime) opts.mimeType=mime;
    var r=new MediaRecorder(c.stream, opts);
    r.ondataavailable=function(e){ if(e.data && e.data.size) chunks.push(e.data); if(r.earlyDue){ r.earlyDue=false; callEarly(c, r); } };
    r.onstop=function(){ if(r.keep && call===c) callHeard(c, new Blob(chunks, {type:r.mimeType||''}), r.early); };
    r.parts=chunks; r.start(CALL_LIVE_CHUNK_MS);
    c.rec=r; c.recAt=performance.now(); c.speech=false; c.loudMs=0; c.quietMs=0;
  }
  /* A pause may be the end of the utterance: it is sent to be recognised while the pause is still
     being waited out, so the text is ready the moment the utterance is declared over. If the
     speaker goes on, the answer is thrown away (callEarlyDrop) and the whole is recognised later. */
  function callEarly(c, r){
    if(call!==c || c.rec!==r || !c.speech || r.early || !r.parts.length) return;
    var ctrl=new AbortController(), blob=new Blob(r.parts.slice(), {type:r.mimeType||''});
    r.early={ctrl:ctrl, p:uiFetch('/ui/transcribe',{method:'POST', headers:{'Content-Type':blob.type||'application/octet-stream'}, body:blob, signal:ctrl.signal})
      .then(function(resp){ return resp.ok?resp.json():null; }).catch(function(){ return null; })};
  }
  function callEarlyDrop(r){ if(!r) return; r.earlyDue=false; if(r.early){ try{ r.early.ctrl.abort(); }catch(_){} r.early=null; } }
  function callRecStop(c, keep){ var r=c.rec; c.rec=null; if(r && r.state!=='inactive'){ r.keep=!!keep; try{ r.stop(); }catch(_){} } }
  function callListen(c){ if(call!==c) return; callSetState(c, 'listening'); callRecStart(c); }
  /* what the user said — or, live, is saying right now — on the dialog screen (the end of a long text stays in view) */
  function callHeardText(text, live){
    callEach('.cs-heard', function(el){ el.textContent=text; el.classList.toggle('live', !!live); el.scrollTop=el.scrollHeight; });
  }
  /* Words while you speak: during an utterance the recording so far is recognised again and
     again through the same /ui/transcribe (a recording cut short is still a recording, so any
     STT server will do), and the text is shown on the dialog screen. One request at a time,
     and none once the speaker has paused — the final recognition is about to start and should
     not queue behind a partial one. A failed pass is simply skipped. */
  function callLive(c, ts){
    var r=c.rec;
    if(!callPrefs.live || !r || !r.parts || !c.speech || c.liveBusy || c.quietMs>CALL_LIVE_QUIET_MS) return;
    if(ts-(c.liveAt||0)<CALL_LIVE_MS || ts-c.recAt>CALL_LIVE_MAX_MS) return;
    var n=r.parts.length; if(!n || n===r.liveN) return;
    r.liveN=n; c.liveBusy=true;
    var blob=new Blob(r.parts.slice(0, n), {type:r.mimeType||''});
    uiFetch('/ui/transcribe',{method:'POST', headers:{'Content-Type':blob.type||'application/octet-stream'}, body:blob})
      .then(function(resp){ return resp.ok?resp.json():null; })
      .then(function(j){
        var said=((j && j.text)||'').trim();
        if(said && call===c && c.rec===r && c.state==='listening') callHeardText(said, true);
      })
      .catch(function(){})
      .then(function(){ c.liveBusy=false; c.liveAt=performance.now(); });
  }
  function callUtterance(c){ if(call!==c || c.state!=='listening' || !c.speech) return; callSetState(c, 'transcribing'); callRecStop(c, true); }
  /* The living cloud of the dialog: the drops of the «thinking» cloud, moved by script so that
     they can follow a voice. Quiet — gathered and slow; the louder the voice (the user's while
     listening, the answer's while speaking), the faster and wider the drops swing and the bigger
     the cloud. Thinking is the familiar steady churn (same paths and periods as `.cloud`). */
  var CALL_DROPS=[{a:[-6,-3], b:[4,3], per:2.4}, {a:[6,-3], b:[-5,3], per:2.7}, {a:[2,5], b:[-3,-5], per:2.1}];
  var CALL_VIZ_QUIET={amp:0.45, speed:0.6},  /* swing (share of the full path) and tempo in silence */
      CALL_VIZ_LOUD={amp:1.1, speed:4, scale:1.2}, /* ...and at full voice */
      CALL_MIC_SPAN=4, CALL_OUT_GAIN=5;      /* the microphone is at full swing this many voice lines above the line (so a quiet speaker moves the cloud too); the answer: loudness (RMS) → 0..1 */
  var CALL_CALM=!!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function callVizInit(c){
    c.viz=[]; callEach('.callviz', function(svg){ c.viz.push({svg:svg, drops:[svg.querySelector('.x1'), svg.querySelector('.x2'), svg.querySelector('.x3')]}); });
    c.vz={lv:0, amp:CALL_VIZ_QUIET.amp, speed:CALL_VIZ_QUIET.speed, scale:1, ph:[0,0,0]};
  }
  function callVizFrame(c, dt, level){
    var v=c.vz; if(!v) return;
    var voiced=(c.state==='listening' || c.state==='speaking'), target=voiced?Math.max(0, Math.min(1, level)):0;
    v.lv+=(target-v.lv)*(1-Math.exp(-dt/(target>v.lv?70:260))); /* quick to rise, slow to settle */
    var amp=1, speed=1, scale=1;
    if(voiced){
      amp=CALL_VIZ_QUIET.amp+(CALL_VIZ_LOUD.amp-CALL_VIZ_QUIET.amp)*v.lv;
      speed=CALL_VIZ_QUIET.speed+(CALL_VIZ_LOUD.speed-CALL_VIZ_QUIET.speed)*v.lv;
      scale=1+(CALL_VIZ_LOUD.scale-1)*v.lv;
    }
    if(CALL_CALM){ amp=Math.min(amp, CALL_VIZ_QUIET.amp); speed=Math.min(speed, CALL_VIZ_QUIET.speed); scale=1; }
    var k=1-Math.exp(-dt/180);
    v.amp+=(amp-v.amp)*k; v.speed+=(speed-v.speed)*k; v.scale+=(scale-v.scale)*k;
    var pos=CALL_DROPS.map(function(d, i){
      v.ph[i]+=dt/1000*v.speed*2*Math.PI/d.per;
      var w=Math.cos(v.ph[i])*v.amp;
      return 'translate('+((d.a[0]+d.b[0])/2+(d.a[0]-d.b[0])/2*w).toFixed(2)+' '+((d.a[1]+d.b[1])/2+(d.a[1]-d.b[1])/2*w).toFixed(2)+')';
    });
    var sc='scale('+v.scale.toFixed(3)+')';
    c.viz.forEach(function(z){ z.svg.style.transform=sc; z.drops.forEach(function(el, i){ if(el) el.setAttribute('transform', pos[i]); }); });
  }
  /* «What the agent is doing»: the tools the answer has called so far, the latest few */
  var CALL_FEED_MAX=4, CALL_FEED_HINT=['query','command','url','file_path','path','pattern','description','prompt'];
  function callFeed(c, acc){
    var re=new RegExp(BLOCK_RE.source, 'g'), m, items=[];
    while((m=re.exec(acc||''))){
      if(m[1]!=='tool_calls') continue;
      var name=(m[2].match(/\bname="([^"]*)"/)||[])[1]||''; if(!name || name==='TodoWrite') continue;
      var hint='';
      try{ var a=JSON.parse(decodeEntities((m[2].match(/\barguments="([^"]*)"/)||[])[1]||'{}'));
        if(a && typeof a==='object'){
          for(var i=0;i<CALL_FEED_HINT.length && !hint;i++){ if(typeof a[CALL_FEED_HINT[i]]==='string') hint=a[CALL_FEED_HINT[i]]; }
          if(!hint){ for(var key in a){ if(typeof a[key]==='string'){ hint=a[key]; break; } } }
        } }catch(_){}
      items.push({name:name, hint:hint.replace(/\s+/g,' ').trim().slice(0,160), bad:/<summary>Tool Failed<\/summary>/.test(m[3])});
    }
    if(items.length===c.feedN) return;
    c.feedN=items.length;
    var html=items.slice(-CALL_FEED_MAX).map(function(it){
      return '<div class="cs-act'+(it.bad?' bad':'')+'">'+(it.bad?IC.warn:IC.callDone)+'<span>'+esc(it.name)+(it.hint?': '+esc(it.hint):'')+'</span></div>'; }).join('');
    callEach('.cs-feed', function(el){ el.classList.toggle('on', items.length>0); });
    if(items.length) callEach('.cs-feed-list', function(el){ el.innerHTML=html; }); /* an emptied list keeps its lines while it folds away */
  }
  /* the dialog's own screen, or — folded — the card over the ordinary chat */
  function callFold(min){ if(call) document.body.classList.toggle('call-min', !!min); }
  /* one frame of the dialog: the cloud and, while listening, the end-of-utterance watch */
  function callFrame(c, ts){
    if(call!==c) return;
    c.raf=requestAnimationFrame(function(t2){ callFrame(c, t2); });
    var dt=Math.min(100, ts-(c.frameAt||ts)); c.frameAt=ts;
    var rms=rmsOf(c.an, c.buf), shown=0; /* shown: how loud the answer is right now */
    var gate=Math.max(CALL_MIN_LEVEL, c.noise*CALL_OVER_NOISE), /* quieter than this is the room... */
        vgate=Math.max(CALL_VOICE_LEVEL, c.noise*CALL_VOICE_OVER); /* ...unless it is a voice: a quiet speaker stays well below the first line */
    if(c.state==='listening' && !c.muted){
      var loud=rms>gate, pitched=callIsVoice(c), voice=pitched && rms>vgate;
      if(ts<c.calUntil){ c.noise=c.noise*0.9+rms*0.1; } /* the first half a second only measures the room, hum and all */
      else if(c.speech){ /* inside an utterance its consonants and breaths have no pitch: a pause is neither a voice nor a loud sound */
        if(loud || voice){ c.quietMs=0; callEarlyDrop(c.rec); }
        else {
          var was=c.quietMs; c.quietMs+=dt;
          if(was<CALL_EARLY_MS && c.quietMs>=CALL_EARLY_MS && c.rec && c.rec.state==='recording'){ c.rec.earlyDue=true; try{ c.rec.requestData(); }catch(_){ c.rec.earlyDue=false; } }
          if(c.quietMs>=CALL_SILENCE_MS) callUtterance(c);
        }
      } else if(voice){
        c.loudMs+=dt; if(c.loudMs>=CALL_SPEECH_MS){ c.speech=true; c.quietMs=0; }
        c.noise=c.noise*0.999+rms*0.001; /* a hum that never stops has a pitch too: very slowly it becomes the room */
      } else {
        c.loudMs=Math.max(0, c.loudMs-dt); /* a gap between syllables does not start the count over */
        if(pitched) c.noise=c.noise*0.999+rms*0.001; /* a voice too quiet to count is still not the room: it must not raise the line it has to cross */
        else if(!loud) c.noise=c.noise*0.97+rms*0.03; /* the room, as heard between utterances */
        else if(!c.loudMs) c.noise=c.noise*0.995+rms*0.005; /* a lasting noise that is not a voice slowly becomes the room too */
        if(!loud && !c.loudMs && ts-c.recAt>CALL_RESTART_MS){ callRecStop(c, false); callRecStart(c); } /* only in quiet: a restart in the middle of a sound could cut off the first consonant of a phrase */
      }
      callLive(c, ts);
    } else if(c.state==='speaking'){
      shown=rmsOf(c.outAn, c.outBuf);
      if(callPrefs.barge && c.rec){ /* the user talks over the answer → it stops, and what they are saying is the next utterance */
        if(rms>vgate*CALL_BARGE_OVER && callIsVoice(c)){ c.bargeMs=(c.bargeMs||0)+dt; if(c.bargeMs>=CALL_BARGE_MS) callBarge(c); }
        else { c.bargeMs=Math.max(0, (c.bargeMs||0)-dt); if(!c.bargeMs && ts-c.recAt>CALL_RESTART_MS) callRecStart(c); }
      }
    }
    callVizFrame(c, dt, c.state==='listening' ? (c.muted ? 0 : Math.max(0, rms-vgate)/(vgate*CALL_MIC_SPAN)) : shown*CALL_OUT_GAIN);
  }
  /* The backend keeps the prompt it has just read, and reading ours (system prompt, tools, the
     dialog so far) takes seconds when something else was asked in between. So the reading starts
     with the dialog, not with the first utterance: a request with the same beginning, dropped as
     soon as its answer starts to arrive — by then the prompt has been read. */
  function callWarm(){
    if(generating) return;
    var msgs=outgoingMessages(viewHome.hidden===false);
    if(!msgs.length || msgs[msgs.length-1].role!=='user') msgs.push({role:'user', content:'.'});
    var body={model:'claw', stream:true, messages:msgs}; if(!callPrefs.reasoning) body.reasoning_effort='none';
    var ctrl=new AbortController(), dec=new TextDecoder();
    fetch('/v1/chat/completions', {method:'POST', headers:{'Content-Type':'application/json','X-Cloudling-UI':'1'}, body:JSON.stringify(body), signal:ctrl.signal})
      .then(function(r){
        if(!r.ok || !r.body) return;
        var rd=r.body.getReader();
        return (function pump(){ return rd.read().then(function(x){
          if(x.done) return;
          if(/"content":"[^"]/.test(dec.decode(x.value, {stream:true}))){ ctrl.abort(); return; }
          return pump(); }); })();
      }).catch(function(){});
  }
  function startCall(){
    if(call || generating || !callAvailable()) return;
    var Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return;
    stopSpeech();
    var c={state:'', noise:0.004, started:Date.now(), ctx:new Ctx()}; call=c; /* the context is created on the click: autoplay policy */
    navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}}).then(function(stream){
      if(call!==c){ stream.getTracks().forEach(function(tr){ tr.stop(); }); return; }
      c.stream=stream;
      try{ c.ctx.resume(); }catch(_){}
      c.an=c.ctx.createAnalyser(); c.an.fftSize=512; c.buf=new Uint8Array(c.an.fftSize);
      c.van=c.ctx.createAnalyser(); c.van.fftSize=2048; c.vbuf=new Float32Array(c.van.fftSize); /* a longer look, for the pitch */
      var src=c.ctx.createMediaStreamSource(stream); src.connect(c.an); src.connect(c.van); /* the microphone is only measured, never played back */
      c.outAn=c.ctx.createAnalyser(); c.outAn.fftSize=512; c.outBuf=new Uint8Array(c.outAn.fftSize);
      c.outAn.connect(c.ctx.destination); /* the answer plays through this node, so its level can be shown */
      callVizInit(c); c.feedN=-1; callFeed(c, ''); callHeardText('', false); callPaintMute(c);
      callEach('.call-time', function(el){ el.textContent=recClock(0); });
      c.clock=setInterval(function(){ var txt=recClock(Date.now()-c.started); callEach('.call-time', function(el){ el.textContent=txt; }); }, 500);
      document.body.classList.remove('call-min'); document.body.classList.add('in-call'); /* the dialog opens on its own screen */
      document.querySelectorAll('.entry .send').forEach(paintSend);
      c.calUntil=performance.now()+500;
      callWarm();
      callListen(c);
      c.raf=requestAnimationFrame(function(ts){ callFrame(c, ts); });
    }).catch(function(err){
      if(call===c) endCall();
      toast(t((err && (err.name==='NotAllowedError' || err.name==='SecurityError')) ? 'mic.denied' : 'mic.unsupported'));
    });
  }
  /* an utterance was recorded: recognise it and send it as a message */
  function callHeard(c, blob, early){
    if(!blob.size){ callListen(c); return; }
    function whole(){
      c.ctrl=new AbortController();
      return uiFetch('/ui/transcribe',{method:'POST', headers:{'Content-Type':blob.type||'application/octet-stream'}, body:blob, signal:c.ctrl.signal})
        .then(function(resp){ if(!resp.ok){ return resp.text().then(function(m){ throw new Error(m||('HTTP '+resp.status)); }); } return resp.json(); });
    }
    /* recognised ahead, during the pause (callEarly): nothing was said since, so that text is the utterance */
    (early ? early.p.then(function(j){ return (j && call===c) ? j : whole(); }) : whole())
      .then(function(j){
        if(call!==c) return;
        c.ctrl=null;
        var said=((j && j.text)||'').trim();
        if(!said || generating){ callListen(c); return; } /* a cough, a noise: keep listening */
        callSay(c, said);
      })
      .catch(function(err){
        if(call!==c || (err && err.name==='AbortError')) return;
        c.ctrl=null; toast(t('mic.err',{msg:((err && err.message)||'')})); callListen(c);
      });
  }
  /* speak the answer to the message about to be sent, while it is being written */
  function callAnswer(c){
    c.feedN=-1; callFeed(c, '');
    var spk={id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,8), ctrl:new AbortController(), nodes:[], text:'', sent:-1, over:false, audioOver:false};
    c.spk=spk; callSetState(c, 'thinking');
    function live(){ return call===c && c.spk===spk; }
    function push(done, tries){
      if(!live()) return;
      spk.sent=spk.text.length;
      uiFetch('/ui/speak/push',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:spk.id, text:spk.text, done:!!done})})
        .then(function(r){ /* the session may not be open yet when the very first text arrives — the final text is retried */
          if(done && r.status===404 && !spk.audioOver && (tries||0)<8) setTimeout(function(){ push(true, (tries||0)+1); }, 250); })
        .catch(function(){});
    }
    function next(){ /* back to listening once the answer is both written and heard */
      if(!live() || !spk.over || !spk.audioOver) return;
      c.spk=null; callListen(c);
    }
    genHook={
      text:function(acc){ spk.text=acc; callFeed(c, acc); if(!spk.timer){ spk.timer=setTimeout(function(){ spk.timer=null; if(!spk.over && spk.text.length>spk.sent) push(false); }, CALL_PUSH_MS); } },
      done:function(){ spk.over=true; if(spk.timer){ clearTimeout(spk.timer); spk.timer=null; } push(true); next(); }
    };
    uiFetch('/ui/speak/live',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:spk.id}), signal:spk.ctrl.signal})
      .then(function(r){
        if(!live()) return;
        if(r.status===204){ spk.audioOver=true; next(); return; } /* nothing to say in this answer */
        if(!r.ok || !r.body){ return r.text().then(function(m){ throw new Error(m||('HTTP '+r.status)); }); }
        callSetState(c, 'speaking');
        c.bargeMs=0; if(callPrefs.barge) callRecStart(c); /* listen under the answer, ready to be interrupted */
        return playPcm(r, c.ctx, live, c.outAn, spk.nodes).then(function(end){
          if(!live()) return;
          setTimeout(function(){ spk.audioOver=true; next(); }, Math.max(0, end-c.ctx.currentTime)*1000+150);
        });
      })
      .catch(function(err){
        if(!live() || (err && err.name==='AbortError')) return;
        toast(t('call.err',{msg:((err && err.message)||'')}));
        spk.audioOver=true; if(c.state==='speaking') callSetState(c, 'thinking'); next();
      });
  }
  /* send what was said */
  function callSay(c, said){
    callHeardText(said, false);
    callAnswer(c);
    var b=(viewHome.hidden===false) ? document.querySelector('#view-home .send') : dlgSend();
    sendFlow(said, b);
  }
  /* a message typed in the composer while the dialog is on (the caller sends it) */
  function callTyped(c){
    if(c.ctrl){ try{ c.ctrl.abort(); }catch(_){} c.ctrl=null; }
    callRecStop(c, false);
    callHeardText('', false);
    callAnswer(c);
  }
  /* cut the answer off — both its voice and its writing */
  function callSilence(c){
    var spk=c.spk; c.spk=null;
    if(spk){ if(spk.timer) clearTimeout(spk.timer); try{ spk.ctrl.abort(); }catch(_){}
      spk.nodes.forEach(function(n){ try{ n.stop(); }catch(_){} }); }
    genHook=null;
  }
  /* interrupted by voice: silence the answer and go on listening to the utterance already being
     recorded (the recording runs under the answer for exactly this) */
  function callBarge(c){
    if(call!==c || c.state!=='speaking') return;
    callSilence(c);
    if(generating){ var b=dlgSend(); if(b) stopGen(b); }
    c.bargeMs=0; callSetState(c, 'listening');
    if(c.rec){ c.speech=true; c.loudMs=CALL_SPEECH_MS; c.quietMs=0; } else { callRecStart(c); }
  }
  /* a tap on the cloud: «I'm done speaking» while listening, «Interrupt» while the answer is coming */
  function callTap(){
    var c=call; if(!c) return;
    if(c.state==='listening'){ callUtterance(c); return; }
    if(c.state==='thinking' || c.state==='speaking'){
      callSilence(c);
      if(generating){ var b=dlgSend(); if(b) stopGen(b); }
      callListen(c);
    }
  }
  function endCall(){
    var c=call; if(!c) return;
    call=null;
    callSilence(c); /* the voice stops... */
    if(generating){ var b=dlgSend(); if(b) stopGen(b); } /* ...and so does an answer still on its way: hanging up ends the exchange */
    if(c.ctrl){ try{ c.ctrl.abort(); }catch(_){} }
    callRecStop(c, false);
    if(c.clock) clearInterval(c.clock);
    if(c.raf) cancelAnimationFrame(c.raf);
    if(c.stream) c.stream.getTracks().forEach(function(tr){ tr.stop(); });
    try{ c.ctx.close(); }catch(_){}
    document.body.classList.remove('in-call','call-min','call-muted'); document.body.removeAttribute('data-call');
    document.querySelectorAll('.entry .send').forEach(paintSend);
    if(c.titleDue && c.titleDue===activeId) genTitle(); /* the title put off while the dialog was on */
  }
  callEach('.call-tap', function(b){ b.addEventListener('click', callTap); b.addEventListener('keydown', function(e){ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); callTap(); } }); });
  callEach('.call-mute', function(b){ b.addEventListener('click', callMute); });
  callEach('.call-end', function(b){ b.addEventListener('click', endCall); });
  callEach('.cs-min', function(b){ b.addEventListener('click', function(){ callFold(true); }); });
  callEach('.cc-max', function(b){ b.addEventListener('click', function(){ callFold(false); }); });

  function settingsFields(){ return document.querySelectorAll('.drawer.right [data-key]'); }
  function loadSettings(){
    return uiFetch('/ui/settings').then(function(r){ return r.ok?r.json():null; }).then(function(s){
      if(!s) return;
      settingsFields().forEach(function(el){ var k=el.getAttribute('data-key'); if(k in s) el.value=s[k]||''; });
      document.body.classList.toggle('tts-on', !!(s.CLOUDLING_TTS_BASE_URL||'').trim()); /* «Озвучить» shows only with a TTS server */
      document.body.classList.toggle('stt-on', !!(s.CLOUDLING_STT_BASE_URL||'').trim()); /* the microphone shows only with an STT server */
      document.querySelectorAll('.entry .send').forEach(paintSend); /* the voice-dialog cloud needs both */
      var sr=document.getElementById('saveRestart'); if(sr) sr.disabled=(s._can_save===false);
    }).catch(function(){});
  }
  function engineUrlValid(){ var u=document.querySelector('.drawer.right [data-key="OPENAI_BASE_URL"]'); return /^https?:\/\/.+/i.test((u&&u.value||'').trim()); }
  function saveError(msg){ var sm=document.getElementById('saveMsg'); sm.hidden=false; sm.className='savemsg err'; sm.textContent=msg||t('settings.saveErrEngine'); }

  /* the server rewrites the env file then exits; systemd restarts it with the new values.
     we show a loader and poll /health until it answers again. */
  function waitForRestart(btn,orig){
    setTimeout(function(){
      var tries=0;
      (function poll(){ tries++;
        fetch('/health',{cache:'no-store'}).then(function(r){ return r.ok; }).catch(function(){ return false; })
          .then(function(ok){
            if(ok){ btn.innerHTML=IC.check+' '+t('common.done'); loadSettings(); loadModelInfo(); setTimeout(function(){ btn.innerHTML=orig; btn.disabled=false; }, 1200); }
            else if(tries>45){ btn.innerHTML=orig; btn.disabled=false; saveError(t('settings.serverNoReturn')); }
            else setTimeout(poll, 600);
          });
      })();
    }, 2500);
  }
  document.getElementById('saveRestart').addEventListener('click', function(){
    if(!engineUrlValid()){ saveError(); return; }
    var btn=this, o=btn.innerHTML; document.getElementById('saveMsg').hidden=true; btn.disabled=true;
    var body={}; settingsFields().forEach(function(el){ body[el.getAttribute('data-key')]=el.value||''; });
    btn.innerHTML='<span style="display:inline-flex;align-items:center;gap:9px;justify-content:center;">'+cloud(26)+t('settings.saving')+'</span>';
    uiFetch('/ui/settings/save-restart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){ if(!r.ok){ return r.text().then(function(t){ throw new Error(t||('HTTP '+r.status)); }); } return r.json(); })
      .then(function(){ btn.innerHTML=IC.check+' '+t('common.done'); loadSettings(); loadModelInfo(); setTimeout(function(){ btn.innerHTML=o; btn.disabled=false; }, 1200); })
      .catch(function(err){ btn.innerHTML=o; btn.disabled=false; saveError(t('settings.saveErr',{msg:((err&&err.message)||'')})); });
  });

  /* «Голос» section: the TTS keys live in the same env file as «Основное» — save the whole set, applied live */
  document.getElementById('voiceSave').addEventListener('click', function(){
    var btn=this, o=btn.innerHTML, msg=document.getElementById('voiceMsg'); msg.hidden=true; btn.disabled=true;
    var body={}; settingsFields().forEach(function(el){ body[el.getAttribute('data-key')]=el.value||''; });
    uiFetch('/ui/settings/save-restart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){ if(!r.ok){ return r.text().then(function(t){ throw new Error(t||('HTTP '+r.status)); }); } return r.json(); })
      .then(function(){ btn.innerHTML=IC.check+' '+t('common.done'); loadSettings(); setTimeout(function(){ btn.innerHTML=o; btn.disabled=false; }, 1200); })
      .catch(function(err){ btn.innerHTML=o; btn.disabled=false; msg.hidden=false; msg.className='savemsg err'; msg.textContent=t('settings.saveErr',{msg:((err&&err.message)||'')}); });
  });

  /* ---------- tools section: MCP servers (settings.json mcpServers, no restart) ---------- */
  var mcpServers=[]; /* [{name, command, args[], framing, timeout, enabled, expanded}] — DOM is source of truth after render */
  var MCP_TILE_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>';
  function mcpRow(s){
    var enabled=s.enabled!==false;
    var d=document.createElement('div'); d.className='mcpsrv'+(enabled?'':' off')+(s.expanded?' open':'');
    d.innerHTML=
      '<div class="mcphd">'+
        '<span class="mcptile" aria-hidden="true">'+MCP_TILE_ICON+'</span>'+
        '<div class="mcpmeta">'+
          '<div class="mcptop">'+
            '<div class="mcpname"></div>'+
            '<label class="switch sm" title="'+escAttr(t('mcp.enabledTitle'))+'"><input type="checkbox" class="m-enabled"'+(enabled?' checked':'')+' aria-label="'+escAttr(t('mcp.enabledTitle'))+'" /><span class="track"></span></label>'+
          '</div>'+
          '<div class="mcpbot">'+
            '<div class="mcpsub"></div>'+
            '<button class="mcm mcdel" type="button" title="'+escAttr(t('mcp.delServer'))+'" aria-label="'+escAttr(t('mcp.delServer'))+'">'+IC.trash+'</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div class="mcpbody">'+
        '<div class="fld"><div class="lab">'+t('mcp.name')+'</div><input class="m-name" placeholder="'+escAttr(t('mcp.namePh'))+'" /></div>'+
        '<div class="fld"><div class="lab">'+t('mcp.command')+'</div><input class="m-cmd" placeholder="python3" /></div>'+
        '<div class="fld"><div class="lab">'+t('mcp.args')+'</div><textarea class="cfgta m-args" placeholder="/path/to/server.py"></textarea></div>'+
        '<div class="fld"><div class="lab">'+t('mcp.framing')+' <span class="env">framing</span></div><select class="m-framing"><option value="newline">'+t('mcp.framingNewline')+'</option><option value="content-length">'+t('mcp.framingLegacy')+'</option></select></div>'+
        '<div class="fld"><div class="lab">'+t('mcp.timeout')+' <span class="env">toolCallTimeoutMs</span></div><input class="m-timeout" type="number" min="1" placeholder="60000" /></div>'+
      '</div>';
    var nameInp=d.querySelector('.m-name');
    var cmdInp=d.querySelector('.m-cmd');
    var argsTa=d.querySelector('.m-args');
    nameInp.value=s.name||'';
    cmdInp.value=s.command||'';
    argsTa.value=(s.args||[]).join('\n');
    d.querySelector('.m-framing').value=(s.framing==='content-length')?'content-length':'newline';
    if(s.timeout) d.querySelector('.m-timeout').value=s.timeout;
    var nameLbl=d.querySelector('.mcpname'), subLbl=d.querySelector('.mcpsub');
    function syncMeta(){
      var v=(nameInp.value||'').trim();
      if(v){ nameLbl.textContent=v; nameLbl.classList.remove('ph'); } else { nameLbl.textContent=t('mcp.newServer'); nameLbl.classList.add('ph'); }
      var cmd=(cmdInp.value||'').trim(), args=linesToArray(argsTa.value);
      subLbl.textContent = cmd ? (cmd + (args.length ? ' · '+args.join(' ') : '')) : '';
    }
    syncMeta();
    nameInp.addEventListener('input', syncMeta);
    cmdInp.addEventListener('input', syncMeta);
    argsTa.addEventListener('input', syncMeta);
    function toggleOpen(){ d.classList.toggle('open'); }
    /* row click expands the fields — except on the switch or an action button */
    d.querySelector('.mcphd').addEventListener('click', function(ev){ if(ev.target.closest('.switch')||ev.target.closest('.mcm')) return; toggleOpen(); });
    d.querySelector('.mcdel').addEventListener('click', function(ev){ ev.stopPropagation(); d.remove(); mcpToggleEmpty(); });
    var chk=d.querySelector('.m-enabled');
    chk.addEventListener('change', function(){ d.classList.toggle('off', !chk.checked); });
    return d;
  }
  function mcpToggleEmpty(){
    var list=document.getElementById('mcpList');
    var empty=list.querySelector('.mcpempty');
    var has=!!list.querySelector('.mcpsrv');
    if(!has && !empty){ var e=document.createElement('div'); e.className='mcpempty'; e.textContent=t('mcp.empty'); list.appendChild(e); }
    if(has && empty) empty.remove();
  }
  function renderMcp(){
    var list=document.getElementById('mcpList'); list.innerHTML='';
    mcpServers.forEach(function(s){ list.appendChild(mcpRow(s)); });
    mcpToggleEmpty();
  }
  function mcpStatus(ok,text){ var m=document.getElementById('mcpMsg'); m.hidden=false; m.className='savemsg'+(ok?'':' err'); m.textContent=text; if(ok) setTimeout(function(){ m.hidden=true; }, 2400); }
  function mcpAddServer(){
    var list=document.getElementById('mcpList');
    list.appendChild(mcpRow({name:'', command:'', args:[], framing:'newline', enabled:true, expanded:true}));
    mcpToggleEmpty();
  }
  document.getElementById('mcpAdd').addEventListener('click', mcpAddServer);
  document.getElementById('mcpAdd').addEventListener('keydown', function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); mcpAddServer(); } });
  document.getElementById('mcpSave').addEventListener('click', function(){
    var btn=this; document.getElementById('mcpMsg').hidden=true;
    var out={}, outDisabled={}, err=null;
    document.querySelectorAll('#mcpList .mcpsrv').forEach(function(d){
      if(err) return;
      var name=(d.querySelector('.m-name').value||'').trim();
      var cmd=(d.querySelector('.m-cmd').value||'').trim();
      if(!name && !cmd) return; /* пустая карточка — игнорируем */
      if(!name || !cmd){ err=t('mcp.errNameCmd'); return; }
      if(!/^[A-Za-z0-9_-]+$/.test(name)){ err=t('mcp.errNameChars',{name:name}); return; }
      if(out[name]||outDisabled[name]){ err=t('mcp.errNameUniq',{name:name}); return; }
      var entry={ command: cmd };
      var args=linesToArray(d.querySelector('.m-args').value); if(args.length) entry.args=args;
      if(d.querySelector('.m-framing').value==='content-length') entry.framing='content-length';
      var to=parseInt(d.querySelector('.m-timeout').value,10); if(to>0) entry.toolCallTimeoutMs=to;
      /* enabled → mcpServers (runtime loads it); disabled → mcpServersDisabled shelf
         (kept in settings.json but never launched, so zero tools/tokens in context) */
      if(d.querySelector('.m-enabled').checked) out[name]=entry; else outDisabled[name]=entry;
    });
    if(err){ mcpStatus(false, err); return; }
    btn.disabled=true;
    uiFetch('/ui/config/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mcpServers:out, mcpServersDisabled:outDisabled})})
      .then(function(r){ if(!r.ok){ return r.text().then(function(t){ throw new Error(t||('HTTP '+r.status)); }); } return r.json(); })
      .then(function(){ btn.disabled=false; mcpStatus(true,t('settings.savedNextMsg')); })
      .catch(function(e){ btn.disabled=false; mcpStatus(false,t('settings.saveErr',{msg:((e&&e.message)||'')})); });
  });

  /* ---------- access level: one preset → permission mode + filesystem scope + folder ---------- */
  function linesToArray(s){ return (s||'').split('\n').map(function(x){ return x.trim(); }).filter(function(x){ return x.length; }); }

  /* Preset → underlying axes. "read" reads the whole machine but changes nothing; "workspace"
     reads/writes/runs confined to the working folder; "full" is unrestricted. Sandbox namespace
     isolation is always off here — confinement is the working folder, not the (server-inert) sandbox. */
  var PRESET_PERM={ read:'read-only', workspace:'danger-full-access', full:'danger-full-access' };
  var PRESET_FS={ read:'off', workspace:'allow-list', full:'off' };
  var PRESET_NOTE={
    read:t('access.readNote'),
    workspace:t('access.workspaceNote'),
    full:t('access.fullNote')
  };
  function presetFromState(perm, fs){
    if(perm==='read-only') return 'read';
    if(fs==='off') return 'full';
    return 'workspace'; /* полный доступ + ограничение по папке (allow-list / workspace-only / иное) */
  }
  function updateAccessNote(){
    var p=document.getElementById('accessPreset').value;
    document.getElementById('accessNote').textContent=PRESET_NOTE[p]||'';
    /* the working folder only applies to «Рабочая папка» — hide it entirely otherwise */
    var ff=document.getElementById('accessFolderFld'); if(ff) ff.style.display=(p==='workspace')?'':'none';
  }
  function loadConfig(){
    return Promise.all([
      uiFetch('/ui/settings').then(function(r){ return r.ok?r.json():{}; }).catch(function(){ return {}; }),
      uiFetch('/ui/config').then(function(r){ return r.ok?r.json():{}; }).catch(function(){ return {}; })
    ]).then(function(res){
      var s=res[0]||{}, c=res[1]||{};
      var perm=s['CLAW_PERMISSION_MODE']||'';
      var fs=((c.sandbox||{}).filesystemMode)||'';
      document.getElementById('accessPreset').value=presetFromState(perm, fs);
      var af=document.getElementById('accessFolder');
      af.value=c.workspaceFolder||'';
      if(c.workspaceFolderDefault) af.placeholder=c.workspaceFolderDefault;
      document.getElementById('cfgTrusted').value=(c.trustedRoots||[]).join('\n');
      var perms=c.permissions||{};
      document.getElementById('cfgAllow').value=(perms.allow||[]).join('\n');
      document.getElementById('cfgDeny').value=(perms.deny||[]).join('\n');
      var ms=c.mcpServers||{}, md=c.mcpServersDisabled||{};
      function toRow(map,on){ return Object.keys(map).map(function(n){ var e=map[n]||{};
        return { name:n, command:e.command||'', args:e.args||[], framing:e.framing||'newline', timeout:e.toolCallTimeoutMs, enabled:on, expanded:false }; }); }
      mcpServers=toRow(ms,true).concat(toRow(md,false));
      renderMcp();
      updateAccessNote();
    }).catch(function(){});
  }
  function accessMsg(ok,text){ var m=document.getElementById('accessMsg'); m.hidden=false; m.className='savemsg'+(ok?'':' err'); m.textContent=text; if(ok) setTimeout(function(){ m.hidden=true; }, 2600); }
  document.getElementById('accessPreset').addEventListener('change', updateAccessNote);
  document.getElementById('accessSave').addEventListener('click', function(){
    var btn=this; btn.disabled=true; document.getElementById('accessMsg').hidden=true;
    var preset=document.getElementById('accessPreset').value;
    var folder=(document.getElementById('accessFolder').value||'').trim();
    /* 1) permission mode → env, applied live (no restart). Send the full «Основное» set so the
          served-id isn't reset, then override the access mode. */
    var sBody={}; settingsFields().forEach(function(el){ sBody[el.getAttribute('data-key')]=el.value||''; });
    sBody['CLAW_PERMISSION_MODE']=PRESET_PERM[preset]||'read-only';
    /* 2) filesystem scope + working folder + advanced → settings.json (no restart). */
    var cBody={ sandbox:{ enabled:false, filesystemMode:(PRESET_FS[preset]||'off') }, workspaceFolder:folder,
      trustedRoots:linesToArray(document.getElementById('cfgTrusted').value),
      permissions:{ allow:linesToArray(document.getElementById('cfgAllow').value), deny:linesToArray(document.getElementById('cfgDeny').value) } };
    uiFetch('/ui/settings/save-restart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sBody)})
      .then(function(r){ if(!r.ok){ return r.text().then(function(t){ throw new Error(t||('HTTP '+r.status)); }); } return r.json(); })
      .then(function(){ return uiFetch('/ui/config/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cBody)}); })
      .then(function(r){ if(!r.ok){ return r.text().then(function(t){ throw new Error(t||('HTTP '+r.status)); }); } return r.json(); })
      .then(function(){ btn.disabled=false; accessMsg(true,t('settings.savedNextMsg')); })
      .catch(function(err){ btn.disabled=false; accessMsg(false,t('settings.saveErr',{msg:((err&&err.message)||'')})); });
  });

  /* ---------- server-side folder picker (browses THIS server's filesystem) ---------- */
  var browseCur='';
  var browseSep='/';
  /* Join a child folder onto the current path using the server's OS separator (so Windows
     gets `D:\Claude`, not the verbatim `\\?\D:\/Claude` that broke navigation). Strips
     trailing separators of either kind first. */
  function browseJoin(base,name){ return base.replace(/[\/\\]+$/,'')+browseSep+name; }
  function browseRender(data){
    browseCur=data.path||'';
    if(data.sep) browseSep=data.sep;
    document.getElementById('browsePath').textContent=browseCur||'/';
    var rootsBar=document.getElementById('browseRoots'); rootsBar.innerHTML='';
    (data.roots||[]).forEach(function(r){
      var rb=document.createElement('button'); rb.type='button';
      rb.className='browse-root'+(browseCur===r?' on':''); rb.textContent=r;
      rb.addEventListener('click', function(){ browseLoad(r); });
      rootsBar.appendChild(rb);
    });
    var list=document.getElementById('browseList'); list.innerHTML='';
    if(data.parent){
      var up=document.createElement('div'); up.className='browse-row up'; up.textContent='↑  ..';
      up.addEventListener('click', function(){ browseLoad(data.parent); });
      list.appendChild(up);
    }
    (data.dirs||[]).forEach(function(name){
      var row=document.createElement('div'); row.className='browse-row'; row.textContent='📁  '+name;
      row.addEventListener('click', function(){ browseLoad(browseJoin(browseCur,name)); });
      list.appendChild(row);
    });
    if(!(data.dirs||[]).length){ var e=document.createElement('div'); e.className='browse-empty'; e.textContent=t('browse.empty'); list.appendChild(e); }
  }
  function browseLoad(path){
    uiFetch('/ui/browse'+(path?('?path='+encodeURIComponent(path)):''))
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(d){ if(d) browseRender(d); }).catch(function(){});
  }
  (function(){
    var openBtn=document.getElementById('accessBrowse'); if(!openBtn) return;
    var scrim=document.getElementById('browseScrim');
    openBtn.addEventListener('click', function(){ scrim.hidden=false; browseLoad((document.getElementById('accessFolder').value||'').trim()); });
    document.getElementById('browseCancel').addEventListener('click', function(){ scrim.hidden=true; });
    scrim.addEventListener('click', function(e){ if(e.target===scrim) scrim.hidden=true; });
    document.getElementById('browsePick').addEventListener('click', function(){ document.getElementById('accessFolder').value=browseCur; scrim.hidden=true; });
  })();
  loadConfig();

  /* ---------- reasoning display toggle (ui_kv show_reasoning, default ON) ---------- */
  (function(){
    var sel=document.getElementById('showReason'); if(!sel) return;
    uiFetch('/ui/kv/show_reasoning').then(function(r){ return r.ok?r.json():null; }).then(function(d){
      if(d && d.value==='false') sel.checked=false;
    }).catch(function(){});
    sel.addEventListener('change', function(){
      uiFetch('/ui/kv/show_reasoning',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:sel.checked?'true':'false'})}).catch(function(){});
    });
  })();

  /* ---------- backend connection check (like OWUI) ----------
     Real probe via the server (POST /ui/check-backend → GET <base>/models): the browser
     can't reach the backend directly (CORS / server-only network). Uses the values
     currently typed into the form, before saving. */
  function setConnDot(state){ document.querySelectorAll('.entry .model .dot').forEach(function(d){ d.style.background = state==='err' ? '#d97b7b' : (state==='ok' ? '#5fa97e' : '#8a8b91'); }); }
  document.getElementById('checkBackend').addEventListener('click', function(){
    var btn=this, st=document.getElementById('checkStatus');
    var url=(btn.closest('.fieldrow').querySelector('input').value||'').trim();
    var keyEl=document.querySelector('input[data-key="OPENAI_API_KEY"]');
    var key=keyEl?(keyEl.value||'').trim():'';
    btn.classList.add('spin'); st.hidden=true;
    uiFetch('/ui/check-backend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_url:url, api_key:key})})
      .then(function(r){ return r.ok?r.json():null; })
      .catch(function(){ return null; })
      .then(function(d){
        btn.classList.remove('spin'); st.hidden=false;
        if(d && d.ok){
          st.className='cstatus ok'; st.innerHTML='<span class="d"></span><span>'+t('conn.ok')+'</span>'; setConnDot('ok');
          if(!configured){ configured=true; document.getElementById('view-setup').hidden=true; viewHome.hidden=false; }
        } else {
          var why=(d&&d.error)?(' — '+esc(String(d.error)).slice(0,120)):'';
          st.className='cstatus err'; st.innerHTML='<span class="d"></span><span>'+t('conn.fail')+why+'</span>'; setConnDot('err');
        }
      });
  });

  /* ---------- dialog list: search filter + empty states ---------- */
  var searchInput=leftDrawer.querySelector('.search input');
  var pinGroup=document.getElementById('pinGroup');
  var dlgGroup=document.getElementById('dlgGroup');
  var emptyNone=document.getElementById('emptyNone');
  var emptySearch=document.getElementById('emptySearch');
  function updateDialogList(){
    var all=Array.prototype.slice.call(leftDrawer.querySelectorAll('.item'));
    var pinned=all.filter(function(it){return it.classList.contains('pinned');});
    var rest=all.filter(function(it){return !it.classList.contains('pinned');});
    /* keep both groups newest-first so an unpinned dialog drops back into its date slot */
    function byDate(a,b){ return (parseInt(b.dataset.updated,10)||0)-(parseInt(a.dataset.updated,10)||0); }
    pinned.sort(byDate); rest.sort(byDate);
    pinned.forEach(function(it){ leftDrawer.insertBefore(it, dlgGroup); });
    rest.forEach(function(it){ leftDrawer.insertBefore(it, emptyNone); });
    var q=(searchInput.value||'').trim().toLowerCase();
    function vis(it){ return !q || it.querySelector('.t').textContent.toLowerCase().indexOf(q)>-1; }
    var pv=0, rv=0;
    pinned.forEach(function(it){ var m=vis(it); it.style.display=m?'':'none'; if(m)pv++; });
    rest.forEach(function(it){ var m=vis(it); it.style.display=m?'':'none'; if(m)rv++; });
    pinGroup.hidden = pv===0;
    dlgGroup.hidden = rv===0;
    emptyNone.hidden = !(all.length===0);
    emptySearch.hidden = !(all.length>0 && q && (pv+rv)===0);
  }
  searchInput.addEventListener('input', updateDialogList);
  updateDialogList();

  /* ---------- system-prompt presets (server-backed; applied as a leading system message,
       exactly how OWUI sends its model's system prompt) ---------- */
  var presets=[], activePresetId=null, editingId=null;
  var presetList=document.getElementById('presetList');
  var vPreset=document.getElementById('view-preset');
  /* No default presets are shipped — a fresh install starts with an empty list and the
     user creates their own (keeps the product language-neutral for a broad audience). */
  var DEFAULT_PRESETS=[];
  function pFetchJSON(url, opts){ return uiFetch(url, opts).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }
  function savePreset(id,name,prompt){ return uiFetch('/ui/presets/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,prompt:prompt})}).catch(function(){}); }
  function deletePresetReq(id){ return uiFetch('/ui/presets/'+encodeURIComponent(id),{method:'DELETE'}).catch(function(){}); }
  function setActivePreset(id){ activePresetId=id||null; return uiFetch('/ui/kv/active_preset',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:id||''})}).catch(function(){}); }
  function activePresetPrompt(){ for(var i=0;i<presets.length;i++){ if(presets[i].id===activePresetId) return presets[i].prompt||''; } return ''; }
  /* what we actually send: active preset's prompt prepended as a system message (or just convo) */
  function stripReasoning(t){ return (t||'').replace(/<details type="reasoning"[\s\S]*?<\/details>/g,'').replace(/\n{3,}/g,'\n\n'); }
  /* assemble the OWUI/OpenAI content array for a user message that carries attachments:
     text + inlined text files + {type:image_url} + a note for non-inlined binaries.
     (text-only messages stay plain strings.)
     `keepImage` gates whether the actual image bytes are (re)sent: an image is
     inlined only on the latest user turn (the one being sent now). On older turns
     it collapses to a short note, so an image attached once is uploaded/processed
     by the backend once — not re-encoded on every subsequent message. Text files
     stay inlined each turn (cheap tokens, and follow-ups usually want the text). */
  function userContentForBackend(m, keepImage){
    if(!m.atts || !m.atts.length) return m.content;
    var parts=[];
    if(m.content) parts.push({type:'text', text:m.content});
    m.atts.forEach(function(a){
      if(a.kind==='image' && a.url){
        if(keepImage) parts.push({type:'image_url', image_url:{url:a.url}});
        else parts.push({type:'text', text:t('att.imageAbove',{name:a.name})});
      }
      else if(a.kind==='text' && typeof a.text==='string') parts.push({type:'text', text:t('att.fileInline',{name:a.name})+'\n```\n'+a.text+'\n```'});
      else parts.push({type:'text', text:t('att.fileNotSent',{name:a.name, size:humanSize(a.size)})});
    });
    if(!parts.length) parts.push({type:'text', text:''});
    return parts;
  }
  /* voice dialog: ask for a spoken-style answer. The note goes in front of every message said in a
     dialog — in the outgoing copy only, the stored text stays clean — and stays there on later turns:
     the backend keeps the prompt it has read, and a note that moved from message to message made it
     read the last exchange again on every turn (0.4 s). The first message of a dialog carries the
     full note, the rest a short one. Not a system message: that sits at the very start of the
     prompt, and changing the start makes the backend re-read all of it. */
  function voiceNoted(m, content){
    return (m.voice && typeof content==='string') ? (m.voice===2 ? CALL_STYLE_NOTE : CALL_STYLE_SHORT)+'\n\n'+content : content;
  }
  function outgoingMessages(blank){ /* blank: as for a dialog not yet begun */
    var sys=activePresetPrompt(), list=blank?[]:convo;
    /* index of the latest user message — only it (re)sends image bytes (see userContentForBackend) */
    var lastUserIdx=-1;
    for(var i=list.length-1;i>=0;i--){ if(list[i].role==='user'){ lastUserIdx=i; break; } }
    /* reasoning blocks are display-only — drop them from resent history so context stays lean;
       user messages may carry attachments → expand to a content array (UI-only fields dropped) */
    var hist=list.map(function(m, idx){ return m.role==='assistant'
      ? {role:m.role, content:stripReasoning(m.content)}
      : {role:m.role, content:voiceNoted(m, userContentForBackend(m, idx===lastUserIdx))}; });
    return sys ? [{role:'system', content:sys}].concat(hist) : hist;
  }

  function updateChip(){ var nm=t('preset.none');
    for(var i=0;i<presets.length;i++){ if(presets[i].id===activePresetId){ nm=presets[i].name; break; } }
    document.querySelectorAll('.entry .model').forEach(function(m){ m.innerHTML='<span class="dot"></span>'+esc(nm); }); }

  /* Toggling a preset's switch: turn it on → it becomes the active system prompt (others off);
     turn the active one off → no system prompt is applied, but the choice is remembered so you
     can flip it back on without recreating an empty preset. */
  function togglePreset(id){
    var next=(activePresetId===id)?null:id;
    setActivePreset(next).then(function(){ renderPresetList(); updateChip(); });
  }
  function renderPresetList(){
    presetList.innerHTML='';
    presets.forEach(function(p){
      var isActive=p.id===activePresetId;
      var row=document.createElement('div'); row.className='prow'+(isActive?' active':'');
      row.innerHTML='<span class="pn">'+esc(p.name)+'</span>'+
        '<button class="pm pedit" title="'+escAttr(t('common.edit'))+'" aria-label="'+escAttr(t('common.edit'))+'">'+IC.edit+'</button>'+
        '<button class="pm pdel" title="'+escAttr(t('common.delete'))+'" aria-label="'+escAttr(t('common.delete'))+'">'+IC.trash+'</button>'+
        '<span class="rowdiv" aria-hidden="true"></span>'+
        '<label class="switch sm" title="'+escAttr(t('preset.applyTitle'))+'"><input type="checkbox" class="psw"'+(isActive?' checked':'')+' aria-label="'+escAttr(t('preset.applyTitle'))+'" /><span class="track"></span></label>';
      row.addEventListener('click', function(e){
        if(e.target.closest('.pedit')){ openPresetEditor(p.id); return; }
        if(e.target.closest('.pdel')){ deletePresetReq(p.id).then(loadPresets); return; }
        if(e.target.closest('.switch')) return; /* handled by the switch's change event */
        togglePreset(p.id);
      });
      row.querySelector('.psw').addEventListener('change', function(){ togglePreset(p.id); });
      presetList.appendChild(row);
    });
    var add=document.createElement('div'); add.className='padd'; add.textContent=t('preset.new');
    add.addEventListener('click', function(){ openPresetEditor(null); });
    presetList.appendChild(add);
  }

  function openPresetEditor(id){ editingId=id; var p=null;
    if(id){ for(var i=0;i<presets.length;i++){ if(presets[i].id===id){ p=presets[i]; break; } } }
    document.getElementById('presetName').value=p?p.name:''; document.getElementById('presetPrompt').value=p?p.prompt:'';
    closeDrawers(); viewHome.hidden=true; viewDlg.hidden=true; document.getElementById('view-setup').hidden=true; vPreset.hidden=false;
    setTimeout(function(){ document.getElementById('presetName').focus(); }, 150);
  }
  function closePresetEditor(){ vPreset.hidden=true; newDialog(); }
  document.getElementById('presetSave').onclick=function(){
    var name=(document.getElementById('presetName').value||'').trim()||t('preset.unnamed');
    var prompt=document.getElementById('presetPrompt').value||'';
    var id=editingId||genId(), isNew=!editingId;
    savePreset(id,name,prompt).then(function(){ if(isNew) return setActivePreset(id); }).then(loadPresets).then(closePresetEditor);
  };
  document.getElementById('presetCancel').onclick=closePresetEditor;
  document.getElementById('presetBack').onclick=closePresetEditor;

  function loadPresets(){
    return pFetchJSON('/ui/presets').then(function(list){
      if(Array.isArray(list) && list.length===0 && DEFAULT_PRESETS.length){
        return Promise.all(DEFAULT_PRESETS.map(function(p){ return savePreset(genId(), p.name, p.prompt); })).then(function(){ return pFetchJSON('/ui/presets'); });
      }
      return list;
    }).then(function(list){ presets=Array.isArray(list)?list:[];
      return pFetchJSON('/ui/kv/active_preset');
    }).then(function(kv){
      /* Distinguish "explicitly turned off" (kv exists with empty value → no active preset)
         from "never chosen" (no kv yet → default to the first preset on first run). */
      activePresetId=(kv&&('value' in kv))?(kv.value||null):(presets[0]?presets[0].id:null);
      renderPresetList(); updateChip();
    });
  }
  loadPresets();

  /* unconfigured engine (or ?firstrun) → setup screen; otherwise land on home.
     Decide after settings load so an empty OPENAI_BASE_URL routes a fresh instance
     to the guided setup instead of a dead-end home screen. */
  refreshSidebar();
  loadModelInfo();
  loadVersion();
  loadDlgToks();
  loadDlgErrs();
  loadDlgPins();
  loadSettings().then(function(){
    var u=document.querySelector('.drawer.right [data-key="OPENAI_BASE_URL"]');
    var hasEngine=!!(u && (u.value||'').trim());
    configured = hasEngine && (location.search.indexOf('firstrun')===-1);
    if(configured){ newDialog(); } else { showSetup(); }
  });
})();
