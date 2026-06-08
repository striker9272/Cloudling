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

  function renderDialog(i){ thread.innerHTML=''; convo=[]; dialogs[i].msgs.forEach(function(m){ thread.appendChild(m.r==='u'?userTurn(m.text):assistantTurn(m)); convo.push({role:(m.r==='u'?'user':'assistant'), content:m.text}); }); }

  function openDialog(i,el){ var d=dialogs[i]; if(!d) return;
    dtitle.textContent=d.title; viewHome.hidden=true; document.getElementById('view-setup').hidden=true; document.getElementById('view-preset').hidden=true; viewDlg.hidden=false;
    leftDrawer.querySelectorAll('.item').forEach(function(it){ it.classList.toggle('active', it===el); });
    activeItem=el;
    /* skeleton (S4) while "loading" the conversation */
    var tok=++skelToken; thread.innerHTML=SKELETON;
    setTimeout(function(){ if(tok===skelToken){ renderDialog(i); stick=true; toBottom(); updateScrollBtn(); } }, 700);
  }
  function newDialog(){ viewDlg.hidden=true; document.getElementById('view-setup').hidden=true; viewHome.hidden=false; activeItem=null; convo=[];
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

  function errboxHTML(){ return '<div class="errbox"><div class="ehead">'+IC.warn+'Не удалось получить ответ</div><div class="emsg">Движок не ответил. Проверь, что бэкенд запущен и адрес указан верно.</div><button class="retry" type="button">'+IC.regen+'Повторить</button></div>'; }

  /* ---------- real chat ----------
     The page is the client: it holds the dialog history and re-sends it every turn
     (clab is stateless). `convo` is that history; one thread `.turn` maps 1:1 to one
     convo entry, so we can rewind both together on regenerate / edit. */
  var convo = [], currentAbort = null;
  function turnIndex(turn){ return Array.prototype.indexOf.call(thread.querySelectorAll('.turn'), turn); }

  function attachRetry(turn, btn){ var r=turn.querySelector('.retry'); if(!r) return;
    r.addEventListener('click', function(){ if(generating) return;
      generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
      turn.remove(); generate(btn);
    });
  }

  /* ---- tool-call blocks in the stream (task #8) ----
     clab streams tool results inline in the content as one chunk shaped like:
       <details type="tool_calls" ... name="X">…<summary>Tool Executed|Tool Failed</summary>OUTPUT</details>
     We peel those out and render each as its own collapsible block, markdown-rendering the
     surrounding text. (ToolUse has no separate stream event, so there is no "running" state —
     the block appears already executed.) */
  var TOOL_RE=/<details type="tool_calls"[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/details>/g;
  function decodeEntities(s){ return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&'); }
  function buildToolEl(name, inner){
    var fail=/<summary>\s*Tool Failed/i.test(inner);
    var out=inner.replace(/<summary>[\s\S]*?<\/summary>/i,'').replace(/^\s+|\s+$/g,'');
    var d=document.createElement('details'); d.className='tool'+(fail?' fail':'');
    var sum=document.createElement('summary'); sum.className='head';
    sum.innerHTML=(fail?IC.warn:'')+'<span class="tag">'+esc(decodeEntities(name))+'</span> · '+(fail?'ошибка':'выполнено');
    var pre=document.createElement('pre'); pre.className='toolout'; pre.textContent=decodeEntities(out);
    d.appendChild(sum); d.appendChild(pre); return d;
  }
  /* rebuild the assistant turn body from the raw accumulated content; caret only while streaming */
  function paintTurn(turn, raw, streaming){
    turn.innerHTML='';
    var pos=0, m, segs=[]; TOOL_RE.lastIndex=0;
    while((m=TOOL_RE.exec(raw))!==null){
      if(m.index>pos) segs.push({t:'text', v:raw.slice(pos, m.index)});
      segs.push({t:'tool', name:m[1], inner:m[2]});
      pos=TOOL_RE.lastIndex;
    }
    if(pos<raw.length) segs.push({t:'text', v:raw.slice(pos)});
    segs.forEach(function(s, i){
      if(s.t==='tool'){ turn.appendChild(buildToolEl(s.name, s.inner)); return; }
      if(!s.v.replace(/\s/g,'')) return; /* skip whitespace-only gaps between blocks */
      var box=document.createElement('div'); box.className='md';
      var isLast=(i===segs.length-1);
      if(streaming && isLast){ box.textContent=s.v; } else { box.innerHTML=md(s.v); }
      turn.appendChild(box);
    });
    if(streaming){ var c=document.createElement('span'); c.className='caret'; turn.appendChild(c); }
  }

  /* Tasks #7–#8: stream the answer and render inline tool-call blocks. */
  function generate(btn){
    var turn=document.createElement('div'); turn.className='turn a';
    turn.innerHTML='<div class="thinking">'+cloud(38)+'<span>Claw думает…</span></div>';
    thread.appendChild(turn); stick=true; maybeScroll();
    var ac=new AbortController(); currentAbort=ac;
    var acc='', committed=0, liveBox=null, caretEl=null, thinkingShown=true;
    /* Incremental render: completed tool blocks + the text before them are committed ONCE
       (permanent DOM); the trailing text node is re-rendered as markdown each token so
       formatting appears live (progressive, like OpenWebUI). liveBox stays the last child
       and is the anchor we insert committed blocks before, so the tool blocks never get
       rebuilt/re-collapsed mid-stream. */
    function onContent(piece){
      acc+=piece;
      if(thinkingShown){ turn.innerHTML=''; thinkingShown=false;
        liveBox=document.createElement('div'); liveBox.className='md'; turn.appendChild(liveBox);
        caretEl=document.createElement('span'); caretEl.className='caret'; }
      var m; TOOL_RE.lastIndex=0;
      while((m=TOOL_RE.exec(acc))!==null){
        if(m.index < committed) continue;
        var pre=acc.slice(committed, m.index);
        if(pre.replace(/\s/g,'')){ var b=document.createElement('div'); b.className='md'; b.innerHTML=md(pre); turn.insertBefore(b, liveBox); }
        turn.insertBefore(buildToolEl(m[1], m[2]), liveBox);
        committed=m.index+m[0].length;
      }
      liveBox.innerHTML=md(acc.slice(committed));            /* progressive markdown */
      (liveBox.lastElementChild || liveBox).appendChild(caretEl);  /* caret at end of last line */
      maybeScroll();
    }
    function finalize(){
      paintTurn(turn, acc, false); /* one clean final render (markdown + tool blocks, no caret) */
      turn.insertAdjacentHTML('beforeend','<div class="row-acts">'+actBtn('copy','Копировать')+actBtn('regen','Перегенерировать')+actBtn('up','Нравится')+actBtn('down','Не нравится')+'</div>');
      convo.push({role:'assistant', content:acc});
      finishGen(btn); maybeScroll();
    }
    fetch('/v1/chat/completions', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ model:'claw', stream:true, messages:convo }),
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
              var delta=chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
              if(delta && delta.content){ onContent(delta.content); }
            }catch(e){ /* ignore keep-alives / partial chunks */ }
          });
          return pump();
        });
      }
      return pump();
    }).catch(function(err){
      if(err && err.name==='AbortError'){ return; } /* stop button owns the UI */
      turn.innerHTML=errboxHTML(); attachRetry(turn, btn);
      finishGen(btn); maybeScroll();
    }).then(function(){ if(currentAbort===ac) currentAbort=null; });
  }

  function sendFlow(text, btn){
    if(viewHome.hidden===false){ /* coming from home: open a fresh dialog */
      var it=document.createElement('div'); it.className='item active'; it.dataset.i='0';
      it.innerHTML='<span class="t">'+esc(text.slice(0,42))+'</span><span class="date">сейчас</span><button class="kebab" aria-label="Действия">⋯</button>';
      var firstItem=leftDrawer.querySelector('.item'); leftDrawer.insertBefore(it, firstItem);
      leftDrawer.querySelectorAll('.item').forEach(function(x){x.classList.toggle('active', x===it);});
      activeItem=it; dtitle.textContent=text.slice(0,42); thread.innerHTML=''; convo=[];
      viewHome.hidden=true; viewDlg.hidden=false; updateDialogList();
    }
    convo.push({role:'user', content:text});
    generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
    thread.appendChild(userTurn(text)); stick=true; toBottom();
    generate(btn);
  }

  function stopGen(btn){ if(currentAbort){ currentAbort.abort(); currentAbort=null; } clearTimers(); generating=false; setSend(btn,false); setItemGenerating(activeItem,false);
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
    var idx=turnIndex(turn); if(idx<0) return;
    var btn=dlgSend(); if(!btn) return;
    /* drop this answer and everything after it, in both the thread and the history */
    while(thread.children.length>idx) thread.removeChild(thread.lastChild);
    convo=convo.slice(0, idx);
    generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
    generate(btn);
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
      var idx=turnIndex(turn); if(idx<0) return;
      /* keep this (edited) user turn, drop everything after; rewrite history from here */
      while(thread.children.length>idx+1) thread.removeChild(thread.lastChild);
      convo=convo.slice(0, idx); convo.push({role:'user', content:nv});
      var btn=dlgSend(); if(!btn) return;
      generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
      generate(btn);
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
