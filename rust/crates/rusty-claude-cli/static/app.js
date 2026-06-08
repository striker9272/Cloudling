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

  /* ---------- dialog storage (server-backed: GET/PUT/DELETE /ui/dialogs) ---------- */
  var activeId=null;
  function genId(){ return 'd-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8); }
  function dlgApi(method, path, body){
    return fetch('/ui/dialogs'+path, {
      method:method,
      headers: body ? {'Content-Type':'application/json'} : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  }
  function apiList(){ return dlgApi('GET','').then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; }); }
  function apiGet(id){ return dlgApi('GET','/'+encodeURIComponent(id)).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }); }
  function apiSave(id,title,messages){ return dlgApi('PUT','/'+encodeURIComponent(id),{title:title,messages:messages}).catch(function(){}); }
  function apiDelete(id){ return dlgApi('DELETE','/'+encodeURIComponent(id)).catch(function(){}); }

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
  /* stored assistant message → turn (content may carry inline tool-call <details>) */
  function assistantTurnEl(content){
    var t=document.createElement('div'); t.className='turn a';
    paintTurn(t, content||'', false);
    t.insertAdjacentHTML('beforeend','<div class="row-acts">'+actBtn('copy','Копировать')+actBtn('regen','Перегенерировать')+actBtn('up','Нравится')+actBtn('down','Не нравится')+'</div>');
    return t;
  }
  function renderConvo(messages){ thread.innerHTML=''; convo=(messages||[]).map(function(m){ return {role:m.role, content:m.content}; });
    convo.forEach(function(m){ thread.appendChild(m.role==='user' ? userTurn(m.content) : assistantTurnEl(m.content)); }); }

  function fmtDate(ms){ if(!ms) return ''; var d=new Date(ms), now=new Date();
    if(d.toDateString()===now.toDateString()) return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    return ('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2); }
  function sidebarItem(d){ var it=document.createElement('div'); it.className='item'; it.dataset.id=d.id;
    it.innerHTML='<span class="t">'+esc(d.title||'Без названия')+'</span><span class="date">'+fmtDate(d.updated_ms)+'</span><button class="kebab" aria-label="Действия">⋯</button>'; return it; }
  function refreshSidebar(){ return apiList().then(function(list){
    leftDrawer.querySelectorAll('.item').forEach(function(n){ n.remove(); });
    var anchor=document.getElementById('emptyNone');
    list.forEach(function(d){ var it=sidebarItem(d); if(d.id===activeId){ it.classList.add('active'); activeItem=it; } leftDrawer.insertBefore(it, anchor); });
    updateDialogList(); return list; }); }

  /* fade a full view out while it's laid on top (out of flow), then hide it */
  function dissolveOut(view){
    view.style.position='absolute'; view.style.inset='0'; view.style.zIndex='1'; view.style.pointerEvents='none';
    var a=view.animate([{opacity:1},{opacity:0}],{duration:200, easing:'ease-in'});
    a.onfinish=function(){ view.hidden=true; view.style.position=''; view.style.inset=''; view.style.zIndex=''; view.style.pointerEvents=''; };
  }
  function openDialog(id, el){
    var wasDialog=(viewDlg.hidden===false), wasHome=(viewHome.hidden===false);
    activeId=id; document.getElementById('view-setup').hidden=true; document.getElementById('view-preset').hidden=true;
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
    document.getElementById('view-setup').hidden=true; viewHome.hidden=false; activeId=null; activeItem=null; convo=[];
    leftDrawer.querySelectorAll('.item').forEach(function(it){ it.classList.remove('active'); });
    /* dialog → new chat: dissolve the dialog to reveal home, fade the hero in */
    if(wasDialog && viewDlg.animate){
      dissolveOut(viewDlg);
      var hero=viewHome.querySelector('.hero'); if(hero && hero.animate){ hero.animate([{opacity:0, transform:'translateY(-8px)'},{opacity:1, transform:'none'}],{duration:260, easing:'ease-out'}); }
    } else { viewDlg.hidden=true; }
  }
  /* persist the active dialog (full transcript) */
  function saveActive(){ if(!activeId) return; var title=(dtitle.textContent||'').trim() || ((convo[0]&&convo[0].content)||'').slice(0,42) || 'Без названия'; apiSave(activeId, title, convo); }
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
    var pre=document.createElement('pre'); pre.className='toolout';
    var raw=decodeEntities(out), text;
    try{ var parsed=JSON.parse(raw); text=(typeof parsed==='string')?parsed:JSON.stringify(parsed,null,2); }
    catch(e){ text=raw; }
    pre.textContent=text;
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
    turn.innerHTML='<div class="thinking">'+cloud(38)+'<span>clab думает…</span></div>';
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
      saveActive();
      finishGen(btn); maybeScroll();
    }
    fetch('/v1/chat/completions', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ model:'claw', stream:true, messages:outgoingMessages() }),
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

  function sendFlow(text, btn){
    if(viewHome.hidden===false){ /* coming from home: start a real new dialog */
      var homeEntry=document.querySelector('#view-home .entry');
      var fromRect=homeEntry?homeEntry.getBoundingClientRect():null;
      activeId=genId();
      var title=text.slice(0,42);
      var it=sidebarItem({id:activeId, title:title, updated_ms:Date.now()}); it.classList.add('active');
      var firstItem=leftDrawer.querySelector('.item'); leftDrawer.insertBefore(it, firstItem || document.getElementById('emptyNone'));
      leftDrawer.querySelectorAll('.item').forEach(function(x){x.classList.toggle('active', x===it);});
      activeItem=it; dtitle.textContent=title; thread.innerHTML=''; convo=[];
      viewDlg.hidden=false; updateDialogList(); leaveHome();
      btn = dlgSend() || btn; /* we switched to the dialog view — drive stop/send on its (visible) button */
      if(fromRect) dockMorph(fromRect); /* slide the composer from center down into the dock */
      var dh=viewDlg.querySelector('.dhdr'); if(dh && dh.animate){ dh.animate([{opacity:0},{opacity:1}],{duration:260, easing:'ease-out'}); }
    }
    convo.push({role:'user', content:text});
    saveActive(); /* persist now so the dialog exists even before the answer */
    generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
    var ut=userTurn(text); thread.appendChild(ut); stick=true; toBottom();
    if(ut.animate){ ut.animate([{opacity:0, transform:'translateY(8px)'},{opacity:1, transform:'none'}],{duration:280, easing:'cubic-bezier(.4,0,.2,1)'}); }
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
    /* attachments not wired yet — keep the button visible but inactive */
    if(clip){ clip.disabled=true; clip.setAttribute('aria-disabled','true'); clip.title='Вложения — скоро'; }
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
    var it=e.target.closest('.item'); if(it && it.dataset.id){ openDialog(it.dataset.id, it); }
  });
  document.addEventListener('click', function(){ menu.style.display='none'; });
  menu.addEventListener('click', function(e){ var btn=e.target.closest('button'); if(!btn||!current) return; var m=btn.dataset.m;
    if(m==='rename'){ var item=current, t=current.querySelector('.t'); t.contentEditable='true'; t.classList.add('editing'); t.focus();
      t.addEventListener('blur', function(){ t.contentEditable='false'; t.classList.remove('editing'); var nv=(t.textContent||'').trim(), id=item.dataset.id;
        if(nv && id){ if(id===activeId){ dtitle.textContent=nv; apiSave(id,nv,convo); } else { apiGet(id).then(function(d){ apiSave(id, nv, d?d.messages:[]); }); } } },{once:true});
      t.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ev.preventDefault(); t.blur();} }); }
    else if(m==='pin'){ current.classList.toggle('pinned'); updateDialogList(); }
    else if(m==='del'){ askDelete(current); }
  });

  /* delete confirmation modal */
  var pendingDel=null, confirmScrim=document.getElementById('confirmScrim');
  function askDelete(item){ pendingDel=item; document.getElementById('confirmText').textContent='«'+item.querySelector('.t').textContent.trim()+'» будет удалён без возможности восстановления.'; confirmScrim.hidden=false; }
  function closeConfirm(){ confirmScrim.hidden=true; pendingDel=null; }
  document.getElementById('confirmOk').addEventListener('click', function(){ if(pendingDel){ var wasActive=(pendingDel===activeItem); var id=pendingDel.dataset.id; if(id) apiDelete(id); pendingDel.remove(); updateDialogList(); if(wasActive) newDialog(); } closeConfirm(); });
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

  /* ---------- settings «Основное»: load active values, save + self-restart ---------- */
  function settingsFields(){ return document.querySelectorAll('.drawer.right [data-key]'); }
  function loadSettings(){
    return fetch('/ui/settings').then(function(r){ return r.ok?r.json():null; }).then(function(s){
      if(!s) return;
      settingsFields().forEach(function(el){ var k=el.getAttribute('data-key'); if(k in s) el.value=s[k]||''; });
      var sr=document.getElementById('saveRestart'); if(sr) sr.disabled=(s._can_save===false);
    }).catch(function(){});
  }
  function engineUrlValid(){ var u=document.querySelector('.drawer.right [data-key="OPENAI_BASE_URL"]'); return /^https?:\/\/.+/i.test((u&&u.value||'').trim()); }
  function saveError(msg){ var sm=document.getElementById('saveMsg'); sm.hidden=false; sm.className='savemsg err'; sm.textContent=msg||'Не удалось сохранить — укажи корректный адрес движка'; }

  /* the server rewrites the env file then exits; systemd restarts it with the new values.
     we show a loader and poll /health until it answers again. */
  function waitForRestart(btn,orig){
    setTimeout(function(){
      var tries=0;
      (function poll(){ tries++;
        fetch('/health',{cache:'no-store'}).then(function(r){ return r.ok; }).catch(function(){ return false; })
          .then(function(ok){
            if(ok){ btn.innerHTML=IC.check+' Готово'; loadSettings(); setTimeout(function(){ btn.innerHTML=orig; btn.disabled=false; }, 1200); }
            else if(tries>45){ btn.innerHTML=orig; btn.disabled=false; saveError('Сервер не вернулся — проверь вручную'); }
            else setTimeout(poll, 600);
          });
      })();
    }, 2500);
  }
  document.getElementById('saveRestart').addEventListener('click', function(){
    if(!engineUrlValid()){ saveError(); return; }
    var btn=this, o=btn.innerHTML; document.getElementById('saveMsg').hidden=true; btn.disabled=true;
    var body={}; settingsFields().forEach(function(el){ body[el.getAttribute('data-key')]=el.value||''; });
    btn.innerHTML='<span style="display:inline-flex;align-items:center;gap:9px;justify-content:center;">'+cloud(26)+'Перезапуск ядра…</span>';
    fetch('/ui/settings/save-restart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){ if(!r.ok){ return r.text().then(function(t){ throw new Error(t||('HTTP '+r.status)); }); } return r.json(); })
      .then(function(){ waitForRestart(btn,o); })
      .catch(function(err){ btn.innerHTML=o; btn.disabled=false; saveError('Не удалось сохранить: '+((err&&err.message)||'')); });
  });

  /* ---------- security section: settings.json-backed config (no restart) ---------- */
  function cfgSandboxFields(){ return document.querySelectorAll('.drawer.right [data-sb]'); }
  function linesToArray(s){ return (s||'').split('\n').map(function(x){ return x.trim(); }).filter(function(x){ return x.length; }); }
  function loadConfig(){
    return fetch('/ui/config').then(function(r){ return r.ok?r.json():null; }).then(function(c){
      if(!c) return;
      var sb=c.sandbox||{};
      var defaults={enabled:true, filesystemMode:'workspace-only', networkIsolation:false, namespaceRestrictions:true};
      cfgSandboxFields().forEach(function(el){
        var k=el.getAttribute('data-sb');
        var v=(sb && k in sb)?sb[k]:defaults[k];
        if(typeof v==='boolean') v=v?'true':'false';
        el.value=(v==null?'':String(v));
      });
      document.getElementById('cfgTrusted').value=(c.trustedRoots||[]).join('\n');
      var perm=c.permissions||{};
      document.getElementById('cfgAllow').value=(perm.allow||[]).join('\n');
      document.getElementById('cfgDeny').value=(perm.deny||[]).join('\n');
    }).catch(function(){});
  }
  function cfgMsg(ok,text){ var m=document.getElementById('cfgMsg'); m.hidden=false; m.className='savemsg'+(ok?'':' err'); m.textContent=text; if(ok) setTimeout(function(){ m.hidden=true; }, 2400); }
  document.getElementById('cfgSave').addEventListener('click', function(){
    var btn=this; btn.disabled=true; document.getElementById('cfgMsg').hidden=true;
    var sandbox={};
    cfgSandboxFields().forEach(function(el){
      var k=el.getAttribute('data-sb'), v=el.value;
      sandbox[k]=(v==='true')?true:(v==='false')?false:v;
    });
    var body={ sandbox:sandbox, trustedRoots:linesToArray(document.getElementById('cfgTrusted').value), permissions:{ allow:linesToArray(document.getElementById('cfgAllow').value), deny:linesToArray(document.getElementById('cfgDeny').value) } };
    fetch('/ui/config/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){ if(!r.ok){ return r.text().then(function(t){ throw new Error(t||('HTTP '+r.status)); }); } return r.json(); })
      .then(function(){ btn.disabled=false; cfgMsg(true,'Сохранено — применится со следующего сообщения'); })
      .catch(function(err){ btn.disabled=false; cfgMsg(false,'Не удалось сохранить: '+((err&&err.message)||'')); });
  });
  loadConfig();

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

  /* ---------- system-prompt presets (server-backed; applied as a leading system message,
       exactly how OWUI sends its model's system prompt) ---------- */
  var presets=[], activePresetId=null, editingId=null;
  var presetList=document.getElementById('presetList');
  var vPreset=document.getElementById('view-preset');
  var DEFAULT_PRESETS=[
    {name:'Обычный', prompt:'Ты — полезный локальный ассистент. Отвечай кратко и по делу, на русском.'},
    {name:'Кодер', prompt:'Ты — старший инженер. Пиши идиоматичный код, кратко поясняй решения, предлагай тесты. Ответы — на русском, код и комментарии — на английском.'},
    {name:'Краткий', prompt:'Отвечай максимально кратко — одно-два предложения, без воды.'}
  ];
  function pFetchJSON(url){ return fetch(url).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }
  function savePreset(id,name,prompt){ return fetch('/ui/presets/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,prompt:prompt})}).catch(function(){}); }
  function deletePresetReq(id){ return fetch('/ui/presets/'+encodeURIComponent(id),{method:'DELETE'}).catch(function(){}); }
  function setActivePreset(id){ activePresetId=id||null; return fetch('/ui/kv/active_preset',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:id||''})}).catch(function(){}); }
  function activePresetPrompt(){ for(var i=0;i<presets.length;i++){ if(presets[i].id===activePresetId) return presets[i].prompt||''; } return ''; }
  /* what we actually send: active preset's prompt prepended as a system message (or just convo) */
  function outgoingMessages(){ var sys=activePresetPrompt(); return sys ? [{role:'system', content:sys}].concat(convo) : convo; }

  function updateChip(){ var nm='Без пресета';
    for(var i=0;i<presets.length;i++){ if(presets[i].id===activePresetId){ nm=presets[i].name; break; } }
    document.querySelectorAll('.entry .model').forEach(function(m){ m.innerHTML='<span class="dot"></span>'+esc(nm); }); }

  function renderPresetList(){
    presetList.innerHTML='';
    presets.forEach(function(p){
      var row=document.createElement('div'); row.className='prow'+(p.id===activePresetId?' active':'');
      row.innerHTML='<span class="pdot"></span><span class="pn">'+esc(p.name)+'</span>'+
        '<button class="pm pedit" title="Изменить" aria-label="Изменить">'+IC.edit+'</button>'+
        '<button class="pm pdel" title="Удалить" aria-label="Удалить">'+IC.trash+'</button>';
      row.addEventListener('click', function(e){
        if(e.target.closest('.pedit')){ openPresetEditor(p.id); return; }
        if(e.target.closest('.pdel')){ deletePresetReq(p.id).then(loadPresets); return; }
        setActivePreset(p.id).then(function(){ renderPresetList(); updateChip(); });
      });
      presetList.appendChild(row);
    });
    var add=document.createElement('div'); add.className='padd'; add.textContent='+ Новый пресет';
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
    var name=(document.getElementById('presetName').value||'').trim()||'Без имени';
    var prompt=document.getElementById('presetPrompt').value||'';
    var id=editingId||genId(), isNew=!editingId;
    savePreset(id,name,prompt).then(function(){ if(isNew) return setActivePreset(id); }).then(loadPresets).then(closePresetEditor);
  };
  document.getElementById('presetCancel').onclick=closePresetEditor;
  document.getElementById('presetBack').onclick=closePresetEditor;

  function loadPresets(){
    return pFetchJSON('/ui/presets').then(function(list){
      if(Array.isArray(list) && list.length===0){
        return Promise.all(DEFAULT_PRESETS.map(function(p){ return savePreset(genId(), p.name, p.prompt); })).then(function(){ return pFetchJSON('/ui/presets'); });
      }
      return list;
    }).then(function(list){ presets=Array.isArray(list)?list:[];
      return pFetchJSON('/ui/kv/active_preset');
    }).then(function(kv){ activePresetId=(kv&&kv.value)?kv.value:(presets[0]?presets[0].id:null);
      renderPresetList(); updateChip();
    });
  }
  loadPresets();

  /* first run → setup screen; otherwise land on home (new dialog) */
  refreshSidebar();
  loadSettings();
  if(configured){ newDialog(); } else { showSetup(); }
})();
