(function(){
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
    send:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16161a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>',
    warn:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 4l-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z"/></svg>'
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
  function inline(t){ t=esc(t);
    t=t.replace(/:([a-z_]+):/g,function(m,n){return EMOJI[n]||m;});
    t=t.replace(/`([^`]+)`/g,'<code>$1</code>');
    t=t.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    t=t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g,'$1<em>$2</em>');
    t=t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    return t;
  }
  function codeBlock(lang,code){ return '<div class="code"><div class="chead"><span class="lang">'+(lang||'код')+'</span><button class="copy" type="button">'+IC.copy+'<span>Копировать</span></button></div><pre>'+esc(code)+'</pre></div>'; }
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
  function fallback(t){var ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(ta);}
  function copyText(t,btn){ var flash=function(){if(!btn)return;var o=btn.innerHTML;btn.innerHTML=IC.check+(btn.querySelector('span')?'<span>Скопировано</span>':'');setTimeout(function(){btn.innerHTML=o;},1100);};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(flash,function(){fallback(t);flash();});} else {fallback(t);flash();} }

  /* ---------- data ---------- */
  var dialogs=[
    {title:"Нужен аудит searxng на сервере", msgs:[
      {r:"u", text:"Нужен аудит searxng на сервере. Хочу оптимизировать веб-поиск для clab."},
      {r:"a", tool:["WebSearch","проверка конфигурации"], text:"### Аудит SearXNG\n\nКонфиг проверен — **JSON-формат включён**, и `clab` ходит к нему через `CLAWD_WEB_SEARCH_BASE_URL`.\n\n- Рабочие движки: DuckDuckGo, Wikipedia\n- Флапают: **Brave**, **Startpage**\n\n> Рекомендация: отключить нестабильные движки ради надёжности ⚠️\n\nПроверка завершена :tada: :rocket:"}
    ]},
    {title:"Идеи для встроенного UI", msgs:[
      {r:"u", text:"Какие идеи по встроенному интерфейсу?"},
      {r:"a", text:"Встроенный интерфейс — это:\n\n| Часть | Реализация |\n|---|---|\n| Ядро | один бинарник `clab` |\n| Интерфейс | страница вшита в бинарник |\n\nHeadless при этом **остаётся** — UI это просто режим поверх."}
    ]},
    {title:"Последняя версия Rust + hello world", msgs:[
      {r:"u", text:"Найди последнюю версию Rust и покажи пример hello world."},
      {r:"a", tool:["WebSearch","latest Rust version"], text:"Последняя стабильная — **1.96**. Минимальный пример:\n\n```rust\nfn main() {\n    println!(\"Hello, world!\");\n}\n```\n\nСохрани в `main.rs` и запусти `rustc main.rs && ./main`."}
    ]},
    {title:"Разбор веб-поиска SearXNG", msgs:[
      {r:"u", text:"Как clab делает веб-поиск?"},
      {r:"a", text:"### Как работает веб-поиск\n\n1. Модель зовёт инструмент `WebSearch`\n2. `clab` идёт в `CLAWD_WEB_SEARCH_BASE_URL` (локальный SearXNG)\n3. JSON-ответ парсится в список результатов\n\nПодробнее — [в доках SearXNG](https://docs.searxng.org)."}
    ]}
  ];

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
  function userTurn(text){ var t=document.createElement('div'); t.className='turn u';
    t.innerHTML='<div class="bubble">'+esc(text)+'</div><div class="row-acts">'+actBtn('copy','Копировать')+actBtn('edit','Редактировать')+'</div>'; return t; }
  function assistantTurn(m){ var t=document.createElement('div'); t.className='turn a'; var h='';
    if(m.tool){h+='<div class="tool"><div class="head"><span class="tag">'+m.tool[0]+'</span> · '+esc(m.tool[1])+'</div></div>';}
    h+='<div class="md">'+md(m.text)+'</div><div class="row-acts">'+actBtn('copy','Копировать')+actBtn('regen','Перегенерировать')+actBtn('up','Нравится')+actBtn('down','Не нравится')+'</div>';
    t.innerHTML=h; return t; }

  function renderDialog(i){ thread.innerHTML=''; dialogs[i].msgs.forEach(function(m){ thread.appendChild(m.r==='u'?userTurn(m.text):assistantTurn(m)); }); }

  function openDialog(i,el){ var d=dialogs[i]; if(!d) return;
    dtitle.textContent=d.title; viewHome.hidden=true; document.getElementById('view-setup').hidden=true; document.getElementById('view-preset').hidden=true; viewDlg.hidden=false;
    leftDrawer.querySelectorAll('.item').forEach(function(it){ it.classList.toggle('active', it===el); });
    activeItem=el;
    /* skeleton (S4) while "loading" the conversation */
    var tok=++skelToken; thread.innerHTML=SKELETON;
    setTimeout(function(){ if(tok===skelToken){ renderDialog(i); stick=true; toBottom(); updateScrollBtn(); } }, 700);
  }
  function newDialog(){ viewDlg.hidden=true; document.getElementById('view-setup').hidden=true; viewHome.hidden=false; activeItem=null;
    leftDrawer.querySelectorAll('.item').forEach(function(it){ it.classList.remove('active'); }); }
  document.getElementById('newDlg').onclick=newDialog;

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
  function setSend(btn, stop){ if(stop){ btn.classList.add('stop'); btn.classList.remove('off'); btn.innerHTML='<span class="sq"></span>'; btn.title='Остановить'; } else { btn.classList.remove('stop'); btn.innerHTML=IC.send; btn.title='Отправить'; var ta=btn.closest('.entry').querySelector('textarea'); btn.classList.toggle('off', !(ta.value||'').trim()); } }
  function clearTimers(){ genTimers.forEach(function(t){clearTimeout(t);clearInterval(t);}); genTimers=[]; }

  function finishGen(btn){ generating=false; setSend(btn,false); setItemGenerating(activeItem,false); }

  /* The real UI is event-driven: the MODEL decides whether to call a tool, and the SSE
     stream carries the tool-call events — the page never infers tool use from the prompt.
     This is a backend-less mock, so tool calls and errors are explicit stage-directions
     you type (/tool or /search, /err, /drop), not guesses about the user's intent. */
  function detectMode(text){ return /(^|\s)\/drop\b/i.test(text) ? 'drop' : (/(^|\s)\/err\b/i.test(text) ? 'error' : 'ok'); }
  function mockTool(text){ return /(^|\s)\/(tool|search)\b/i.test(text||''); }
  /* placeholder reply text only — not model logic */
  function pickReply(text){ text=text||'';
    if(/rust|раст|верси|hello/i.test(text)) return "Последняя стабильная версия Rust — **1.96**. Минимальный пример:\n\n```rust\nfn main() {\n    println!(\"Hello, world!\");\n}\n```\n\nСохрани в `main.rs` и собери `rustc main.rs`.";
    if(/searxng|поиск|веб/i.test(text)) return "Веб-поиск идёт через `CLAWD_WEB_SEARCH_BASE_URL` (локальный SearXNG): модель зовёт `WebSearch`, `clab` парсит JSON-ответ в список результатов и отдаёт их обратно.";
    return "Готово. Если нужно — могу сходить в инструменты (веб-поиск, bash, файловые операции) или уточнить детали.";
  }
  function errboxHTML(){ return '<div class="errbox"><div class="ehead">'+IC.warn+'Не удалось получить ответ</div><div class="emsg">Движок не ответил. Проверь, что бэкенд запущен и адрес указан верно.</div><button class="retry" type="button">'+IC.regen+'Повторить</button></div>'; }

  function attachRetry(turn, btn){ var r=turn.querySelector('.retry'); if(!r) return;
    r.addEventListener('click', function(){
      var prevU=turn.previousElementSibling;
      var ut=(prevU&&prevU.classList.contains('u'))?prevU.querySelector('.bubble').textContent:'';
      generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
      turn.remove(); genAssistant(btn, detectMode(ut), mockTool(ut), ut);
    });
  }

  function streamReply(turn, btn, reply, mode){
    var mdbox=turn.querySelector('.md');
    var span=document.createElement('span'); mdbox.appendChild(span);
    var caret=document.createElement('span'); caret.className='caret'; mdbox.appendChild(caret);
    var plain=reply.replace(/```[\s\S]*?```/g,' …код… ').replace(/[`*#>|]/g,'').replace(/\n+/g,' ').trim();
    var dropAt=(mode==='drop')?Math.floor(plain.length*0.45):Infinity;
    var i=0; var tm=setInterval(function(){
      i+=3; span.textContent=plain.slice(0,i); maybeScroll();
      if(i>=dropAt){ clearInterval(tm); caret.remove();
        turn.insertAdjacentHTML('beforeend','<div class="errbox"><div class="ehead">'+IC.warn+'Соединение прервано</div><div class="emsg">Связь с движком оборвалась во время ответа. Часть ответа сохранена.</div><button class="retry" type="button">'+IC.regen+'Повторить</button></div>');
        attachRetry(turn, btn); finishGen(btn); maybeScroll(); return;
      }
      if(i>=plain.length){ clearInterval(tm); caret.remove();
        mdbox.innerHTML=md(reply);
        turn.insertAdjacentHTML('beforeend','<div class="row-acts">'+actBtn('copy','Копировать')+actBtn('regen','Перегенерировать')+actBtn('up','Нравится')+actBtn('down','Не нравится')+'</div>');
        finishGen(btn); maybeScroll();
      }
    }, 26); genTimers.push(tm);
  }

  /* mock turn: thinking → (optional tool) → stream | error. useTool mirrors the model
     deciding whether to call a tool this turn; plain answers skip the tool block. */
  function genAssistant(btn, mode, useTool, userText){
    var reply=pickReply(userText);
    var turn=document.createElement('div'); turn.className='turn a';
    turn.innerHTML='<div class="thinking">'+cloud(38)+'<span>Claw думает…</span></div>';
    thread.appendChild(turn); stick=true; maybeScroll();
    genTimers.push(setTimeout(function(){
      if(useTool){
        turn.innerHTML='<div class="tool"><div class="head">'+RIP+'<span class="tag">WebSearch</span> · ищу в вебе…</div></div><div class="md"></div>';
        genTimers.push(setTimeout(function(){
          if(mode==='error'){
            turn.innerHTML='<div class="tool fail"><div class="head">'+IC.warn+'<span class="tag">WebSearch</span> · не удалось (нет ответа)</div></div>'+errboxHTML();
            attachRetry(turn, btn); finishGen(btn); maybeScroll(); return;
          }
          turn.querySelector('.tool .head').innerHTML='<span class="tag">WebSearch</span> · веб-поиск';
          streamReply(turn, btn, reply, mode);
        }, 850));
      } else {
        if(mode==='error'){
          turn.innerHTML=errboxHTML(); attachRetry(turn, btn); finishGen(btn); maybeScroll(); return;
        }
        turn.innerHTML='<div class="md"></div>';
        streamReply(turn, btn, reply, mode);
      }
    }, 950));
  }

  function sendFlow(text, btn){
    if(viewHome.hidden===false){ /* coming from home: open a fresh dialog */
      var it=document.createElement('div'); it.className='item active'; it.dataset.i='0';
      it.innerHTML='<span class="t">'+esc(text.slice(0,42))+'</span><span class="date">сейчас</span><button class="kebab" aria-label="Действия">⋯</button>';
      var firstItem=leftDrawer.querySelector('.item'); leftDrawer.insertBefore(it, firstItem);
      leftDrawer.querySelectorAll('.item').forEach(function(x){x.classList.toggle('active', x===it);});
      activeItem=it; dtitle.textContent=text.slice(0,42); thread.innerHTML='';
      viewHome.hidden=true; viewDlg.hidden=false; updateDialogList();
    }
    generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
    thread.appendChild(userTurn(text)); stick=true; toBottom();
    genAssistant(btn, detectMode(text), mockTool(text), text);
  }

  function stopGen(btn){ clearTimers(); generating=false; setSend(btn,false); setItemGenerating(activeItem,false);
    var th=thread.querySelector('.thinking'); if(th){ th.closest('.turn').remove(); return; }
    var turn=thread.querySelector('.turn.a:last-child'); if(!turn) return;
    var c=turn.querySelector('.caret'); if(c) c.remove();
    /* stopped mid tool-call: freeze the running ripple into a neutral head */
    var rip=turn.querySelector('.tool .rip'); if(rip){ var head=turn.querySelector('.tool .head'); if(head) head.innerHTML='<span class="tag">WebSearch</span> · остановлено'; }
    if(!turn.querySelector('.stopped')){ var s=document.createElement('div'); s.className='stopped'; s.innerHTML='⏹ Остановлено'; turn.appendChild(s); }
    var mdbox=turn.querySelector('.md');
    if(mdbox && mdbox.textContent.trim() && !turn.querySelector('.row-acts')){ turn.insertAdjacentHTML('beforeend','<div class="row-acts">'+actBtn('copy','Копировать')+actBtn('regen','Перегенерировать')+'</div>'); }
  }

  function wireComposer(scope){ var ta=scope.querySelector('textarea'); var btn=scope.querySelector('.send');
    var clip=scope.querySelector('.clip'); var atts=scope.querySelector('.attachments');
    function refresh(){ if(!btn.classList.contains('stop')) btn.classList.toggle('off', !(ta.value||'').trim() && atts.children.length===0); }
    function trySend(){ if(btn.classList.contains('stop')) return; var v=(ta.value||'').trim(); if(!v && atts.children.length===0) return; ta.value=''; atts.innerHTML=''; refresh(); sendFlow(v||'(вложение)', btn); }
    btn.addEventListener('click', function(){ if(btn.classList.contains('stop')){ stopGen(btn); return; } trySend(); });
    ta.addEventListener('input', refresh);
    ta.addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); trySend(); } });
    if(clip){ var names=['заметки.md','скрин.png','config.toml','данные.csv']; clip.addEventListener('click', function(){
      var nm=names[atts.children.length % names.length]; var chip=document.createElement('span'); chip.className='att';
      chip.innerHTML='<span>'+nm+'</span><span class="ax">×</span>';
      chip.querySelector('.ax').addEventListener('click', function(){ chip.remove(); refresh(); });
      atts.appendChild(chip); refresh();
    }); }
    refresh();
  }
  wireComposer(document.querySelector('#view-home .entry'));
  wireComposer(document.querySelector('#view-dialog .entry'));

  /* ---------- sidebar item click + kebab menu ---------- */
  var current=null;
  var menu=document.createElement('div'); menu.className='menu';
  menu.innerHTML='<button data-m="rename">'+IC.edit+'Переименовать</button><button data-m="pin">'+IC.pin+'<span class="pin-label">Закрепить</span></button><div class="sep"></div><button data-m="del" class="danger">'+IC.trash+'Удалить</button>';
  document.body.appendChild(menu);
  leftDrawer.addEventListener('click', function(e){
    var kb=e.target.closest('.kebab');
    if(kb){ e.stopPropagation(); current=kb.closest('.item');
      var r=kb.getBoundingClientRect(); menu.style.top=(r.bottom+6)+'px'; menu.style.left=Math.max(8, Math.min(r.right-176, window.innerWidth-184))+'px';
      menu.querySelector('.pin-label').textContent=current.classList.contains('pinned')?'Открепить':'Закрепить'; menu.style.display='block'; return; }
    var it=e.target.closest('.item'); if(it && it.dataset.i!=null){ openDialog(+it.dataset.i, it); }
  });
  document.addEventListener('click', function(){ menu.style.display='none'; });
  menu.addEventListener('click', function(e){ var btn=e.target.closest('button'); if(!btn||!current) return; var m=btn.dataset.m;
    if(m==='rename'){ var t=current.querySelector('.t'); t.contentEditable='true'; t.classList.add('editing'); t.focus();
      t.addEventListener('blur', function(){t.contentEditable='false';t.classList.remove('editing');},{once:true});
      t.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ev.preventDefault(); t.blur();} }); }
    else if(m==='pin'){ current.classList.toggle('pinned'); updateDialogList(); }
    else if(m==='del'){ askDelete(current); }
  });

  /* delete confirmation modal */
  var pendingDel=null, confirmScrim=document.getElementById('confirmScrim');
  function askDelete(item){ pendingDel=item; document.getElementById('confirmText').textContent='«'+item.querySelector('.t').textContent.trim()+'» будет удалён без возможности восстановления.'; confirmScrim.hidden=false; }
  function closeConfirm(){ confirmScrim.hidden=true; pendingDel=null; }
  document.getElementById('confirmOk').addEventListener('click', function(){ if(pendingDel){ var wasActive=(pendingDel===activeItem); pendingDel.remove(); updateDialogList(); if(wasActive) newDialog(); } closeConfirm(); });
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
    var prevU=turn.previousElementSibling;
    var ut=(prevU&&prevU.classList.contains('u'))?prevU.querySelector('.bubble').textContent:'';
    var btn=dlgSend(); if(!btn) return;
    generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
    while(turn.nextSibling) turn.parentNode.removeChild(turn.nextSibling);
    turn.remove();
    genAssistant(btn, detectMode(ut), mockTool(ut), ut);
  }
  /* edit a user message: inline editor → on save, truncate after it and regenerate
     (mirrors how OWUI/real chat re-runs from an edited turn) */
  function editUserTurn(turn){ if(generating) return;
    var bubble=turn.querySelector('.bubble'); if(!bubble) return;
    var orig=bubble.textContent, rowacts=turn.querySelector('.row-acts');
    var ta=document.createElement('textarea'); ta.className='editbox'; ta.value=orig;
    var acts=document.createElement('div'); acts.className='editacts';
    acts.innerHTML='<button class="ecancel" type="button">Отмена</button><button class="esave" type="button">Сохранить и отправить</button>';
    bubble.replaceWith(ta); if(rowacts) rowacts.style.display='none'; turn.appendChild(acts);
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    function restore(text){ var nb=document.createElement('div'); nb.className='bubble'; nb.textContent=text; ta.replaceWith(nb); acts.remove(); if(rowacts) rowacts.style.display=''; }
    acts.querySelector('.ecancel').onclick=function(){ restore(orig); };
    acts.querySelector('.esave').onclick=function(){ var nv=(ta.value||'').trim()||orig; restore(nv);
      while(turn.nextSibling) turn.parentNode.removeChild(turn.nextSibling);
      var btn=dlgSend(); if(!btn) return;
      generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
      genAssistant(btn, detectMode(nv), mockTool(nv), nv);
    };
    ta.addEventListener('keydown', function(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); acts.querySelector('.esave').click(); } else if(e.key==='Escape'){ e.preventDefault(); restore(orig); } });
  }
  thread.addEventListener('click', function(e){
    var cp=e.target.closest('.code .copy'); if(cp){ copyText(cp.closest('.code').querySelector('pre').textContent, cp); return; }
    var a=e.target.closest('.act'); if(!a) return; var act=a.dataset.act, turn=a.closest('.turn');
    if(act==='copy'){ var src=turn.querySelector('.md')||turn.querySelector('.bubble'); copyText(src.textContent, a); }
    else if(act==='regen'){ regenTurn(turn); }
    else if(act==='edit'){ editUserTurn(turn); }
    else if(act==='up'||act==='down'){ a.classList.toggle('on'); var other=turn.querySelector('[data-act='+(act==='up'?'down':'up')+']'); if(other)other.classList.remove('on'); }
  });

  /* ---------- settings: save & restart (core restart loader) ---------- */
  function engineUrlValid(){ var u=document.querySelector('.drawer.right .fieldrow input'); return /^https?:\/\/.+/i.test((u&&u.value||'').trim()); }
  function saveError(){ var sm=document.getElementById('saveMsg'); sm.hidden=false; sm.className='savemsg err'; sm.textContent='Не удалось сохранить — укажи корректный адрес движка'; }

  document.getElementById('saveRestart').addEventListener('click', function(){
    if(!engineUrlValid()){ saveError(); return; }
    var btn=this; var o=btn.innerHTML; btn.disabled=true;
    btn.innerHTML='<span style="display:inline-flex;align-items:center;gap:9px;justify-content:center;">'+cloud(26)+'Перезапуск ядра…</span>';
    setTimeout(function(){ btn.innerHTML=IC.check+' Готово'; setTimeout(function(){ btn.innerHTML=o; btn.disabled=false; }, 1100); }, 2000);
  });

  document.getElementById('saveOnly').addEventListener('click', function(){
    if(!engineUrlValid()){ saveError(); return; }
    var sm=document.getElementById('saveMsg'); sm.hidden=false; sm.className='savemsg'; sm.textContent='Сохранено';
    setTimeout(function(){ sm.hidden=true; }, 1800);
  });

  /* ---------- backend connection check (like OWUI) ---------- */
  function setConnDot(state){ document.querySelectorAll('.entry .model .dot').forEach(function(d){ d.style.background = state==='err' ? '#d97b7b' : (state==='ok' ? '#5fa97e' : '#8a8b91'); }); }
  document.getElementById('checkBackend').addEventListener('click', function(){
    var btn=this, st=document.getElementById('checkStatus');
    var url=(btn.closest('.fieldrow').querySelector('input').value||'').trim();
    btn.classList.add('spin'); st.hidden=true;
    setTimeout(function(){
      btn.classList.remove('spin'); st.hidden=false;
      if(/^https?:\/\/.+/i.test(url)){
        st.className='cstatus ok'; st.innerHTML='<span class="d"></span><span>Подключено</span>'; setConnDot('ok');
        if(!configured){ configured=true; document.getElementById('view-setup').hidden=true; viewHome.hidden=false; }
      } else {
        st.className='cstatus err'; st.innerHTML='<span class="d"></span><span>Не удалось подключиться</span>'; setConnDot('err');
      }
    }, 1000);
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

  /* ---------- system-prompt presets (variant B: list here + editor in center) ---------- */
  var presets=[
    {name:'Обычный', prompt:'Ты — полезный локальный ассистент. Отвечай кратко и по делу, на русском.'},
    {name:'Кодер', prompt:'Ты — старший инженер. Пиши идиоматичный код, кратко поясняй решения, предлагай тесты. Ответы — на русском, код и комментарии — на английском.'},
    {name:'Краткий', prompt:'Отвечай максимально кратко — одно-два предложения, без воды.'}
  ];
  var activePreset=0, editingIdx=null;
  var presetList=document.getElementById('presetList');
  var vPreset=document.getElementById('view-preset');

  function updateChip(){ var nm=presets[activePreset]?presets[activePreset].name:'—';
    document.querySelectorAll('.entry .model').forEach(function(m){ m.innerHTML='<span class="dot"></span>'+esc(nm); }); }

  function renderPresetList(){
    presetList.innerHTML='';
    presets.forEach(function(p,i){
      var row=document.createElement('div'); row.className='prow'+(i===activePreset?' active':'');
      row.innerHTML='<span class="pdot"></span><span class="pn">'+esc(p.name)+'</span>'+
        '<button class="pm pedit" title="Изменить" aria-label="Изменить">'+IC.edit+'</button>'+
        '<button class="pm pdel" title="Удалить" aria-label="Удалить">'+IC.trash+'</button>';
      row.addEventListener('click', function(e){
        if(e.target.closest('.pedit')){ openPresetEditor(i); return; }
        if(e.target.closest('.pdel')){ if(presets.length>1){ presets.splice(i,1); if(activePreset>=i&&activePreset>0)activePreset--; updateChip(); renderPresetList(); } return; }
        activePreset=i; updateChip(); renderPresetList();
      });
      presetList.appendChild(row);
    });
    var add=document.createElement('div'); add.className='padd'; add.textContent='+ Новый пресет';
    add.addEventListener('click', function(){ openPresetEditor(-1); });
    presetList.appendChild(add);
  }

  function openPresetEditor(idx){ editingIdx=idx; var p=idx>=0?presets[idx]:{name:'',prompt:''};
    document.getElementById('presetName').value=p.name; document.getElementById('presetPrompt').value=p.prompt;
    closeDrawers(); viewHome.hidden=true; viewDlg.hidden=true; document.getElementById('view-setup').hidden=true; vPreset.hidden=false;
    setTimeout(function(){ document.getElementById('presetName').focus(); }, 150);
  }
  function closePresetEditor(){ vPreset.hidden=true; newDialog(); }
  document.getElementById('presetSave').onclick=function(){
    var name=(document.getElementById('presetName').value||'').trim()||'Без имени';
    var prompt=document.getElementById('presetPrompt').value||'';
    if(editingIdx>=0){ presets[editingIdx]={name:name,prompt:prompt}; }
    else { presets.push({name:name,prompt:prompt}); activePreset=presets.length-1; }
    updateChip(); renderPresetList(); closePresetEditor();
  };
  document.getElementById('presetCancel').onclick=closePresetEditor;
  document.getElementById('presetBack').onclick=closePresetEditor;
  renderPresetList(); updateChip();

  /* first run → setup screen; otherwise land on home (new dialog) */
  if(configured){ newDialog(); } else { showSetup(); }
})();
