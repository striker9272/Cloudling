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

  /* ---------- transient error toast ---------- */
  var toastTimer=null;
  function toast(msg){
    var el=document.getElementById('toast');
    if(!el){ el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
    el.textContent=msg; el.classList.add('show');
    if(toastTimer) clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){ el.classList.remove('show'); }, 3200);
  }

  /* ---------- UI auth: /ui/* endpoints are token-gated (CLAW_UI_TOKEN) ----------
     The stored token is attached as Authorization: Bearer to every /ui/* call.
     401 → ask for the token (saved to localStorage, then reload); 403 → the server
     has no token configured on a non-loopback bind: endpoints are off, explain why. */
  var uiToken=null; try{ uiToken=localStorage.getItem('clab_ui_token')||null; }catch(e){}
  var tokenGateShown=false;
  function showTokenGate(forbidden){
    if(tokenGateShown) return; tokenGateShown=true;
    var scrim=document.getElementById('tokenScrim'), input=document.getElementById('tokenInput'),
        ok=document.getElementById('tokenOk'), text=document.getElementById('tokenText'),
        title=document.getElementById('tokenTitle');
    if(forbidden){
      title.textContent='Служебные функции отключены';
      text.textContent='На сервере не задан CLAW_UI_TOKEN, а адрес доступен не только с localhost — диалоги и настройки отключены. Задай CLAW_UI_TOKEN в файле настроек сервиса и перезапусти его.';
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
          if(r.status===401){ fail('Токен не подошёл. Нужно значение CLAW_UI_TOKEN из настроек сервера.'); return; }
          if(!r.ok){ fail('Сервер ответил '+r.status+'.'); return; }
          var saved=false;
          try{ localStorage.setItem('clab_ui_token', v); saved=(localStorage.getItem('clab_ui_token')===v); }catch(e){}
          if(saved){ location.reload(); return; }
          /* localStorage blocked (private mode / site-data settings): work with the
             token in memory for this page; it will be asked again after a reload */
          uiToken=v; tokenGateShown=false; scrim.hidden=true;
          refreshSidebar(); loadSettings(); loadDlgToks(); loadDlgErrs(); loadDlgPins(); loadPresets();
        }).catch(function(){ fail('Сервер недоступен.'); });
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
  function apiSave(id,title,messages){ return dlgApi('PUT','/'+encodeURIComponent(id),{title:title,messages:messages}).then(function(r){ if(r&&!r.ok&&r.status!==401&&r.status!==403) toast('Не удалось сохранить диалог'); return r; },function(){ toast('Не удалось сохранить диалог'); }); }
  function apiDelete(id){ return dlgApi('DELETE','/'+encodeURIComponent(id)).then(function(r){ if(r&&!r.ok&&r.status!==401&&r.status!==403) toast('Не удалось удалить диалог'); return r; },function(){ toast('Не удалось удалить диалог'); }); }

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
  function userTurn(msg){ var t=document.createElement('div'); t.className='turn u';
    var text=(typeof msg==='string')?msg:((msg&&msg.content)||'');
    var atts=(msg&&typeof msg==='object'&&msg.atts)?msg.atts:[];
    var inner=(text?esc(text):'')+(atts.length?'<div class="att-row">'+atts.map(attChipHTML).join('')+'</div>':'');
    t.innerHTML='<div class="bubble">'+inner+'</div><div class="row-acts">'+actBtn('copy','Копировать')+actBtn('edit','Редактировать')+'</div>'; return t; }
  /* stored assistant message → turn (content may carry inline tool-call <details>) */
  function assistantTurnEl(content){
    var t=document.createElement('div'); t.className='turn a';
    paintTurn(t, content||'', false);
    t.insertAdjacentHTML('beforeend','<div class="row-acts">'+actBtn('copy','Копировать')+actBtn('regen','Перегенерировать')+'</div>');
    return t;
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
  function setCtxToks(n){ var el=document.getElementById('ctxToks'); if(!el) return; el.textContent=(typeof n==='number')?(n.toLocaleString('ru-RU')+' ток.'):''; }
  function renderConvo(messages){ thread.innerHTML=''; setCtxToks(dlgToks[activeId]); convo=(messages||[]).map(function(m){ return m.atts ? {role:m.role, content:m.content, atts:m.atts} : {role:m.role, content:m.content}; });
    convo.forEach(function(m){ thread.appendChild(m.role==='user' ? userTurn(m) : assistantTurnEl(m.content)); });
    var em=dlgErrs[activeId]; /* unrecovered error from a previous session → re-show the box (lives outside convo) */
    if(em!==undefined){ var et=document.createElement('div'); et.className='turn a noconv'; et.innerHTML=errboxHTML(em); attachRetry(et, dlgSend()); thread.appendChild(et); }
    refreshTaskbar(); }

  function fmtDate(ms){ if(!ms) return ''; var d=new Date(ms), now=new Date();
    if(d.toDateString()===now.toDateString()) return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    return ('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2); }
  function sidebarItem(d){ var it=document.createElement('div'); it.className='item'; it.dataset.id=d.id; it.dataset.updated=d.updated_ms||0;
    if(dlgPins[d.id]) it.classList.add('pinned');
    it.innerHTML='<span class="t">'+esc(d.title||'Без названия')+'</span><span class="date">'+fmtDate(d.updated_ms)+'</span><button class="kebab" aria-label="Действия">⋯</button>'; return it; }
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
    var text='Сообщение: '+firstUser+(firstAsst?('\nОтвет: '+firstAsst):'');
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
    document.getElementById('view-setup').hidden=true; viewHome.hidden=false; activeId=null; activeItem=null; convo=[]; refreshTaskbar();
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

  function finishGen(btn){ generating=false; setSend(btn,false); setItemGenerating(activeItem,false); if(pendingLiveCancel){ pendingLiveCancel(); pendingLiveCancel=null; } }

  function errboxHTML(msg){ var detail = msg ? esc(String(msg)) : 'Движок не ответил. Проверь, что бэкенд запущен и адрес указан верно.'; return '<div class="errbox"><div class="ehead">'+IC.warn+'Не удалось получить ответ</div><div class="emsg">'+detail+'</div><button class="retry" type="button">'+IC.regen+'Повторить</button></div>'; }

  /* ---------- real chat ----------
     The page is the client: it holds the dialog history and re-sends it every turn
     (clab is stateless). `convo` is that history; one thread `.turn` maps 1:1 to one
     convo entry, so we can rewind both together on regenerate / edit. */
  var convo = [], currentAbort = null, liveAcc = '', pendingLiveCancel = null;
  /* Invariant: every *real* `.turn` maps 1:1 onto a `convo` entry. Error boxes are
     marked `.noconv` (they have no history entry) and are excluded from index math,
     so regenerate/edit slice `convo` at the right spot even after a failed turn. */
  function realTurns(){ return Array.prototype.filter.call(thread.querySelectorAll('.turn'), function(t){ return !t.classList.contains('noconv'); }); }
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
     clab streams tool results inline in the content as one chunk shaped like:
       <details type="tool_calls" ... name="X">…<summary>Tool Executed|Tool Failed</summary>OUTPUT</details>
     We peel those out and render each as its own collapsible block, markdown-rendering the
     surrounding text. (ToolUse has no separate stream event, so there is no "running" state —
     the block appears already executed.) */
  var TOOL_RE=/<details type="tool_calls"[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/details>/g;
  /* Generic block matcher: tool-call results AND reasoning blocks. m[1]=kind, m[2]=opening-tag
     attrs (tool name lives here), m[3]=inner. */
  var BLOCK_RE=/<details type="(tool_calls|reasoning)"([^>]*)>([\s\S]*?)<\/details>/g;
  function decodeEntities(s){ return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&'); }
  function blockEl(kind, attrs, inner){
    if(kind==='reasoning') return buildReasonEl(inner);
    var name=(attrs.match(/\bname="([^"]*)"/)||[])[1]||'';
    /* TodoWrite is shown in the task bar under the header, not as an inline plate */
    if(name==='TodoWrite') return null;
    return buildToolEl(name, inner);
  }
  function buildToolEl(name, inner){
    var fail=/<summary>\s*Tool Failed/i.test(inner);
    var out=inner.replace(/<summary>[\s\S]*?<\/summary>/i,'').replace(/^\s+|\s+$/g,'');
    var d=document.createElement('details'); d.className='tool'+(fail?' fail':'');
    var sum=document.createElement('summary'); sum.className='head';
    sum.innerHTML=(fail?IC.warn:'')+'<span class="tag">'+esc(decodeEntities(name))+'</span> · '+(fail?'ошибка':'выполнено');
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
        if(!text) text='(нет вывода)';
      } else {
        text=(typeof parsed==='string')?parsed:JSON.stringify(parsed,null,2);
      }
    }
    catch(e){ text=raw; }
    pre.textContent=text;
    d.appendChild(sum); d.appendChild(pre); return d;
  }
  /* reasoning block: the model's thinking, collapsed by default */
  function buildReasonEl(inner){
    var out=inner.replace(/<summary>[\s\S]*?<\/summary>/i,'').replace(/^\s+|\s+$/g,'');
    var d=document.createElement('details'); d.className='tool reason';
    var sum=document.createElement('summary'); sum.className='head';
    sum.innerHTML='<span class="tag">Размышление</span>';
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
    var nowTxt=active ? (active.activeForm||active.content||'') : (allDone?'Готово':'');
    var head='<button class="tb-head" type="button" aria-expanded="'+(taskbarOpen?'true':'false')+'">'+
      '<span class="tb-ic">'+TB_IC.active+'</span><span class="tb-title">Задачи</span>'+
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
    /* a fresh attempt (retry or a new message) supersedes any stored error for this dialog,
       and any stale error boxes left in the thread are dropped so they don't pile up */
    clearDlgErr();
    thread.querySelectorAll('.turn').forEach(function(t){ if(t.querySelector('.errbox')) t.remove(); });
    var turn=document.createElement('div'); turn.className='turn a';
    turn.innerHTML='<div class="thinking">'+cloud(38)+'<span>clab думает…</span></div>';
    thread.appendChild(turn); stick=true; maybeScroll();
    var ac=new AbortController(); currentAbort=ac;
    var acc='', committed=0, liveBox=null, caretEl=null, thinkingShown=true, errored=false;
    liveAcc=''; /* mirror of acc for stopGen (partial answer must reach convo on stop) */
    /* Coalesce the progressive markdown re-render to one per animation frame. md() reparses
       the whole uncommitted tail, so calling it on every token is O(n^2) on long answers;
       rAF batches it without changing the output (finalize() does the authoritative render). */
    var liveRaf=0;
    function renderLiveTail(){ liveRaf=0; if(!liveBox) return;
      liveBox.innerHTML=md(acc.slice(committed));
      (liveBox.lastElementChild || liveBox).appendChild(caretEl);
      maybeScroll();
    }
    function scheduleLiveTail(){ if(liveRaf) return;
      liveRaf=(window.requestAnimationFrame||function(f){return setTimeout(f,16);})(renderLiveTail);
    }
    pendingLiveCancel=function(){ if(liveRaf){ (window.cancelAnimationFrame||clearTimeout)(liveRaf); liveRaf=0; } };
    /* Backend error mid-stream (engine down / token limit): clab sends a chunk with an
       `error` field. Show the error box with the reason instead of a blank turn. */
    function showError(msg){
      errored=true; liveAcc='';
      setDlgErr(msg); /* persist so the box survives reload (stored outside convo) */
      turn.classList.add('noconv'); /* error box has no convo entry — exclude from index math */
      turn.innerHTML=errboxHTML(msg); attachRetry(turn, btn);
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
      if(thinkingShown){ turn.innerHTML=''; thinkingShown=false;
        liveBox=document.createElement('div'); liveBox.className='md'; turn.appendChild(liveBox);
        caretEl=document.createElement('span'); caretEl.className='caret'; }
      var m, todoTouched=false; BLOCK_RE.lastIndex=0;
      while((m=BLOCK_RE.exec(acc))!==null){
        if(m.index < committed) continue;
        var pre=acc.slice(committed, m.index);
        if(pre.replace(/\s/g,'')){ var b=document.createElement('div'); b.className='md'; b.innerHTML=md(pre); turn.insertBefore(b, liveBox); }
        var cel=blockEl(m[1], m[2], m[3]);
        if(cel){ turn.insertBefore(cel, liveBox); } else { todoTouched=true; } /* null = suppressed TodoWrite → feed the bar */
        committed=m.index+m[0].length;
      }
      if(todoTouched) refreshTaskbar();
      scheduleLiveTail();  /* progressive markdown, coalesced to one render per frame */
    }
    function finalize(){
      if(errored) return; /* error box already shown — don't overwrite with an empty turn */
      paintTurn(turn, acc, false); /* one clean final render (markdown + tool blocks, no caret) */
      turn.insertAdjacentHTML('beforeend','<div class="row-acts">'+actBtn('copy','Копировать')+actBtn('regen','Перегенерировать')+'</div>');
      convo.push({role:'assistant', content:acc}); liveAcc='';
      saveActive(); refreshTaskbar();
      finishGen(btn); maybeScroll();
      if(convo.length===2){ genTitle(); } /* first exchange complete → auto-title */
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
              if(chunk.error){ showError((chunk.error&&chunk.error.message)||chunk.error); return; }
              var delta=chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
              if(delta && delta.content){ onContent(delta.content); }
              if(chunk.usage){ var pt=chunk.usage.prompt_tokens; if(activeId){ dlgToks[activeId]=pt; saveDlgToks(); } setCtxToks(pt); }
            }catch(e){ /* ignore keep-alives / partial chunks */ }
          });
          return pump();
        });
      }
      return pump();
    }).catch(function(err){
      if(err && err.name==='AbortError'){ return; } /* stop button owns the UI */
      liveAcc='';
      turn.classList.add('noconv'); /* error box has no convo entry — exclude from index math */
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

  /* `msg` is a string (text only) or {content:text, atts:[…]} when files are attached */
  function sendFlow(msg, btn){
    var isObj=(typeof msg==='object' && msg!==null);
    var dispText=isObj ? (msg.content||'') : msg;
    var entry=isObj ? {role:'user', content:(msg.content||''), atts:(msg.atts||[])} : {role:'user', content:msg};
    if(viewHome.hidden===false){ /* coming from home: start a real new dialog */
      var homeEntry=document.querySelector('#view-home .entry');
      var fromRect=homeEntry?homeEntry.getBoundingClientRect():null;
      activeId=genId();
      var title=(dispText||'Вложение').slice(0,42);
      var it=sidebarItem({id:activeId, title:title, updated_ms:Date.now()}); it.classList.add('active');
      var firstItem=leftDrawer.querySelector('.item'); leftDrawer.insertBefore(it, firstItem || document.getElementById('emptyNone'));
      leftDrawer.querySelectorAll('.item').forEach(function(x){x.classList.toggle('active', x===it);});
      activeItem=it; dtitle.textContent=title; thread.innerHTML=''; convo=[]; refreshTaskbar();
      viewDlg.hidden=false; updateDialogList(); leaveHome();
      btn = dlgSend() || btn; /* we switched to the dialog view — drive stop/send on its (visible) button */
      if(fromRect) dockMorph(fromRect); /* slide the composer from center down into the dock */
      var dh=viewDlg.querySelector('.dhdr'); if(dh && dh.animate){ dh.animate([{opacity:0},{opacity:1}],{duration:260, easing:'ease-out'}); }
    }
    convo.push(entry);
    saveActive(); /* persist now so the dialog exists even before the answer */
    generating=true; setSend(btn,true); setItemGenerating(activeItem,true);
    var ut=userTurn(entry); thread.appendChild(ut); stick=true; toBottom();
    if(ut.animate){ ut.animate([{opacity:0, transform:'translateY(8px)'},{opacity:1, transform:'none'}],{duration:280, easing:'cubic-bezier(.4,0,.2,1)'}); }
    generate(btn);
  }

  function stopGen(btn){ if(currentAbort){ currentAbort.abort(); currentAbort=null; } clearTimers(); generating=false; setSend(btn,false); setItemGenerating(activeItem,false);
    var th=thread.querySelector('.thinking'); if(th){ th.closest('.turn').remove(); liveAcc=''; return; }
    var turn=thread.querySelector('.turn.a:last-child'); if(!turn) return;
    /* the partial answer stays visible in the thread, so it must enter the history
       too — otherwise the turn↔convo mapping drifts and later regen/edit misalign */
    if(liveAcc.replace(/\s/g,'')){ convo.push({role:'assistant', content:liveAcc}); saveActive(); }
    liveAcc='';
    var c=turn.querySelector('.caret'); if(c) c.remove();
    /* stopped mid tool-call: freeze the running ripple into a neutral head */
    var rip=turn.querySelector('.tool .rip'); if(rip){ var head=turn.querySelector('.tool .head'); if(head){ var tag=head.querySelector('.tag'); var tname=tag?tag.textContent:'Инструмент'; head.innerHTML='<span class="tag">'+esc(tname)+'</span> · остановлено'; } }
    if(!turn.querySelector('.stopped')){ var s=document.createElement('div'); s.className='stopped'; s.innerHTML='⏹ Остановлено'; turn.appendChild(s); }
    var mdbox=turn.querySelector('.md');
    if(mdbox && mdbox.textContent.trim() && !turn.querySelector('.row-acts')){ turn.insertAdjacentHTML('beforeend','<div class="row-acts">'+actBtn('copy','Копировать')+actBtn('regen','Перегенерировать')+'</div>'); }
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
  var TEXT_EXT=/\.(txt|md|markdown|csv|tsv|json|jsonl|ya?ml|toml|ini|cfg|conf|log|xml|html?|css|js|jsx|mjs|cjs|ts|tsx|py|rs|go|java|c|h|cpp|hpp|cc|rb|php|sh|bash|zsh|sql|r|lua|pl|swift|kt|scala|dart|vue|svelte|tex|rst|env|gitignore|dockerfile|makefile|diff|patch)$/i;
  function humanSize(n){ if(n==null) return ''; if(n<1024) return n+' Б'; if(n<1024*1024) return (n/1024).toFixed(n<10240?1:0)+' КБ'; return (n/1048576).toFixed(1)+' МБ'; }
  function fileKind(f){
    if(/^image\//.test(f.type||'')) return 'image';
    if(/^text\//.test(f.type||'') || /(json|xml|yaml|javascript|x-sh|x-python|csv|html)/.test(f.type||'') || TEXT_EXT.test(f.name||'')) return 'text';
    return 'file';
  }
  function readAsDataURL(f){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){res(r.result);}; r.onerror=rej; r.readAsDataURL(f); }); }
  function readAsText(f){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){res(r.result);}; r.onerror=rej; r.readAsText(f); }); }
  /* chip inner HTML shared by composer (removable) and bubble (static) */
  function attChipInner(att){
    if(att.kind==='image' && att.url) return '<img src="'+esc(att.url)+'" alt="'+esc(att.name||'')+'" />';
    return '<span class="ic">'+IC.doc+'</span><span class="nm">'+esc(att.name||'файл')+'</span>'+(att.size!=null?'<span class="sz">'+humanSize(att.size)+'</span>':'');
  }
  function attChipHTML(att){ return '<div class="att-chip'+((att.kind==='image'&&att.url)?' img':'')+'">'+attChipInner(att)+'</div>'; }
  function attChipEl(att, onRemove){
    var c=document.createElement('div'); c.className='att-chip'+((att.kind==='image'&&att.url)?' img':'');
    c.innerHTML=attChipInner(att)+'<button class="rm" type="button" title="Убрать" aria-label="Убрать">✕</button>';
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
    function refresh(){ if(!btn.classList.contains('stop')) btn.classList.toggle('off', !(ta.value||'').trim() && pending.length===0); }
    function renderPending(){ atts.innerHTML='';
      pending.forEach(function(att){ atts.appendChild(attChipEl(att, function(){ var i=pending.indexOf(att); if(i>=0) pending.splice(i,1); renderPending(); refresh(); })); });
    }
    function addFiles(files){ Array.prototype.slice.call(files||[]).forEach(function(f){
      if(f.size>MAX_ATT){ toast('Файл «'+(f.name||'без имени')+'» больше 10 МБ — пропущен'); return; }
      /* Pasted screenshots often arrive without a name — give them one. */
      var name=f.name || ((f.type&&f.type.indexOf('image/')===0) ? ('изображение.'+(f.type.split('/')[1]||'png')) : 'вставка');
      var att={kind:fileKind(f), name:name, size:f.size};
      pending.push(att); renderPending(); refresh();
      if(att.kind==='image'){ readAsDataURL(f).then(function(u){ att.url=u; renderPending(); }).catch(function(){ var i=pending.indexOf(att); if(i>=0){ pending.splice(i,1); renderPending(); refresh(); } toast('Не удалось прочитать «'+f.name+'»'); }); }
      else if(att.kind==='text'){ readAsText(f).then(function(t){ att.text=t; }).catch(function(){ att.kind='file'; }); }
    }); }
    function trySend(){ if(btn.classList.contains('stop')) return; var v=(ta.value||'').trim(); if(!v && pending.length===0) return;
      var msg = pending.length ? {content:v, atts:stagedToAtts(pending)} : v;
      ta.value=''; pending=[]; renderPending(); refresh(); sendFlow(msg, btn); }
    btn.addEventListener('click', function(){ if(btn.classList.contains('stop')){ stopGen(btn); return; } trySend(); });
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
    else if(m==='pin'){ var pid=current.dataset.id; var willPin=!current.classList.contains('pinned'); current.classList.toggle('pinned', willPin); if(willPin){ dlgPins[pid]=1; } else { delete dlgPins[pid]; } savePins(); updateDialogList(); }
    else if(m==='del'){ askDelete(current); }
  });

  /* delete confirmation modal */
  var pendingDel=null, confirmScrim=document.getElementById('confirmScrim');
  function askDelete(item){ pendingDel=item; document.getElementById('confirmText').textContent='«'+item.querySelector('.t').textContent.trim()+'» будет удалён без возможности восстановления.'; confirmScrim.hidden=false; }
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
    acts.innerHTML='<button class="ecancel" type="button">Отмена</button><button class="esave" type="button">Сохранить и отправить</button>';
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
    if(act==='copy'){ var src=turn.querySelector('.md')||turn.querySelector('.bubble'); copyText(src.textContent, a); }
    else if(act==='regen'){ regenTurn(turn); }
    else if(act==='edit'){ editUserTurn(turn); }
  });

  /* ---------- settings «Основное»: load active values, save + self-restart ---------- */
  function settingsFields(){ return document.querySelectorAll('.drawer.right [data-key]'); }
  function loadSettings(){
    return uiFetch('/ui/settings').then(function(r){ return r.ok?r.json():null; }).then(function(s){
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
    btn.innerHTML='<span style="display:inline-flex;align-items:center;gap:9px;justify-content:center;">'+cloud(26)+'Сохранение…</span>';
    uiFetch('/ui/settings/save-restart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){ if(!r.ok){ return r.text().then(function(t){ throw new Error(t||('HTTP '+r.status)); }); } return r.json(); })
      .then(function(){ btn.innerHTML=IC.check+' Готово'; loadSettings(); setTimeout(function(){ btn.innerHTML=o; btn.disabled=false; }, 1200); })
      .catch(function(err){ btn.innerHTML=o; btn.disabled=false; saveError('Не удалось сохранить: '+((err&&err.message)||'')); });
  });

  /* ---------- tools section: MCP servers (settings.json mcpServers, no restart) ---------- */
  var mcpServers=[]; /* [{name, command, args[], framing, timeout}] — DOM is source of truth after render */
  function mcpRow(s){
    var d=document.createElement('div'); d.className='mcpsrv';
    d.innerHTML=
      '<div class="fld fieldrow" style="margin-top:8px;"><div class="lab">Имя сервера</div><input class="m-name" placeholder="например, filesystem" /><button class="m-del" type="button" title="Удалить сервер" aria-label="Удалить сервер">✕</button></div>'+
      '<div class="fld"><div class="lab">Команда</div><input class="m-cmd" placeholder="python3" /></div>'+
      '<div class="fld"><div class="lab">Аргументы — по одному на строку</div><textarea class="cfgta m-args" placeholder="/path/to/server.py"></textarea></div>'+
      '<div class="fld"><div class="lab">Фрейминг <span class="env">framing</span></div><select class="m-framing"><option value="newline">стандартный MCP (newline)</option><option value="content-length">legacy (content-length)</option></select></div>'+
      '<div class="fld"><div class="lab">Таймаут вызова, мс <span class="env">toolCallTimeoutMs</span></div><input class="m-timeout" type="number" min="1" placeholder="60000" /></div>';
    d.querySelector('.m-name').value=s.name||'';
    d.querySelector('.m-cmd').value=s.command||'';
    d.querySelector('.m-args').value=(s.args||[]).join('\n');
    d.querySelector('.m-framing').value=(s.framing==='content-length')?'content-length':'newline';
    if(s.timeout) d.querySelector('.m-timeout').value=s.timeout;
    d.querySelector('.m-del').addEventListener('click', function(){ d.remove(); mcpToggleEmpty(); });
    return d;
  }
  function mcpToggleEmpty(){
    var list=document.getElementById('mcpList');
    var empty=list.querySelector('.mcpempty');
    var has=!!list.querySelector('.mcpsrv');
    if(!has && !empty){ var e=document.createElement('div'); e.className='mcpempty'; e.textContent='Серверы не настроены.'; list.appendChild(e); }
    if(has && empty) empty.remove();
  }
  function renderMcp(){
    var list=document.getElementById('mcpList'); list.innerHTML='';
    mcpServers.forEach(function(s){ list.appendChild(mcpRow(s)); });
    mcpToggleEmpty();
  }
  function mcpStatus(ok,text){ var m=document.getElementById('mcpMsg'); m.hidden=false; m.className='savemsg'+(ok?'':' err'); m.textContent=text; if(ok) setTimeout(function(){ m.hidden=true; }, 2400); }
  document.getElementById('mcpAdd').addEventListener('click', function(){
    var list=document.getElementById('mcpList');
    list.appendChild(mcpRow({name:'', command:'', args:[], framing:'newline'}));
    mcpToggleEmpty();
  });
  document.getElementById('mcpSave').addEventListener('click', function(){
    var btn=this; document.getElementById('mcpMsg').hidden=true;
    var out={}, err=null;
    document.querySelectorAll('#mcpList .mcpsrv').forEach(function(d){
      if(err) return;
      var name=(d.querySelector('.m-name').value||'').trim();
      var cmd=(d.querySelector('.m-cmd').value||'').trim();
      if(!name && !cmd) return; /* пустая карточка — игнорируем */
      if(!name || !cmd){ err='У каждого сервера должны быть и имя, и команда.'; return; }
      if(!/^[A-Za-z0-9_-]+$/.test(name)){ err='Имя сервера — только латиница, цифры, дефис, подчёркивание: «'+name+'»'; return; }
      if(out[name]){ err='Имена серверов должны быть уникальны: «'+name+'»'; return; }
      var entry={ command: cmd };
      var args=linesToArray(d.querySelector('.m-args').value); if(args.length) entry.args=args;
      if(d.querySelector('.m-framing').value==='content-length') entry.framing='content-length';
      var to=parseInt(d.querySelector('.m-timeout').value,10); if(to>0) entry.toolCallTimeoutMs=to;
      out[name]=entry;
    });
    if(err){ mcpStatus(false, err); return; }
    btn.disabled=true;
    uiFetch('/ui/config/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mcpServers:out})})
      .then(function(r){ if(!r.ok){ return r.text().then(function(t){ throw new Error(t||('HTTP '+r.status)); }); } return r.json(); })
      .then(function(){ btn.disabled=false; mcpStatus(true,'Сохранено — применится со следующего сообщения'); })
      .catch(function(e){ btn.disabled=false; mcpStatus(false,'Не удалось сохранить: '+((e&&e.message)||'')); });
  });

  /* ---------- security section: settings.json-backed config (no restart) ---------- */
  function cfgSandboxFields(){ return document.querySelectorAll('.drawer.right [data-sb]'); }
  function linesToArray(s){ return (s||'').split('\n').map(function(x){ return x.trim(); }).filter(function(x){ return x.length; }); }
  function loadConfig(){
    return uiFetch('/ui/config').then(function(r){ return r.ok?r.json():null; }).then(function(c){
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
      var ms=c.mcpServers||{};
      mcpServers=Object.keys(ms).map(function(n){ var e=ms[n]||{};
        return { name:n, command:e.command||'', args:e.args||[], framing:e.framing||'newline', timeout:e.toolCallTimeoutMs }; });
      renderMcp();
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
    uiFetch('/ui/config/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){ if(!r.ok){ return r.text().then(function(t){ throw new Error(t||('HTTP '+r.status)); }); } return r.json(); })
      .then(function(){ btn.disabled=false; cfgMsg(true,'Сохранено — применится со следующего сообщения'); })
      .catch(function(err){ btn.disabled=false; cfgMsg(false,'Не удалось сохранить: '+((err&&err.message)||'')); });
  });
  loadConfig();

  /* ---------- reasoning display toggle (ui_kv show_reasoning, default ON) ---------- */
  (function(){
    var sel=document.getElementById('showReason'); if(!sel) return;
    uiFetch('/ui/kv/show_reasoning').then(function(r){ return r.ok?r.json():null; }).then(function(d){
      if(d && d.value==='false') sel.value='false';
    }).catch(function(){});
    sel.addEventListener('change', function(){
      uiFetch('/ui/kv/show_reasoning',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:sel.value})}).catch(function(){});
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
          st.className='cstatus ok'; st.innerHTML='<span class="d"></span><span>Подключено</span>'; setConnDot('ok');
          if(!configured){ configured=true; document.getElementById('view-setup').hidden=true; viewHome.hidden=false; }
        } else {
          var why=(d&&d.error)?(' — '+esc(String(d.error)).slice(0,120)):'';
          st.className='cstatus err'; st.innerHTML='<span class="d"></span><span>Не удалось подключиться'+why+'</span>'; setConnDot('err');
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
  var DEFAULT_PRESETS=[
    {name:'Обычный', prompt:'Ты — полезный локальный ассистент. Отвечай кратко и по делу, на русском.'},
    {name:'Кодер', prompt:'Ты — старший инженер. Пиши идиоматичный код, кратко поясняй решения, предлагай тесты. Ответы — на русском, код и комментарии — на английском.'},
    {name:'Краткий', prompt:'Отвечай максимально кратко — одно-два предложения, без воды.'}
  ];
  function pFetchJSON(url){ return uiFetch(url).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; }); }
  function savePreset(id,name,prompt){ return uiFetch('/ui/presets/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,prompt:prompt})}).catch(function(){}); }
  function deletePresetReq(id){ return uiFetch('/ui/presets/'+encodeURIComponent(id),{method:'DELETE'}).catch(function(){}); }
  function setActivePreset(id){ activePresetId=id||null; return uiFetch('/ui/kv/active_preset',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:id||''})}).catch(function(){}); }
  function activePresetPrompt(){ for(var i=0;i<presets.length;i++){ if(presets[i].id===activePresetId) return presets[i].prompt||''; } return ''; }
  /* what we actually send: active preset's prompt prepended as a system message (or just convo) */
  function stripReasoning(t){ return (t||'').replace(/<details type="reasoning"[\s\S]*?<\/details>/g,'').replace(/\n{3,}/g,'\n\n'); }
  /* assemble the OWUI/OpenAI content array for a user message that carries attachments:
     text + inlined text files + {type:image_url} + a note for non-inlined binaries.
     (text-only messages stay plain strings.) */
  function userContentForBackend(m){
    if(!m.atts || !m.atts.length) return m.content;
    var parts=[];
    if(m.content) parts.push({type:'text', text:m.content});
    m.atts.forEach(function(a){
      if(a.kind==='image' && a.url) parts.push({type:'image_url', image_url:{url:a.url}});
      else if(a.kind==='text' && typeof a.text==='string') parts.push({type:'text', text:'Файл «'+a.name+'»:\n```\n'+a.text+'\n```'});
      else parts.push({type:'text', text:'[вложен файл '+a.name+', '+humanSize(a.size)+' — содержимое не передаётся]'});
    });
    if(!parts.length) parts.push({type:'text', text:''});
    return parts;
  }
  function outgoingMessages(){
    var sys=activePresetPrompt();
    /* reasoning blocks are display-only — drop them from resent history so context stays lean;
       user messages may carry attachments → expand to a content array (UI-only fields dropped) */
    var hist=convo.map(function(m){ return m.role==='assistant'
      ? {role:m.role, content:stripReasoning(m.content)}
      : {role:m.role, content:userContentForBackend(m)}; });
    return sys ? [{role:'system', content:sys}].concat(hist) : hist;
  }

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

  /* unconfigured engine (or ?firstrun) → setup screen; otherwise land on home.
     Decide after settings load so an empty OPENAI_BASE_URL routes a fresh instance
     to the guided setup instead of a dead-end home screen. */
  refreshSidebar();
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
