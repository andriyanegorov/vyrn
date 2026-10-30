(function(){
  var DIGITS = 8, H = 56, COST = 25;
  var SPEEDS = {
    normal:{v:30, first:900, step:260, decel:520},
    turbo: {v:44, first:450, step:130, decel:380}
  };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function(id){return document.getElementById(id)};
  var g1=$('g1'), g2=$('g2'), numEl=$('number'), spinBtn=$('spin'), statusEl=$('status'), heroEl=$('hero'),
      balVal=$('balVal'), balBox=$('bal'), listEl=$('list'),
      emptyEl=$('empty'), countEl=$('count'), toastEl=$('toast');
  var balance = 0, speedKey = 'normal', spinning = false, total = 0, ready = false;
  var loginStreakPromise = window.VyrnApi&&window.VyrnApi.recordLoginStreak
    ? window.VyrnApi.recordLoginStreak().catch(function(error){
      console.error('Не удалось записать вход для серии:',error);
      return null;
    })
    : Promise.resolve(null);
  $('cost').textContent = COST;

  /* build reels */
  var reels = [];
  for (var i=0;i<DIGITS;i++){
    var reel=document.createElement('span'); reel.className='reel stopped';
    var strip=document.createElement('span'); strip.className='strip';
    var html=''; for (var d=0; d<12; d++) html+='<i>'+(d%10)+'</i>';
    strip.innerHTML=html; var win=document.createElement('span'); win.className='win'; win.appendChild(strip); reel.appendChild(win);
    (i<4?g1:g2).appendChild(reel);
    reel.setAttribute('role','button'); reel.tabIndex=0;
    reel.setAttribute('aria-label','Цифра '+(i+1)+': прокрутить за '+COST+' звёзд');
    reel.addEventListener('click',(function(k){return function(){spinOne(k)}})(i));
    reel.addEventListener('keydown',(function(k){return function(e){ if(e.key==='Enter'||e.key===' '){e.preventDefault();spinOne(k);} }})(i));
    reels.push({el:reel, strip:strip, p:0, v:0, state:'idle'});
  }
  function render(r){ r.strip.style.transform='translate3d(0,'+(-(r.p%10)*H).toFixed(2)+'px,0)'; }
  reels.forEach(render);

  /* number generation */
  function rnd(n){return Math.floor(Math.random()*n)}
  function fmt(s){return '+888 '+s.slice(0,4)+' '+s.slice(4)}

  /* animation */
  function easeOut(t){return 1-Math.pow(1-t,3.2)}
  function buzz(type){
    try{ var h=window.Telegram&&Telegram.WebApp&&Telegram.WebApp.HapticFeedback; if(h) type==='ok'?h.notificationOccurred('success'):h.impactOccurred('light'); }catch(e){}
  }
  function setBalance(v, bump){
    balance=v; balVal.textContent=v;
    if (bump){ balBox.classList.remove('bump'); void balBox.offsetWidth; balBox.classList.add('bump'); }
  }

  var current = null;
  var starTag = '<img class="star-ico" src="'+document.querySelector('#bal img').src+'" alt="">';
  function speed(){ var sp=SPEEDS[speedKey]; return reduce ? {v:sp.v, first:250, step:60, decel:200} : sp; }
  function chipsOff(on){ document.querySelectorAll('.chip').forEach(function(c){c.disabled=on}); }
  function lock(on){
    spinning=on; spinBtn.disabled=on || !ready; chipsOff(on || !ready);
    reels.forEach(function(r){ r.el.classList.toggle('can', !on && !!current); });
  }
  function hint(){ statusEl.innerHTML='Нажми на цифру, чтобы перекрутить · '+starTag+COST; }

  /* один шаг анимации барабана; true — барабан остановился на tgt */
  function stepReel(r, now, dt, tgt, sp){
    if (r.state==='spin'){
      r.p = (r.p + r.v*dt) % 10;
      if (now>=r.stopAt){
        var need=r.v*(sp.decel/1000)/3.2, q=Math.ceil(r.p+need);
        while (q%10!==tgt) q++;
        r.from=r.p; r.dist=q-r.p; r.tStart=now; r.state='stop';
        r.el.classList.remove('spin');
      }
    } else if (r.state==='stop'){
      var k=Math.min(1,(now-r.tStart)/sp.decel);
      r.p = r.from + r.dist*easeOut(k);
      if (k>=1){
        r.p = tgt; r.state='done';
        r.el.classList.add('stopped','pop'); buzz('tick');
        return true;
      }
    }
    return false;
  }
  function startReel(r, now, stopAt, sp){
    r.state='spin'; r.v=sp.v*(0.92+Math.random()*0.16); r.p=r.p%10; r.stopAt=stopAt;
    r.el.classList.remove('stopped','pop','can'); r.el.classList.add('spin');
  }

  /* новый номер целиком */
  function spin(){
    if (spinning || !ready) return;
    lock(true);
    heroEl.className='hero is-spinning';
    statusEl.textContent='Создаём номер…';
    window.VyrnApi.spinAnonymousNumber().then(function(result){
      var record = result.number;
      if (!record || !record.id || !/^\d{8}$/.test(record.number)) throw new Error('Сервер вернул некорректный номер.');
      setBalance(Number(record.balance), true);
      animateFullNumber(record);
    }).catch(function(error){
      heroEl.className='hero';
      statusEl.textContent=error.message || 'Не удалось создать номер.';
      toast(statusEl.textContent);
      lock(false);
      loadNumbers(false);
    });
  }

  function animateFullNumber(record){
    var target = record.number, sp = speed();
    var t0 = performance.now(), last = t0, left = DIGITS;
    reels.forEach(function(r,i){ startReel(r, t0, t0 + sp.first + i*sp.step, sp); });

    function frame(now){
      var dt = Math.min(0.05,(now-last)/1000); last = now;
      for (var i=0;i<DIGITS;i++){
        var r=reels[i];
        if (r.state==='spin'||r.state==='stop'){ if (stepReel(r,now,dt,+target[i],sp)) left--; }
        render(r);
      }
      if (left>0) requestAnimationFrame(frame); else finish(record);
    }
    requestAnimationFrame(frame);
  }

  function finish(record){
    var s=record.number;
    reels.forEach(function(r,i){ r.p=+s[i]; r.state='idle'; render(r); });
    heroEl.className='hero';
    numEl.setAttribute('aria-label','Номер '+fmt(s));
    buzz('ok');
    var row=addRow(record);
    record.row=row;
    selectNumber(record,row);
    ready=true;
    lock(false); hint();
  }

  function spinOne(i){
    if (spinning || !ready || !current) return;
    lock(true);
    heroEl.className='hero is-spinning';
    statusEl.textContent='Улучшаем цифру '+(i+1)+'…';
    window.VyrnApi.upgradeAnonymousNumber(current.id,i).then(function(result){
      var updated=result.number;
      if (!updated || updated.id!==current.id || !/^\d{8}$/.test(updated.number)) {
        throw new Error('Сервер вернул некорректный номер.');
      }
      setBalance(Number(updated.balance), true);
      animateDigit(updated,i);
    }).catch(function(error){
      heroEl.className='hero';
      statusEl.textContent=error.message || 'Не удалось улучшить номер.';
      toast(statusEl.textContent);
      lock(false);
      loadNumbers(false);
    });
  }

  function animateDigit(updated,i){
    var sp = speed(), r = reels[i], d = +updated.number[i], t0 = performance.now(), last = t0;
    startReel(r, t0, t0 + sp.first*0.8, sp);

    function frame(now){
      var dt = Math.min(0.05,(now-last)/1000); last = now;
      var fin = stepReel(r, now, dt, d, sp);
      render(r);
      if (!fin) { requestAnimationFrame(frame); return; }
      r.state='idle'; r.p=d; render(r);
      current.number=updated.number; current.upgrades=updated.upgrades;
      updateRow(current);
      numEl.setAttribute('aria-label','Номер '+fmt(current.number));
      heroEl.className='hero';
      buzz('ok'); lock(false); hint();
    }
    requestAnimationFrame(frame);
  }

  var phoneSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z"/></svg>';
  function addRow(record){
    var row=document.createElement('div'); row.className='row enter'; row.dataset.numberId=record.id;
    row.innerHTML='<span class="row-ico">'+phoneSvg+'</span>'+
      '<span class="row-copy"><strong>'+fmt(record.number)+'</strong><span>'+(Number(record.upgrades)?'Улучшен ×'+record.upgrades:'Анонимный номер')+'</span></span>'+
      '<button class="btn-sm" type="button">Копировать</button>';
    row.querySelector('button').addEventListener('click',function(e){
      e.stopPropagation();
      copy(fmt(record.number),e.currentTarget);
    });
    row.addEventListener('click',function(){if(!spinning) selectNumber(record,row)});
    listEl.insertBefore(row,listEl.firstChild);
    total++;
    emptyEl.style.display='none'; countEl.textContent=total;
    return row;
  }
  function updateRow(record){
    var row=record.row;
    row.querySelector('strong').textContent=fmt(record.number);
    row.querySelector('.row-copy > span').textContent='Улучшен ×'+record.upgrades;
    row.classList.remove('enter'); void row.offsetWidth; row.classList.add('enter');
  }
  function selectNumber(record,row){
    record.row=row;
    current=record;
    listEl.querySelectorAll('.row').forEach(function(item){item.classList.toggle('is-current',item===row)});
    reels.forEach(function(reel,index){
      reel.p=+record.number[index];
      reel.state='idle';
      render(reel);
    });
    numEl.setAttribute('aria-label','Номер '+fmt(record.number));
    heroEl.className='hero';
    lock(false);
    hint();
  }
  async function loadNumbers(showStatus){
    ready=false;
    lock(true);
    if (!window.VyrnApi) {
      statusEl.textContent='Не удалось подключиться к Supabase API.';
      return;
    }
    if (showStatus) statusEl.textContent='Загружаем ваши номера…';
    try {
      await loginStreakPromise;
      var result=await window.VyrnApi.anonymousNumbers();
      listEl.replaceChildren();
      total=0;
      current=null;
      setBalance(Number(result.balance)||0,false);
      var records=(result.numbers||[]).map(function(record){
        return Object.assign({},record,{number:record.digits});
      }).reverse();
      records.forEach(function(record){record.row=addRow(record)});
      if (records.length) {
        selectNumber(records[records.length-1],records[records.length-1].row);
      }
      ready=true;
      lock(false);
      if (!records.length && showStatus) statusEl.textContent='Нажми «Выбить номер»';
    } catch (error) {
      ready=false;
      lock(false);
      statusEl.textContent=error.message || 'Не удалось загрузить анонимные номера.';
    }
  }
  function copy(text,btn){
    function ok(){ var o=btn.textContent; btn.textContent='Готово'; btn.classList.add('ok'); toast('Номер скопирован');
      setTimeout(function(){btn.textContent=o;btn.classList.remove('ok')},1200); }
    if (navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok,fallback); else fallback();
    function fallback(){ var t=document.createElement('textarea'); t.value=text; t.style.position='fixed'; t.style.opacity='0'; document.body.appendChild(t); t.select(); try{document.execCommand('copy')}catch(e){} document.body.removeChild(t); ok(); }
  }
  var tt;
  function toast(m){ toastEl.textContent=m; toastEl.classList.add('show'); clearTimeout(tt); tt=setTimeout(function(){toastEl.classList.remove('show')},1600); }

  /* блики */
  (function(){
    var box=$('sparks'), pts=[[8,14],[22,6],[38,12],[56,8],[74,15],[91,10],[5,48],[95,52],[14,86],[30,94],[48,88],[66,95],[84,88],[93,76],[3,70],[62,50]];
    pts.forEach(function(p,i){
      var s=document.createElement('span'); s.className='spark';
      var size=9+Math.round(Math.random()*11);
      s.style.cssText='--x:'+(p[0]+(Math.random()*4-2)).toFixed(1)+'%;--y:'+(p[1]+(Math.random()*4-2)).toFixed(1)+'%;--s:'+size+'px;--d:'+(2.4+Math.random()*2.8).toFixed(2)+'s;--dl:'+(-Math.random()*5).toFixed(2)+'s';
      s.innerHTML='<i></i>'; box.appendChild(s);
    });
  })();

  /* controls */
  spinBtn.addEventListener('click',spin);
  document.querySelectorAll('.chip').forEach(function(c){
    c.addEventListener('click',function(){
      if (spinning) return;
      document.querySelectorAll('.chip').forEach(function(x){x.classList.remove('on')});
      c.classList.add('on'); speedKey=c.getAttribute('data-speed');
    });
  });

  /* nav indicator */
  function placeInd(){
    var a=document.querySelector('.nav-button.is-active'), ind=$('ind'); if(!a) return;
    ind.style.setProperty('--w',a.offsetWidth+'px'); ind.style.left=a.offsetLeft+'px';
  }
  placeInd(); addEventListener('resize',placeInd);
  if (document.fonts&&document.fonts.ready) document.fonts.ready.then(placeInd);
  try{ if(window.Telegram&&Telegram.WebApp){Telegram.WebApp.ready();Telegram.WebApp.expand();} }catch(e){}
  loadNumbers(true);
})();
